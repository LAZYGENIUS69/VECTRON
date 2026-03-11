/**
 * VECTRON — Dependency Propagation Canvas
 * 
 * WebGL graph renderer using Sigma.js with ForceAtlas2 layout.
 * Visualizes code dependency graphs with blast-radius simulation
 * for structural impact analysis.
 * 
 * Architecture:
 *  - Hierarchical seed layout: anchor nodes placed on Fermat spiral,
 *    dependents scattered near their anchor with gaussian jitter
 *  - Adaptive FA2: runtime-inferred base settings merged with
 *    density-aware overrides for organic cluster emergence
 *  - Type-keyed visual encoding: distinct hue per entity kind,
 *    tinted by module membership for cluster-level differentiation
 *  - Depth-graded blast overlay with per-hop color ramp
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import Graph from 'graphology';
import Sigma from 'sigma';
import FA2Layout from 'graphology-layout-forceatlas2/worker';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import noverlap from 'graphology-layout-noverlap';
import EdgeCurveProgram from '@sigma/edge-curve';
import type { GraphData } from '../types/graph';

/* ═══════════════════════════════════════════════════════════════════
   VISUAL ENCODING TABLES
   ═══════════════════════════════════════════════════════════════════ */

// Entity kind → hue. Chosen for maximum mutual contrast on dark bg.
const KIND_HUES: Record<string, string> = {
  file:     '#FF2D55',   // hot rose
  function: '#00C7BE',   // caribbean teal
  class:    '#FF9F0A',   // signal amber
  method:   '#30D158',   // spring green
  import:   '#636366',   // neutral gray
  _fallback:'#BF5AF2',   // electric violet
};

// Module membership palette — assigned round-robin by discovery order.
const CLUSTER_HUES = [
  '#ff2d55', '#ff9f0a', '#30d158', '#00c7be',
  '#0a84ff', '#bf5af2', '#ff6b35', '#ffd60a',
  '#5ac8fa', '#ff375f', '#34c759', '#ff8c00',
];

// Relationship kind → visual treatment.
// Structural links (DEFINES) are subtle; semantic links (CALLS) pop.
const LINK_VISUALS: Record<string, { hue: string; opacity: string; width: number }> = {
  CONTAINS: { hue: '#22c55e', opacity: '33', width: 0.3 },
  DEFINES:  { hue: '#06b6d4', opacity: '33', width: 0.3 },
  IMPORTS:  { hue: '#3b82f6', opacity: '44', width: 0.5 },
  CALLS:    { hue: '#8b5cf6', opacity: '33', width: 0.5 },
  EXTENDS:  { hue: '#f97316', opacity: '44', width: 0.7 },
  _fallback:{ hue: '#475569', opacity: '22', width: 0.4 },
};

// Legend data
const NODE_LEGEND = [
  { hue: '#FF2D55', tag: 'File' },
  { hue: '#00C7BE', tag: 'Function' },
  { hue: '#FF9F0A', tag: 'Class' },
  { hue: '#30D158', tag: 'Method' },
];
const EDGE_LEGEND = [
  { hue: '#06b6d4', tag: 'DEFINES' },
  { hue: '#3b82f6', tag: 'IMPORTS' },
  { hue: '#8b5cf6', tag: 'CALLS' },
  { hue: '#f97316', tag: 'EXTENDS' },
];

/* ═══════════════════════════════════════════════════════════════════
   UTILITY FUNCTIONS
   ═══════════════════════════════════════════════════════════════════ */

/** Parse 6-char hex to RGB triple */
function hexRgb(h: string): [number, number, number] {
  return [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
}

/** RGB triple back to 6-char hex */
function rgbHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return '#' + [c(r), c(g), c(b)].map(v => v.toString(16).padStart(2, '0')).join('');
}

/**
 * Attenuate a color toward the canvas background (#06060a).
 * `keep` = 1.0 → full brightness.  `keep` = 0.0 → pure background.
 */
function attenuate(hex: string, keep: number): string {
  const [r, g, b] = hexRgb(hex);
  const BG_R = 6, BG_G = 6, BG_B = 10;
  return rgbHex(
    BG_R + (r - BG_R) * keep,
    BG_G + (g - BG_G) * keep,
    BG_B + (b - BG_B) * keep,
  );
}

/**
 * Boost a color toward white for emphasis.
 * `factor` > 1 → brighter.
 */
function brighten(hex: string, factor: number): string {
  const [r, g, b] = hexRgb(hex);
  return rgbHex(
    r + (255 - r) * (factor - 1) / factor,
    g + (255 - g) * (factor - 1) / factor,
    b + (255 - b) * (factor - 1) / factor,
  );
}

/** Linear RGB blend.  t=0 → a,  t=1 → b. */
function tint(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexRgb(a);
  const [br, bg, bb] = hexRgb(b);
  return rgbHex(
    ar + (br - ar) * t,
    ag + (bg - ag) * t,
    ab + (bb - ab) * t,
  );
}

/**
 * Computes rendered node radius from entity kind and connectivity.
 * Logarithmic degree bonus ensures hub nodes stand out without
 * overwhelming leaf nodes. Hard-capped at 12 px.
 */
function computeNodeRadius(kind: string, degree: number, totalNodes: number): number {
  const BASE: Record<string, number> = {
    file: 7, function: 3, class: 9, method: 2.5, import: 1.5, _fallback: 4,
  };
  const b     = BASE[kind] ?? BASE._fallback;
  const bonus = Math.log1p(degree) * 0.9;
  const density = totalNodes > 5000 ? 0.4 : totalNodes > 1000 ? 0.6 : 0.85;
  return Math.max(1.5, Math.min((b + bonus) * density, 12));
}

/**
 * FA2 mass — heavier nodes repel more, creating natural spacing.
 * Classes are heaviest (central hubs), imports lightest.
 */
function computeNodeMass(kind: string, totalNodes: number): number {
  const scale = totalNodes > 5000 ? 2 : totalNodes > 1000 ? 1.5 : 1;
  const base: Record<string, number> = {
    class: 5, file: 3, function: 2, method: 1.5, import: 1, _fallback: 2,
  };
  return (base[kind] ?? base._fallback) * (kind === 'import' ? 1 : scale);
}

/* ═══════════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════════ */

interface Props {
  data:           GraphData;
  vectronMode:    boolean;
  blastIds:       Set<string>;
  depthMap:       Map<string, number>;
  selectedId:     string | null;
  focusedFileId?: string | null;
  onNodeClick:    (id: string) => void;
}

export default function GraphView2D({
  data, vectronMode, blastIds, depthMap, selectedId, focusedFileId, onNodeClick,
}: Props) {

  /* ─── refs ─────────────────────────────────────────────────────── */
  const containerRef = useRef<HTMLDivElement>(null);
  const sigmaRef     = useRef<Sigma | null>(null);
  const graphRef     = useRef<Graph | null>(null);
  const layoutRef    = useRef<FA2Layout | null>(null);
  const timerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Prop mirrors for closure-safe reducer access
  const vModeRef  = useRef(vectronMode);
  const blastRef  = useRef(blastIds);
  const depthRef  = useRef(depthMap);
  const selRef    = useRef(selectedId);
  const clickRef  = useRef(onNodeClick);

  useEffect(() => { vModeRef.current = vectronMode; }, [vectronMode]);
  useEffect(() => { blastRef.current = blastIds;     }, [blastIds]);
  useEffect(() => { depthRef.current = depthMap;     }, [depthMap]);
  useEffect(() => { selRef.current   = selectedId;   }, [selectedId]);
  useEffect(() => { clickRef.current = onNodeClick;  }, [onNodeClick]);

  const [computing, setComputing] = useState(false);

  /* ─── lifecycle ────────────────────────────────────────────────── */

  // One-shot init guarded by ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let didBoot = false;

    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      if (!width || !height || didBoot) return;
      didBoot = true;
      ro.disconnect();
      bootstrap(el);
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      timerRef.current && clearTimeout(timerRef.current);
      layoutRef.current?.kill();
      layoutRef.current = null;
      sigmaRef.current?.kill();
      sigmaRef.current = null;
      graphRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Trigger repaint when highlight state changes
  useEffect(() => { sigmaRef.current?.refresh(); },
    [vectronMode, blastIds, depthMap, selectedId]);

  // Fly camera to file node selected in explorer
  useEffect(() => {
    const s = sigmaRef.current, g = graphRef.current;
    if (!s || !g || !focusedFileId || !g.hasNode(focusedFileId)) return;
    const { x, y } = g.getNodeAttributes(focusedFileId);
    s.getCamera().animate({ x, y, ratio: 0.12 }, { duration: 400 });
  }, [focusedFileId]);

  /* ─── camera controls ──────────────────────────────────────────── */
  const zoomIn  = useCallback(() => sigmaRef.current?.getCamera().animatedZoom({ duration: 180 }), []);
  const zoomOut = useCallback(() => sigmaRef.current?.getCamera().animatedUnzoom({ duration: 180 }), []);
  const fitAll  = useCallback(() => sigmaRef.current?.getCamera().animatedReset({ duration: 400 }), []);

  /* ═════════════════════════════════════════════════════════════════
     BOOTSTRAP — builds the graph, launches layout
     ═════════════════════════════════════════════════════════════════ */

  function bootstrap(container: HTMLDivElement) {
    const { nodes, edges } = data;
    const N = nodes.length;

    /* ── 1. SEED LAYOUT — Fermat spiral for anchors ─────────────── 
       
       File nodes are the structural anchors. We place them on a
       Fermat spiral (golden-angle based) so they are evenly
       distributed without overlapping. Every child node (function,
       class, method) is then scattered near its parent file with
       gaussian jitter. FA2 refines from there — it doesn't need
       to invent structure, only tighten it.
    */
    const SPIRAL_RADIUS  = Math.sqrt(N) * 40;   // wider than needed — FA2 compresses
    const SCATTER_RADIUS = Math.sqrt(N) * 3;
    const PHI            = Math.PI * (3 - Math.sqrt(5)); // golden angle

    // Identify file (anchor) nodes
    const anchors    = nodes.filter(n => n.type === 'file');
    const dependents = nodes.filter(n => n.type !== 'file');

    // Place anchors on Fermat spiral
    const anchorPos = new Map<string, { x: number; y: number }>();
    anchors.forEach((node, i) => {
      const theta = i * PHI;
      const r     = SPIRAL_RADIUS * Math.sqrt((i + 1) / Math.max(anchors.length, 1));
      const jitter = SPIRAL_RADIUS * 0.12;
      anchorPos.set(node.id, {
        x: r * Math.cos(theta) + (Math.random() - 0.5) * jitter,
        y: r * Math.sin(theta) + (Math.random() - 0.5) * jitter,
      });
    });

    // Place dependents near their parent anchor
    const seedPos = new Map<string, { x: number; y: number }>();
    anchors.forEach(n => seedPos.set(n.id, anchorPos.get(n.id)!));

    dependents.forEach(n => {
      // Imports cluster at origin — they're hidden anyway
      if (n.type === 'import') {
        seedPos.set(n.id, {
          x: (Math.random() - 0.5) * 5,
          y: (Math.random() - 0.5) * 5,
        });
        return;
      }
      // Look up parent via fileId
      const parent = n.fileId ? anchorPos.get(n.fileId) : null;
      if (parent) {
        seedPos.set(n.id, {
          x: parent.x + (Math.random() - 0.5) * SCATTER_RADIUS,
          y: parent.y + (Math.random() - 0.5) * SCATTER_RADIUS,
        });
      } else {
        // Orphan — place randomly in inner third
        seedPos.set(n.id, {
          x: (Math.random() - 0.5) * SPIRAL_RADIUS * 0.3,
          y: (Math.random() - 0.5) * SPIRAL_RADIUS * 0.3,
        });
      }
    });

    /* ── 2. DEGREE MAP — for size computation ───────────────────── */
    const degree = new Map<string, number>();
    nodes.forEach(n => degree.set(n.id, 0));
    edges.forEach(e => {
      degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
      degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
    });

    /* ── 3. MODULE → HUE MAPPING ────────────────────────────────── */
    const moduleHue = new Map<string, string>();
    nodes.forEach(n => {
      const mod = n.module || 'root';
      if (!moduleHue.has(mod)) {
        moduleHue.set(mod, CLUSTER_HUES[moduleHue.size % CLUSTER_HUES.length]);
      }
    });

    /* ── 4. COMPUTE FINAL NODE COLORS ───────────────────────────── 
       Entity kind provides base hue. Module membership tints it
       at 30% blend — enough to see clusters, not enough to lose
       type differentiation.
    */
    const nodeColor = new Map<string, string>();
    nodes.forEach(n => {
      const kindHue = KIND_HUES[n.type] ?? KIND_HUES._fallback;
      if (n.type === 'import') {
        nodeColor.set(n.id, KIND_HUES.import);
        return;
      }
      const modHue = moduleHue.get(n.module || 'root') ?? CLUSTER_HUES[0];
      nodeColor.set(n.id, tint(kindHue, modHue, 0.30));
    });

    /* ── 5. BUILD GRAPHOLOGY INSTANCE ───────────────────────────── */
    const graph = new Graph();
    graphRef.current = graph;

    nodes.forEach(n => {
      const pos = seedPos.get(n.id) ?? { x: 0, y: 0 };
      graph.addNode(n.id, {
        x:        pos.x,
        y:        pos.y,
        size:     computeNodeRadius(n.type, degree.get(n.id) ?? 0, N),
        color:    nodeColor.get(n.id) ?? KIND_HUES._fallback,
        label:    n.label ?? n.id,
        nodeType: n.type,
        filePath: n.filePath,
        mass:     computeNodeMass(n.type, N),
        hidden:   n.type === 'import',
      });
    });

    /* ── 6. ADD EDGES ───────────────────────────────────────────── */
    let edgesAdded = 0;
    edges.forEach(e => {
      if (!graph.hasNode(e.source) || !graph.hasNode(e.target)) return;
      if (graph.hasEdge(e.source, e.target)) return;
      const vis = LINK_VISUALS[e.kind] ?? LINK_VISUALS._fallback;
      graph.addEdge(e.source, e.target, {
        size:      Math.max(0.5, vis.width),
        color:     vis.hue + vis.opacity,
        type:      'curved',
        curvature: 0.12 + Math.random() * 0.08,
      });
      edgesAdded++;
    });


    /* ── 7. SIGMA RENDERER ──────────────────────────────────────── */
    const sigma = new Sigma(graph, container, {
      renderLabels: true,
      labelFont:    '"Courier New", Courier, monospace',
      labelSize:    11,
      labelWeight:  '600',
      labelColor:   { color: '#e4e4ed' },

      // Label visibility — tuned for readability at default zoom
      labelRenderedSizeThreshold: 8,
      labelDensity:               0.12,
      labelGridCellSize:          65,

      defaultEdgeType:    'curved',
      edgeProgramClasses: { curved: EdgeCurveProgram },
      defaultEdgeColor:   '#1f2937',

      hideEdgesOnMove: true,   // performance: skip edge paint during drag/zoom
      minCameraRatio:  0.002,
      maxCameraRatio:  50,
      zIndex:          true,

      /* ── NODE REDUCER ──────────────────────────────────────────
         Runs per-frame for each visible node.
         Reads from refs to avoid stale-closure bugs.
      */
      nodeReducer: (nid, attrs) => {
        const out      = { ...attrs };
        const isBlast  = vModeRef.current;
        const blast    = blastRef.current;
        const sel      = selRef.current;
        const origClr  = attrs.color as string;
        const origSize = attrs.size  as number;

        // ── Blast-radius overlay ──
        if (isBlast && blast.size > 0) {
          if (nid === sel) {
            return { ...out, color: '#FF3B30', size: origSize * 1.8, highlighted: true, zIndex: 4 };
          }
          if (blast.has(nid)) {
            const hop = depthRef.current.get(nid) ?? 99;
            const hopClr = hop === 1 ? '#FF9500' : hop === 2 ? '#FFCC00' : '#30D158';
            const hopMul = hop === 1 ? 1.6 : hop === 2 ? 1.3 : 1.1;
            return { ...out, color: hopClr, size: origSize * hopMul, zIndex: Math.max(1, 4 - hop) };
          }
          return { ...out, color: attenuate(origClr, 0.15), size: origSize * 0.4, zIndex: 0 };
        }

        // ── Selection highlighting ──
        if (sel) {
          const g = graphRef.current;
          if (nid === sel) {
            return { ...out, size: origSize * 1.8, highlighted: true, zIndex: 3 };
          }
          if (g && (g.hasEdge(nid, sel) || g.hasEdge(sel, nid))) {
            return { ...out, size: origSize * 1.3, zIndex: 2 };
          }
          return { ...out, color: attenuate(origClr, 0.20), size: origSize * 0.5, zIndex: 0 };
        }

        return out;
      },

      /* ── EDGE REDUCER ──────────────────────────────────────────
         Highlights edges connected to selected/blasted nodes.
         Dims everything else to near-invisible.
      */
      edgeReducer: (eid, attrs) => {
        const out  = { ...attrs };
        const isV  = vModeRef.current;
        const blast= blastRef.current;
        const sel  = selRef.current;
        const g    = graphRef.current;
        if (!g) return out;
        const [src, tgt] = g.extremities(eid);

        if (isV && blast.size > 0) {
          const sIn = blast.has(src) || src === sel;
          const tIn = blast.has(tgt) || tgt === sel;
          if (sIn && tIn) return { ...out, color: '#F59E0B', size: Math.max(2, (attrs.size as number) * 3), zIndex: 3 };
          return { ...out, hidden: true };
        }

        if (sel) {
          if (src === sel || tgt === sel) {
            return { ...out, color: brighten(attrs.color as string, 1.5), size: Math.max(2, (attrs.size as number) * 3), zIndex: 2 };
          }
          return { ...out, color: attenuate(attrs.color as string, 0.08), size: 0.2, zIndex: 0 };
        }

        return out;
      },

      /* ── HOVER TOOLTIP ─────────────────────────────────────────
         Dark pill with node-color border. VECTRON aesthetic.
      */
      defaultDrawNodeHover: (ctx, d) => {
        const label = d.label as string | undefined;
        if (!label) return;
        ctx.font = '600 11px "Courier New", monospace';
        const tw = ctx.measureText(label).width;
        const ns = (d.size as number) || 6;
        const px = 8, py = 4;
        const w  = tw + px * 2;
        const h  = 11 + py * 2;
        const cx = d.x as number;
        const cy = (d.y as number) - ns - 12;

        // Dark pill
        ctx.fillStyle = '#0d1117';
        ctx.beginPath();
        ctx.roundRect(cx - w / 2, cy - h / 2, w, h, 3);
        ctx.fill();

        // Color border
        ctx.strokeStyle = (d.color as string) || '#FF2D55';
        ctx.lineWidth   = 1.5;
        ctx.stroke();

        // Label
        ctx.fillStyle    = '#e4e4ed';
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, cx, cy);

        // Glow ring
        ctx.beginPath();
        ctx.arc(d.x as number, d.y as number, ns + 5, 0, Math.PI * 2);
        ctx.strokeStyle = (d.color as string) || '#FF2D55';
        ctx.lineWidth   = 1.5;
        ctx.globalAlpha = 0.35;
        ctx.stroke();
        ctx.globalAlpha = 1;
      },
    });

    sigmaRef.current = sigma;
    // Flush WebGL before FA2 starts moving nodes
    setTimeout(() => sigma.refresh(), 100);
    setTimeout(() => sigma.refresh(), 500);

    // Wire events
    sigma.on('clickNode',  ({ node }) => clickRef.current(node));
    sigma.on('clickStage', ()         => clickRef.current(''));
    sigma.on('enterNode',  ()         => { container.style.cursor = 'pointer'; });
    sigma.on('leaveNode',  ()         => { container.style.cursor = 'default'; });

    /* ── 8. FORCE-DIRECTED LAYOUT ────────────────────────────────
       
       We use graphology's `inferSettings` as a sensible baseline,
       then merge our density-aware overrides on top. This is more
       robust than hand-tuning every parameter for every graph size.
       
       Key insight: low gravity + high scaling ratio + low slowDown
       lets clusters emerge naturally. outboundAttractionDistribution
       equalises pull so high-degree nodes don't suck everything in.
    */
    const inferred = forceAtlas2.inferSettings(graph);

    const overrides = {
      gravity:                        N < 500 ? 0.8 : N < 2000 ? 0.5 : N < 10000 ? 0.3 : 0.15,
      scalingRatio:                   N < 500 ? 15  : N < 2000 ? 30  : N < 10000 ? 60  : 100,
      slowDown:                       N < 500 ? 1   : N < 2000 ? 2   : N < 10000 ? 3   : 5,
      barnesHutOptimize:              N > 200,
      barnesHutTheta:                 N > 2000 ? 0.8 : 0.6,
      strongGravityMode:              false,
      outboundAttractionDistribution: true,
      linLogMode:                     false,
      adjustSizes:                    true,
      edgeWeightInfluence:            1,
    };

    const settings = { ...inferred, ...overrides };

    // Duration — longer for larger graphs, let it truly converge
    const duration =
      N > 10000 ? 45000 :
      N > 5000  ? 35000 :
      N > 2000  ? 30000 :
      N > 500   ? 25000 : 20000;

    const layout = new FA2Layout(graph, { settings });
    layoutRef.current = layout;
    layout.start();
    setComputing(true);

    timerRef.current = setTimeout(() => {
      layout.stop();
      layoutRef.current = null;

      // Resolve residual overlaps
      noverlap.assign(graph, {
        maxIterations: 20,
        settings: { ratio: 1.1, margin: 10 },
      });

      sigma.getCamera().animatedReset({ duration: 700 });
      sigma.refresh();
      setComputing(false);
    }, duration);
  }

  /* ═════════════════════════════════════════════════════════════════
     RENDER
     ═════════════════════════════════════════════════════════════════ */

  return (
    <div style={{
      width: '100%', height: '100%', position: 'relative',
      background: '#06060a', overflow: 'hidden',
    }}>

      {/* VECTRON grid underlay */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
        backgroundImage: [
          'linear-gradient(rgba(0,217,255,0.02) 1px, transparent 1px)',
          'linear-gradient(90deg, rgba(0,217,255,0.02) 1px, transparent 1px)',
        ].join(','),
        backgroundSize: '48px 48px',
      }} />

      {/* Sigma canvas mount */}
      <div ref={containerRef} style={{
        width: '100%', height: '100%', position: 'relative', zIndex: 1,
      }} />

      {/* Scanline overlay (simulation mode only) */}
      {vectronMode && (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2,
          background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,255,148,0.01) 3px, rgba(0,255,148,0.01) 4px)',
        }} />
      )}

      {/* Blast badge */}
      {vectronMode && blastIds.size > 0 && (
        <div style={{
          position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(255,59,48,0.1)', border: '1px solid rgba(255,59,48,0.45)',
          color: '#FF3B30', padding: '5px 18px', borderRadius: 20,
          fontSize: 12, fontFamily: '"Courier New", monospace',
          fontWeight: 700, letterSpacing: 1, zIndex: 10,
        }}>
          ◈ {blastIds.size} NODES AFFECTED
        </div>
      )}

      {/* Layout progress */}
      {computing && (
        <div style={{
          position: 'absolute', bottom: 42, left: '50%', transform: 'translateX(-50%)',
          color: 'rgba(0,217,255,0.35)', fontSize: 10,
          fontFamily: '"Courier New", monospace',
          pointerEvents: 'none', zIndex: 10, letterSpacing: 2,
        }}>
          COMPUTING LAYOUT...
        </div>
      )}

      {/* Zoom controls — right edge, vertically centered */}
      <div style={{
        position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
        display: 'flex', flexDirection: 'column', gap: 4, zIndex: 10,
      }}>
        {([
          { ch: '+', fn: zoomIn,  title: 'Zoom In'  },
          { ch: '−', fn: zoomOut, title: 'Zoom Out' },
          { ch: '⊡', fn: fitAll,  title: 'Fit All'  },
        ] as const).map(b => (
          <button key={b.ch} onClick={b.fn} title={b.title} style={{
            width: 30, height: 30, background: 'transparent',
            border: '1px solid rgba(0,217,255,0.22)',
            color: '#00D9FF', borderRadius: 2, cursor: 'pointer',
            fontSize: 15, fontFamily: 'monospace',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {b.ch}
          </button>
        ))}
      </div>

      {/* Legend — bottom left */}
      <div style={{
        position: 'absolute', bottom: 38, left: 12,
        display: 'flex', flexDirection: 'column', gap: 3,
        zIndex: 10, pointerEvents: 'none',
      }}>
        {NODE_LEGEND.map(({ hue, tag }) => (
          <div key={tag} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: hue, boxShadow: `0 0 4px ${hue}88`, flexShrink: 0,
            }} />
            <span style={{ color: 'rgba(228,228,237,0.35)', fontSize: 9, fontFamily: 'monospace' }}>
              {tag}
            </span>
          </div>
        ))}
        <div style={{ height: 3 }} />
        {EDGE_LEGEND.map(({ hue, tag }) => (
          <div key={tag} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 14, height: 2, background: hue, opacity: 0.75, flexShrink: 0 }} />
            <span style={{ color: 'rgba(228,228,237,0.35)', fontSize: 9, fontFamily: 'monospace' }}>
              {tag}
            </span>
          </div>
        ))}
      </div>

      {/* Stats footer */}
      <div style={{
        position: 'absolute', bottom: 14, left: 12,
        color: 'rgba(228,228,237,0.18)', fontSize: 10,
        fontFamily: '"Courier New", monospace',
        pointerEvents: 'none', zIndex: 10, letterSpacing: 1,
      }}>
        {data.nodes.length} nodes · {data.edges.length} edges
      </div>
    </div>
  );
}
