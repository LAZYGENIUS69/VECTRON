import { useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

// ─── Node Graph Types ───────────────────────────────────────────────────────

type NodeType = 'file' | 'function' | 'class' | 'import';

interface GraphNode {
    id: number;
    label: string;
    type: NodeType;
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    depth: number; // 0–1, affects opacity + size
    color: string;
    glowColor: string;
    pulse: number; // 0–2π animated phase
}

interface GraphEdge {
    from: number;
    to: number;
    alpha: number;
    phase: number;
}

// ─── Graph Data ──────────────────────────────────────────────────────────────

const NODE_DATA: { label: string; type: NodeType }[] = [
    { label: 'auth.middleware', type: 'function' },
    { label: 'api.router', type: 'file' },
    { label: 'graph.builder', type: 'class' },
    { label: 'parser.babel', type: 'function' },
    { label: 'schema.types', type: 'import' },
    { label: 'db.client', type: 'class' },
    { label: 'blast.radius', type: 'function' },
    { label: 'index.ts', type: 'file' },
    { label: 'query.engine', type: 'class' },
    { label: 'edge.resolver', type: 'function' },
    { label: 'mcp.server', type: 'file' },
    { label: 'semantic.map', type: 'function' },
    { label: 'risk.scorer', type: 'class' },
    { label: 'config.loader', type: 'import' },
    { label: 'graph.store', type: 'class' },
    { label: 'llm.router', type: 'function' },
    { label: 'types.d.ts', type: 'import' },
    { label: 'node.metrics', type: 'function' },
    { label: 'upload.route', type: 'file' },
    { label: 'process.flow', type: 'class' },
];

const EDGE_PAIRS: [number, number][] = [
    [0, 1], [0, 6], [1, 2], [1, 8], [2, 3], [2, 9],
    [3, 4], [4, 14], [5, 8], [5, 14], [6, 12], [7, 0],
    [7, 1], [7, 10], [8, 15], [9, 11], [10, 15], [11, 12],
    [12, 17], [13, 5], [13, 16], [14, 9], [15, 11], [16, 2],
    [17, 6], [18, 0], [18, 7], [19, 8], [19, 2],
];

const TYPE_COLORS: Record<NodeType, { color: string; glow: string }> = {
    file: { color: '#00d9ff', glow: 'rgba(0,217,255,0.6)' },
    function: { color: '#7b61ff', glow: 'rgba(123,97,255,0.6)' },
    class: { color: '#f1e7c6', glow: 'rgba(241,231,198,0.6)' },
    import: { color: '#a2ff52', glow: 'rgba(162,255,82,0.6)' },
};

// ─── Canvas Graph Component ──────────────────────────────────────────────────

function NodeGraph() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const stateRef = useRef<{
        nodes: GraphNode[];
        edges: GraphEdge[];
        cursor: { x: number; y: number } | null;
        hoveredNode: GraphNode | null;
        raf: number;
        t: number;
    } | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Non-null aliases for use inside nested closures
        const C = ctx!;
        const CV = canvas!;
        const CO = container!;

        // Init nodes
        const W = CO.clientWidth;
        const H = CO.clientHeight;
        CV.width = W;
        CV.height = H;

        const nodes: GraphNode[] = NODE_DATA.map((d, i) => {
            const tc = TYPE_COLORS[d.type];
            const depth = 0.4 + Math.random() * 0.6;
            return {
                id: i,
                label: d.label,
                type: d.type,
                x: W * 0.1 + Math.random() * W * 0.8,
                y: H * 0.1 + Math.random() * H * 0.8,
                vx: (Math.random() - 0.5) * 0.4,
                vy: (Math.random() - 0.5) * 0.4,
                radius: (3.5 + depth * 4) * (W < 500 ? 0.75 : 1),
                depth,
                color: tc.color,
                glowColor: tc.glow,
                pulse: Math.random() * Math.PI * 2,
            };
        });

        const edges: GraphEdge[] = EDGE_PAIRS.map(([from, to]) => ({
            from,
            to,
            alpha: 0.18 + Math.random() * 0.22,
            phase: Math.random() * Math.PI * 2,
        }));

        stateRef.current = { nodes, edges, cursor: null, hoveredNode: null, raf: 0, t: 0 };

        // Physics tick
        function tick() {
            const s = stateRef.current!;
            s.t += 0.012;

            const N = s.nodes;
            const cx = s.cursor?.x ?? -9999;
            const cy = s.cursor?.y ?? -9999;

            // Forces
            for (let i = 0; i < N.length; i++) {
                const a = N[i];
                // Repulsion between all nodes
                for (let j = i + 1; j < N.length; j++) {
                    const b = N[j];
                    const dx = a.x - b.x;
                    const dy = a.y - b.y;
                    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                    const minDist = 55;
                    if (dist < minDist) {
                        const force = (minDist - dist) / minDist * 0.12;
                        const fx = (dx / dist) * force;
                        const fy = (dy / dist) * force;
                        a.vx += fx; a.vy += fy;
                        b.vx -= fx; b.vy -= fy;
                    }
                }
                // Edge attraction
                // (handled separately below for edge pairs)

                // Cursor repulsion / attraction
                const cdx = a.x - cx;
                const cdy = a.y - cy;
                const cdist = Math.sqrt(cdx * cdx + cdy * cdy) || 1;
                if (cdist < 120) {
                    const force = (120 - cdist) / 120 * 0.18;
                    a.vx += (cdx / cdist) * force;
                    a.vy += (cdy / cdist) * force;
                }

                // Center gravity
                a.vx += (W / 2 - a.x) * 0.0004;
                a.vy += (H / 2 - a.y) * 0.0004;

                // Damping
                a.vx *= 0.91;
                a.vy *= 0.91;

                // Integrate
                a.x += a.vx;
                a.y += a.vy;

                // Boundary
                const pad = 20;
                if (a.x < pad) { a.x = pad; a.vx *= -0.5; }
                if (a.x > W - pad) { a.x = W - pad; a.vx *= -0.5; }
                if (a.y < pad) { a.y = pad; a.vy *= -0.5; }
                if (a.y > H - pad) { a.y = H - pad; a.vy *= -0.5; }

                // Pulse
                a.pulse += 0.018;
            }

            // Edge spring attraction
            for (const e of s.edges) {
                const a = N[e.from];
                const b = N[e.to];
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const rest = 90;
                if (dist > rest) {
                    const force = (dist - rest) / dist * 0.018;
                    a.vx += dx * force; a.vy += dy * force;
                    b.vx -= dx * force; b.vy -= dy * force;
                }
            }
        }

        // Hovered node detection
        function findHovered(mx: number, my: number): GraphNode | null {
            const s = stateRef.current!;
            for (const n of s.nodes) {
                const dx = mx - n.x;
                const dy = my - n.y;
                if (Math.sqrt(dx * dx + dy * dy) < n.radius + 8) return n;
            }
            return null;
        }

        // Draw
        function draw() {
            const s = stateRef.current!;
            C.clearRect(0, 0, W, H);

            // Draw edges
            for (const e of s.edges) {
                const a = s.nodes[e.from];
                const b = s.nodes[e.to];
                const pulseAlpha = e.alpha * (0.6 + 0.4 * Math.sin(s.t * 1.5 + e.phase));

                const grad = C.createLinearGradient(a.x, a.y, b.x, b.y);
                grad.addColorStop(0, a.color + Math.round(pulseAlpha * 255).toString(16).padStart(2, '0'));
                grad.addColorStop(1, b.color + Math.round(pulseAlpha * 255).toString(16).padStart(2, '0'));

                C.beginPath();
                C.moveTo(a.x, a.y);
                C.lineTo(b.x, b.y);
                C.strokeStyle = grad;
                C.lineWidth = 1.1;
                C.stroke();
            }

            // Draw nodes
            for (const n of s.nodes) {
                const isHovered = s.hoveredNode?.id === n.id;
                const glowSize = n.radius * (isHovered ? 5 : 2.5 + 0.5 * Math.sin(n.pulse));
                const glowAlpha = isHovered ? 0.65 : 0.3 * n.depth;

                // Glow
                const grd = C.createRadialGradient(n.x, n.y, 0, n.x, n.y, glowSize);
                grd.addColorStop(0, n.glowColor.replace('0.6', String(glowAlpha)));
                grd.addColorStop(1, n.glowColor.replace('0.6', '0'));
                C.beginPath();
                C.arc(n.x, n.y, glowSize, 0, Math.PI * 2);
                C.fillStyle = grd;
                C.fill();

                // Core dot
                C.beginPath();
                C.arc(n.x, n.y, n.radius * (isHovered ? 1.4 : 1), 0, Math.PI * 2);
                C.fillStyle = n.color;
                C.globalAlpha = 0.5 + n.depth * 0.5;
                C.fill();
                C.globalAlpha = 1;

                // Ring on hover
                if (isHovered) {
                    C.beginPath();
                    C.arc(n.x, n.y, n.radius * 2.2, 0, Math.PI * 2);
                    C.strokeStyle = n.color + '55';
                    C.lineWidth = 1;
                    C.stroke();
                }
            }

            // Tooltip for hovered node
            const hn = s.hoveredNode;
            if (hn) {
                const pad = 9;
                const fSize = 11;
                C.font = `${fSize}px "JetBrains Mono", monospace`;
                const tw = C.measureText(hn.label).width;
                const bw = tw + pad * 2;
                const bh = fSize + pad * 2;
                let bx = hn.x + hn.radius + 10;
                let by = hn.y - bh / 2;
                if (bx + bw > W - 8) bx = hn.x - hn.radius - 10 - bw;
                if (by < 4) by = 4;
                if (by + bh > H - 4) by = H - 4 - bh;

                C.fillStyle = 'rgba(5,6,10,0.88)';
                C.beginPath();
                C.roundRect(bx, by, bw, bh, 7);
                C.fill();

                C.strokeStyle = hn.color + '55';
                C.lineWidth = 1;
                C.stroke();

                C.fillStyle = hn.color;
                C.fillText(hn.label, bx + pad, by + pad + fSize - 2);
            }
        }

        // Main loop
        function loop() {
            tick();
            draw();
            stateRef.current!.raf = requestAnimationFrame(loop);
        }
        stateRef.current!.raf = requestAnimationFrame(loop);

        // Event handlers
        function onMouseMove(e: MouseEvent) {
            const rect = CV.getBoundingClientRect();
            const mx = (e.clientX - rect.left) * (CV.width / rect.width);
            const my = (e.clientY - rect.top) * (CV.height / rect.height);
            if (stateRef.current) {
                stateRef.current.cursor = { x: mx, y: my };
                stateRef.current.hoveredNode = findHovered(mx, my);
                CV.style.cursor = stateRef.current.hoveredNode ? 'crosshair' : 'default';
            }
        }

        function onMouseLeave() {
            if (stateRef.current) {
                stateRef.current.cursor = null;
                stateRef.current.hoveredNode = null;
                CV.style.cursor = 'default';
            }
        }

        CV.addEventListener('mousemove', onMouseMove);
        CV.addEventListener('mouseleave', onMouseLeave);

        // Resize
        function onResize() {
            const nW = CO.clientWidth;
            const nH = CO.clientHeight;
            CV.width = nW;
            CV.height = nH;
        }
        const ro = new ResizeObserver(onResize);
        ro.observe(CO);

        return () => {
            if (stateRef.current) cancelAnimationFrame(stateRef.current.raf);
            CV.removeEventListener('mousemove', onMouseMove);
            CV.removeEventListener('mouseleave', onMouseLeave);
            ro.disconnect();
        };
    }, []);

    return (
        <div ref={containerRef} className="graph-container" aria-label="Interactive dependency graph">
            <canvas ref={canvasRef} className="graph-canvas" />
            <div className="graph-legend" aria-hidden="true">
                <span className="legend-item" data-type="file">file</span>
                <span className="legend-item" data-type="function">function</span>
                <span className="legend-item" data-type="class">class</span>
                <span className="legend-item" data-type="import">import</span>
            </div>
        </div>
    );
}

// ─── Capability Cards ────────────────────────────────────────────────────────

const CAPABILITIES = [
    {
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><circle cx="4" cy="6" r="2"/><circle cx="20" cy="6" r="2"/><circle cx="4" cy="18" r="2"/><circle cx="20" cy="18" r="2"/><path d="M6 6.5l4 3.5m4-3.5l4 3.5M6 17.5l4-3.5m4 3.5l4-3.5"/></svg>`,
        title: 'Dependency Graph',
        summary: 'Trace imports, runtime edges, and service boundaries.',
        detail: 'Navigate by risk, not folder. See which modules are critical, who depends on what, and where change propagates.',
        accent: '#00d9ff',
    },
    {
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7" stroke-dasharray="2 3" opacity=".5"/><circle cx="12" cy="12" r="11" stroke-dasharray="1 4" opacity=".3"/></svg>`,
        title: 'Blast Radius',
        summary: 'Quantify downstream change impact instantly.',
        detail: 'Rank affected services, packages, and critical paths with a reproducible scoring model. Know what breaks before you merge.',
        accent: '#7b61ff',
    },
    {
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`,
        title: 'Agentic Workflows',
        summary: 'Connect AI tools via MCP protocol.',
        detail: 'Search, trace, summarize diffs, and generate test plans — all from Claude Code, Cursor, or any MCP-compatible agent.',
        accent: '#a2ff52',
    },
    {
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35M11 8v3m0 0v3m0-3h3m-3 0H8"/></svg>`,
        title: 'Semantic Map',
        summary: 'Search intent, not filenames.',
        detail: 'Retrieve the right code and context fast. Ask questions in plain language and get graph-aware, ranked answers.',
        accent: '#f1e7c6',
    },
    {
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
        title: 'Local-First',
        summary: 'Run on your infra, code stays in your perimeter.',
        detail: 'Deploy on-prem or in your cloud account. Telemetry is optional. Your repositories never leave your network.',
        accent: '#00d9ff',
    },
    {
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
        title: 'Security Posture',
        summary: 'Least-privilege by default, compliance-ready.',
        detail: 'Role-based access, audit logs, and predictable auth pathways. SOC 2-ready posture with deterministic, explainable behavior.',
        accent: '#7b61ff',
    },
];

// ─── Main Landing Component ──────────────────────────────────────────────────

export default function Landing() {
    const navigate = useNavigate();
    const capabilitiesRef = useRef<HTMLDivElement>(null);
    const workflowRef = useRef<HTMLDivElement>(null);
    const cardGroupRef = useRef<HTMLDivElement>(null);

    const year = useMemo(() => String(new Date().getFullYear()), []);
    const goToApp = useCallback(() => navigate('/app'), [navigate]);

    // Scroll reveal via IntersectionObserver
    useEffect(() => {
        const observers: IntersectionObserver[] = [];

        function observe(container: HTMLElement | null, selector: string, stagger = 80) {
            if (!container) return;
            const items = container.querySelectorAll<HTMLElement>(selector);
            items.forEach((el, i) => {
                el.style.transitionDelay = `${i * stagger}ms`;
            });
            const obs = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('revealed');
                        obs.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.12 });
            items.forEach(el => obs.observe(el));
            observers.push(obs);
        }

        observe(capabilitiesRef.current, '.cap-card');
        observe(workflowRef.current, '.wf-step', 100);

        // Spotlight effect on capability cards
        const group = cardGroupRef.current;
        if (group) {
            const grp = group!;
            const cards = grp.querySelectorAll<HTMLElement>('.cap-card');
            function onGroupEnter() { grp.classList.add('group-active'); }
            function onGroupLeave() { grp.classList.remove('group-active'); }
            grp.addEventListener('mouseenter', onGroupEnter);
            grp.addEventListener('mouseleave', onGroupLeave);
            observers.push({
                disconnect: () => {
                    grp.removeEventListener('mouseenter', onGroupEnter);
                    grp.removeEventListener('mouseleave', onGroupLeave);
                }
            } as unknown as IntersectionObserver);

            // Mouse sweep on each card
            cards.forEach(card => {
                function onMove(e: MouseEvent) {
                    const rect = card.getBoundingClientRect();
                    const x = ((e.clientX - rect.left) / rect.width) * 100;
                    const y = ((e.clientY - rect.top) / rect.height) * 100;
                    card.style.setProperty('--mx', `${x}%`);
                    card.style.setProperty('--my', `${y}%`);
                }
                card.addEventListener('mousemove', onMove as EventListener);
            });
        }

        return () => observers.forEach(o => o.disconnect());
    }, []);

    // Hero heading staggered reveal on mount
    useEffect(() => {
        const words = document.querySelectorAll<HTMLElement>('.hero-word');
        words.forEach((w, i) => {
            setTimeout(() => w.classList.add('word-visible'), 100 + i * 70);
        });
    }, []);

    return (
        <div className="landing-root">
            <style>{landingCss}</style>

            {/* Animated orbs */}
            <div className="orb orb-1" aria-hidden="true" />
            <div className="orb orb-2" aria-hidden="true" />
            <div className="orb orb-3" aria-hidden="true" />

            {/* ── Nav ── */}
            <header className="nav">
                <div className="container nav-inner">
                    <a
                        className="brand"
                        href="#top"
                        aria-label="VECTRON home"
                        onClick={e => { e.preventDefault(); document.getElementById('top')?.scrollIntoView({ behavior: 'smooth' }); }}
                    >
                        <span className="brand-mark" aria-hidden="true" />
                        VECTRON
                    </a>

                    <nav className="nav-links" aria-label="Primary">
                        <a href="#capabilities">Capabilities</a>
                        <a href="#workflow">Workflow</a>
                        <a href="#security">Security</a>
                    </nav>

                    <div className="nav-actions">
                        <a className="btn ghost" href="https://github.com/LAZYGENIUS69/VECTRON" target="_blank" rel="noreferrer">GitHub</a>
                        <button type="button" className="btn primary shimmer-btn" onClick={goToApp}>
                            Launch App →
                        </button>
                    </div>
                </div>
            </header>

            {/* ── Hero ── */}
            <main id="top" className="hero">
                <div className="container hero-grid">
                    <div className="hero-copy">
                        <div className="pill">
                            <span className="dot" aria-hidden="true" />
                            Open Source • MIT-minded • MCP-ready
                        </div>

                        <h1 className="h1">
                            {['An', 'ultra-premium', 'agentic', 'view', 'of', 'your', 'codebase.'].map((w, i) => (
                                <span key={i} className={`hero-word${w === 'ultra-premium' ? ' grad' : ''}`}>
                                    {w}{' '}
                                </span>
                            ))}
                        </h1>

                        <p className="sub">
                            VECTRON turns repositories into a living system map — dependency graph, blast radius, semantic search, and MCP tools — so teams ship faster without breaking things.
                        </p>

                        <div className="cta-row">
                            <button type="button" className="btn primary shimmer-btn" onClick={goToApp}>
                                Launch VECTRON →
                            </button>
                            <a className="btn" href="#capabilities">See capabilities</a>
                        </div>

                        <div className="fineprint">
                            <span><i aria-hidden="true" /> Instant graph + AI context</span>
                            <span><i aria-hidden="true" /> Local-first deploys</span>
                            <span><i aria-hidden="true" /> Enterprise security</span>
                        </div>
                    </div>

                    {/* Interactive graph */}
                    <div className="graph-panel">
                        <div className="graph-hud">
                            <div className="hud-left">
                                <div className="lights" aria-hidden="true"><b /><b /><b /></div>
                                <span className="hud-title">VECTRON • Live Graph</span>
                            </div>
                            <div className="hud-right">
                                <div className="chip">Graph</div>
                                <div className="chip">AI</div>
                                <div className="chip">MCP</div>
                            </div>
                        </div>
                        <NodeGraph />
                        <div className="graph-footer">
                            <span>2,318 modules</span>
                            <span>8,441 edges</span>
                            <span className="graph-footer-live"><span className="live-dot" />live</span>
                        </div>
                    </div>
                </div>
            </main>

            {/* ── Capabilities ── */}
            <section id="capabilities" ref={capabilitiesRef}>
                <div className="container">
                    <div className="section-title">
                        <div>
                            <div className="kicker">Capabilities</div>
                            <h2 className="h2">High signal, low noise. Designed for teams shipping daily.</h2>
                        </div>
                        <div className="pill" style={{ borderColor: 'rgba(241,231,198,.16)', background: 'rgba(241,231,198,.06)' }}>
                            6 core capabilities
                        </div>
                    </div>

                    <div className="cap-grid" ref={cardGroupRef}>
                        {CAPABILITIES.map((cap, i) => (
                            <div
                                key={i}
                                className="cap-card"
                                style={{ '--accent': cap.accent } as React.CSSProperties}
                            >
                                <div className="cap-sweep" aria-hidden="true" />
                                <div className="cap-icon" dangerouslySetInnerHTML={{ __html: cap.icon }} />
                                <b className="cap-title">{cap.title}</b>
                                <span className="cap-summary">{cap.summary}</span>
                                <span className="cap-detail">{cap.detail}</span>
                            </div>
                        ))}
                    </div>

                    <div className="logos" aria-label="Compliance badges">
                        {['SOC 2-ready', 'SSO/SAML', 'On-prem', 'Audit logs', 'Role-based access'].map(l => (
                            <div key={l} className="logo-pill">{l}</div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Workflow ── */}
            <section id="workflow" ref={workflowRef}>
                <div className="container">
                    <div className="section-title">
                        <div>
                            <div className="kicker">Workflow</div>
                            <h2 className="h2">From repo to system map in minutes.</h2>
                        </div>
                        <button type="button" className="btn" onClick={goToApp}>Open the app</button>
                    </div>

                    <div className="wf-steps">
                        {[
                            { n: '01', title: 'Index', body: 'Upload a ZIP or provide a GitHub URL. VECTRON parses every file, function, import, and call — building a full dependency graph in seconds.' },
                            { n: '02', title: 'Explore', body: 'Navigate the interactive graph. Filter by risk, search semantically, and click any node to see its full dependency tree, callers, and AI summary.' },
                            { n: '03', title: 'Ship', body: 'Select any node to run blast radius analysis. Get a list of everything that breaks, test suggestions, and a safe change plan. Merge with confidence.' },
                        ].map((s, i) => (
                            <div key={i} className="wf-step">
                                <div className="wf-num">{s.n}</div>
                                <div className="wf-body">
                                    <b>{s.title}</b>
                                    <p>{s.body}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="cta-band">
                        <div>
                            <h3>Ready to see your codebase differently?</h3>
                            <p>Upload any repository. No account required. Results in under 30 seconds.</p>
                        </div>
                        <div className="cta-row" style={{ margin: 0 }}>
                            <button type="button" className="btn primary shimmer-btn" onClick={goToApp}>
                                Launch App →
                            </button>
                            <a className="btn ghost" href="#capabilities">Capabilities</a>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Security ── */}
            <section id="security">
                <div className="container">
                    <div className="section-title">
                        <div>
                            <div className="kicker">Security</div>
                            <h2 className="h2">Built to live inside serious organizations.</h2>
                        </div>
                        <span className="pill">No trackers by default</span>
                    </div>

                    <div className="sec-grid">
                        {[
                            { title: 'Data perimeter', body: 'Your repositories stay in your network. Deploy on-prem or in your cloud account. Code never leaves your perimeter.' },
                            { title: 'Policy controls', body: 'Role-based access, audit logs, and predictable auth pathways. Compliance-ready from day one.' },
                            { title: 'Operational clarity', body: 'Deterministic indexing + explainable traces. No black-box surprises. Every output is reproducible.' },
                        ].map((s, i) => (
                            <div key={i} className="sec-card">
                                <b>{s.title}</b>
                                <p>{s.body}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Footer ── */}
            <footer>
                <div className="container">
                    <div className="foot">
                        <div className="foot-brand">
                            <span className="brand-mark" style={{ width: 10, height: 10 }} aria-hidden="true" />
                            VECTRON
                        </div>
                        <div className="foot-links">
                            <a href="#top" onClick={e => { e.preventDefault(); document.getElementById('top')?.scrollIntoView({ behavior: 'smooth' }); }}>Home</a>
                            <span>•</span>
                            <a href="https://github.com/LAZYGENIUS69/VECTRON" target="_blank" rel="noreferrer">GitHub</a>
                            <span>•</span>
                            <button type="button" className="landing-linklike" onClick={goToApp}>App</button>
                        </div>
                        <div>© {year} • Built for speed</div>
                    </div>
                </div>
            </footer>
        </div>
    );
}

// ─── CSS ─────────────────────────────────────────────────────────────────────

const landingCss = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,600;9..144,700&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@300;400;500;600&display=swap');

:root {
  --bg0: #05060a;
  --bg1: #070814;
  --ink: rgba(255,255,255,.92);
  --muted: rgba(255,255,255,.66);
  --dim: rgba(255,255,255,.50);
  --line: rgba(255,255,255,.10);
  --line2: rgba(255,255,255,.16);
  --cyan: #00d9ff;
  --violet: #7b61ff;
  --lime: #a2ff52;
  --gold: #f1e7c6;
  --serif: "Fraunces", ui-serif, Georgia, serif;
  --sans: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
  --mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  --radius: 18px;
  --radius2: 24px;
  --container: 1160px;
  --shadow: 0 28px 120px rgba(0,0,0,.70);
  --ease: cubic-bezier(0.16, 1, 0.3, 1);
}

/* ── Base ── */
.landing-root {
  background: linear-gradient(180deg, var(--bg0), var(--bg1) 56%, #04040a 100%);
  color: var(--ink);
  font-family: var(--sans);
  height: 100vh;
  overflow-x: hidden;
  overflow-y: auto;
  position: relative;
  -webkit-font-smoothing: antialiased;
  text-rendering: geometricPrecision;
}
.landing-root * { box-sizing: border-box; }

/* Grid overlay */
.landing-root::before {
  content: "";
  position: fixed; inset: 0;
  pointer-events: none;
  background-image:
    linear-gradient(to right, rgba(255,255,255,.055) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(255,255,255,.055) 1px, transparent 1px);
  background-size: 80px 80px;
  opacity: .16;
  mask-image: radial-gradient(circle at 35% 20%, rgba(0,0,0,.95), rgba(0,0,0,.4) 55%, transparent 78%);
  z-index: 0;
}

/* Noise */
.landing-root::after {
  content: "";
  position: fixed; inset: 0;
  pointer-events: none;
  opacity: .06;
  mix-blend-mode: overlay;
  background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="3" stitchTiles="stitch"/></filter><rect width="240" height="240" filter="url(%23n)" opacity="0.35"/></svg>');
  z-index: 0;
}

.landing-root > header,
.landing-root > main,
.landing-root > section,
.landing-root > footer { position: relative; z-index: 1; }

/* Animated orbs */
.orb {
  position: fixed;
  pointer-events: none;
  border-radius: 50%;
  filter: blur(80px);
  z-index: 0;
  opacity: 0;
  animation: orbFloat 0.6s var(--ease) forwards;
}
.orb-1 {
  width: 700px; height: 700px;
  background: radial-gradient(circle, rgba(0,217,255,.12), transparent 70%);
  top: -20%; left: -10%;
  animation: orbFloat1 60s ease-in-out infinite, orbFadeIn 1.2s var(--ease) forwards;
}
.orb-2 {
  width: 600px; height: 600px;
  background: radial-gradient(circle, rgba(123,97,255,.13), transparent 70%);
  top: 5%; right: -10%;
  animation: orbFloat2 70s ease-in-out infinite, orbFadeIn 1.2s 0.2s var(--ease) forwards;
}
.orb-3 {
  width: 500px; height: 500px;
  background: radial-gradient(circle, rgba(162,255,82,.07), transparent 70%);
  bottom: 10%; left: 30%;
  animation: orbFloat3 80s ease-in-out infinite, orbFadeIn 1.2s 0.4s var(--ease) forwards;
}

@keyframes orbFadeIn { to { opacity: 1; } }
@keyframes orbFloat1 {
  0%, 100% { transform: translate(0, 0); }
  33% { transform: translate(40px, 60px); }
  66% { transform: translate(-30px, 30px); }
}
@keyframes orbFloat2 {
  0%, 100% { transform: translate(0, 0); }
  33% { transform: translate(-50px, 40px); }
  66% { transform: translate(30px, -20px); }
}
@keyframes orbFloat3 {
  0%, 100% { transform: translate(0, 0); }
  50% { transform: translate(40px, -50px); }
}

.container { width: min(100%, var(--container)); margin: 0 auto; padding: 0 28px; }

/* ── Nav ── */
.nav {
  position: sticky; top: 0; z-index: 50;
  height: 68px;
  display: flex; align-items: center;
  backdrop-filter: blur(24px);
  background: rgba(5,6,10,.6);
  border-bottom: 1px solid rgba(255,255,255,.07);
}
.nav-inner { display: flex; align-items: center; justify-content: space-between; gap: 14px; width: 100%; }

.brand {
  display: inline-flex; align-items: center; gap: 12px;
  text-decoration: none; color: rgba(255,255,255,.86);
  font-family: var(--mono); letter-spacing: .36em; font-size: 12px;
  text-transform: uppercase; white-space: nowrap;
}
.brand-mark {
  width: 12px; height: 12px; border-radius: 4px;
  background: linear-gradient(135deg, var(--cyan), var(--violet));
  box-shadow: 0 0 0 0 rgba(0,217,255,.4);
  animation: brandPulse 3s ease-in-out infinite;
  flex-shrink: 0;
}
@keyframes brandPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(0,217,255,.0), 0 0 16px rgba(0,217,255,.14); }
  50% { box-shadow: 0 0 0 5px rgba(0,217,255,.0), 0 0 28px rgba(123,97,255,.22); }
}

.nav-links { display: flex; align-items: center; gap: 18px; }
.nav-links a {
  color: var(--dim); text-decoration: none;
  font-size: 13px; letter-spacing: .08em; text-transform: uppercase;
  position: relative; padding-bottom: 2px;
  transition: color 200ms var(--ease);
}
.nav-links a::after {
  content: ""; position: absolute; bottom: 0; left: 0; right: 0;
  height: 1px;
  background: linear-gradient(90deg, var(--cyan), var(--violet));
  transform: scaleX(0); transform-origin: left;
  transition: transform 220ms var(--ease);
}
.nav-links a:hover { color: var(--ink); }
.nav-links a:hover::after { transform: scaleX(1); }

.nav-actions { display: flex; align-items: center; gap: 10px; }

/* ── Buttons ── */
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 10px;
  padding: 10px 18px; border-radius: 12px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(255,255,255,.03);
  color: var(--ink); text-decoration: none;
  font-size: 13px; letter-spacing: .06em;
  cursor: pointer; white-space: nowrap;
  transition: transform 180ms var(--ease), border-color 180ms var(--ease), background 180ms var(--ease), box-shadow 180ms var(--ease);
}
.btn:hover { transform: translateY(-2px); border-color: rgba(255,255,255,.18); background: rgba(255,255,255,.055); box-shadow: 0 8px 32px rgba(0,0,0,.3); }

.btn.primary {
  border-color: rgba(241,231,198,.22);
  background: linear-gradient(135deg, rgba(241,231,198,.14), rgba(0,217,255,.13)),
              radial-gradient(120px 60px at 20% 20%, rgba(0,217,255,.18), transparent 55%),
              radial-gradient(160px 70px at 80% 40%, rgba(123,97,255,.16), transparent 55%);
  box-shadow: 0 0 0 1px rgba(241,231,198,.14), 0 0 90px rgba(123,97,255,.13);
}
.btn.primary:hover { filter: saturate(1.15); box-shadow: 0 0 0 1px rgba(241,231,198,.22), 0 0 160px rgba(123,97,255,.18), 0 8px 40px rgba(0,0,0,.4); }
.btn.ghost { border-color: rgba(255,255,255,.10); background: rgba(255,255,255,.02); }

/* Shimmer button effect */
.shimmer-btn { position: relative; overflow: hidden; }
.shimmer-btn::after {
  content: "";
  position: absolute; inset: 0;
  background: linear-gradient(105deg, transparent 35%, rgba(255,255,255,.18) 50%, transparent 65%);
  transform: translateX(-100%);
  transition: transform 0s;
}
.shimmer-btn:hover::after {
  transform: translateX(100%);
  transition: transform 600ms var(--ease);
}

/* ── Hero ── */
.hero { padding-top: 100px; padding-bottom: 60px; }
.hero-grid {
  display: grid; grid-template-columns: 1fr 1.05fr;
  gap: 48px; align-items: center;
  min-height: calc(100vh - 160px);
}
.hero-copy { display: flex; flex-direction: column; gap: 0; }

.pill {
  display: inline-flex; align-items: center; gap: 10px;
  padding: 7px 14px; border-radius: 999px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(255,255,255,.04);
  font-family: var(--mono); font-size: 11px;
  letter-spacing: .12em; color: rgba(255,255,255,.78);
  width: fit-content;
}
.dot { width: 7px; height: 7px; border-radius: 999px; background: var(--lime); box-shadow: 0 0 18px rgba(162,255,82,.25); flex-shrink: 0; }

.h1 {
  font-family: var(--serif); font-weight: 600;
  letter-spacing: -0.025em; font-size: clamp(38px, 4vw, 68px);
  margin: 18px 0 16px; line-height: 1.04;
}

/* Staggered word reveal */
.hero-word {
  display: inline-block;
  opacity: 0; transform: translateY(18px);
  transition: opacity 500ms var(--ease), transform 500ms var(--ease);
}
.hero-word.word-visible { opacity: 1; transform: translateY(0); }

.grad {
  background: linear-gradient(135deg, rgba(241,231,198,.95) 10%, rgba(0,217,255,.88) 50%, rgba(123,97,255,.9) 90%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}

.sub { color: var(--muted); font-size: 16px; line-height: 1.72; max-width: 52ch; margin: 0 0 24px; }
.cta-row { margin-top: 20px; display: flex; gap: 12px; flex-wrap: wrap; }

.fineprint {
  display: flex; gap: 18px; color: rgba(255,255,255,.48);
  font-size: 12.5px; margin-top: 16px; flex-wrap: wrap;
}
.fineprint span { display: inline-flex; align-items: center; gap: 8px; }
.fineprint i { width: 5px; height: 5px; border-radius: 99px; background: rgba(241,231,198,.65); box-shadow: 0 0 14px rgba(241,231,198,.16); display: inline-block; flex-shrink: 0; }

/* ── Node Graph Panel ── */
.graph-panel {
  border-radius: var(--radius2);
  border: 1px solid rgba(255,255,255,.10);
  background: linear-gradient(160deg, rgba(255,255,255,.055), rgba(255,255,255,.018));
  backdrop-filter: blur(18px);
  box-shadow: var(--shadow), inset 0 1px 0 rgba(255,255,255,.08);
  overflow: hidden;
  position: relative;
}
.graph-panel::before {
  content: "";
  position: absolute; inset: -2px;
  background:
    radial-gradient(420px 240px at 20% 18%, rgba(0,217,255,.16), transparent 60%),
    radial-gradient(460px 260px at 80% 30%, rgba(123,97,255,.16), transparent 64%);
  opacity: .7; filter: blur(2px); z-index: 0; pointer-events: none;
}

.graph-hud {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255,255,255,.08);
  position: relative; z-index: 1;
  background: rgba(0,0,0,.15);
}
.hud-left { display: flex; align-items: center; gap: 10px; }
.lights { display: flex; gap: 6px; }
.lights b { width: 10px; height: 10px; border-radius: 999px; display: block; }
.lights b:nth-child(1) { background: #ff5f57; box-shadow: 0 0 10px rgba(255,95,87,.22); }
.lights b:nth-child(2) { background: #febc2e; box-shadow: 0 0 10px rgba(254,188,46,.18); }
.lights b:nth-child(3) { background: #28c840; box-shadow: 0 0 10px rgba(40,200,64,.16); }
.hud-title { font-family: var(--mono); font-size: 11px; letter-spacing: .16em; text-transform: uppercase; color: rgba(255,255,255,.65); }
.hud-right { display: flex; gap: 8px; }
.chip {
  font-family: var(--mono); font-size: 10px; letter-spacing: .12em;
  text-transform: uppercase; padding: 5px 10px; border-radius: 999px;
  border: 1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.04);
  color: rgba(255,255,255,.65);
}

.graph-container {
  width: 100%; height: 380px;
  position: relative; z-index: 1;
}
.graph-canvas { width: 100%; height: 100%; display: block; }

.graph-legend {
  position: absolute; bottom: 52px; right: 14px;
  display: flex; flex-direction: column; gap: 5px;
}
.legend-item {
  font-family: var(--mono); font-size: 9px; letter-spacing: .1em; text-transform: uppercase;
  padding: 3px 8px; border-radius: 99px;
  border: 1px solid rgba(255,255,255,.08);
  background: rgba(0,0,0,.4);
  color: rgba(255,255,255,.55);
}
.legend-item[data-type="file"] { color: #00d9ff; border-color: rgba(0,217,255,.2); }
.legend-item[data-type="function"] { color: #7b61ff; border-color: rgba(123,97,255,.2); }
.legend-item[data-type="class"] { color: #f1e7c6; border-color: rgba(241,231,198,.2); }
.legend-item[data-type="import"] { color: #a2ff52; border-color: rgba(162,255,82,.2); }

.graph-footer {
  display: flex; align-items: center; gap: 20px;
  padding: 10px 16px;
  border-top: 1px solid rgba(255,255,255,.07);
  font-family: var(--mono); font-size: 10px; letter-spacing: .12em; text-transform: uppercase;
  color: rgba(255,255,255,.45);
  position: relative; z-index: 1;
  background: rgba(0,0,0,.12);
}
.graph-footer-live { display: flex; align-items: center; gap: 6px; margin-left: auto; color: var(--lime); }
.live-dot { width: 6px; height: 6px; border-radius: 99px; background: var(--lime); animation: livePulse 2s ease-in-out infinite; }
@keyframes livePulse {
  0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(162,255,82,.5); }
  50% { opacity: .6; box-shadow: 0 0 0 4px rgba(162,255,82,.0); }
}

/* ── Capabilities Section ── */
section { padding: 60px 0; }

.section-title {
  display: flex; align-items: flex-end; justify-content: space-between;
  gap: 16px; padding-bottom: 16px;
  border-bottom: 1px solid rgba(255,255,255,.07);
  margin-bottom: 28px; flex-wrap: wrap;
}
.kicker {
  font-family: var(--mono); letter-spacing: .34em; text-transform: uppercase;
  color: rgba(241,231,198,.82); font-size: 11px; margin-bottom: 10px;
}
.h2 {
  font-family: var(--serif); font-weight: 600;
  font-size: clamp(22px, 2.2vw, 34px); margin: 0; letter-spacing: -0.02em;
}

/* Capability cards */
.cap-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }

.cap-card {
  --accent: #00d9ff;
  --mx: 50%; --my: 50%;
  position: relative; overflow: hidden;
  border-radius: 18px;
  border: 1px solid rgba(255,255,255,.09);
  background: rgba(255,255,255,.03);
  backdrop-filter: blur(14px);
  padding: 22px 20px;
  cursor: default;
  transition: border-color 300ms var(--ease), transform 300ms var(--ease), box-shadow 300ms var(--ease), opacity 300ms var(--ease);
  /* Scroll reveal */
  opacity: 0; transform: translateY(24px);
}
.cap-card.revealed { opacity: 1; transform: translateY(0); }

/* Spotlight sweep on hover */
.cap-sweep {
  position: absolute; inset: 0; pointer-events: none; z-index: 0;
  background: radial-gradient(120px 120px at var(--mx) var(--my), rgba(255,255,255,.07), transparent);
  opacity: 0; transition: opacity 200ms var(--ease);
}
.cap-card:hover .cap-sweep { opacity: 1; }

/* Hover: border glow + slight lift */
.cap-card:hover {
  border-color: color-mix(in srgb, var(--accent) 40%, transparent);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 15%, transparent),
              0 0 40px color-mix(in srgb, var(--accent) 12%, transparent),
              0 12px 48px rgba(0,0,0,.4);
  transform: translateY(-3px);
}

/* Spotlight dims siblings */
.cap-grid.group-active .cap-card:not(:hover) { opacity: 0.48; }
.cap-grid.group-active .cap-card:hover { opacity: 1; }

.cap-icon {
  width: 36px; height: 36px; margin-bottom: 14px;
  color: var(--accent); position: relative; z-index: 1;
  filter: drop-shadow(0 0 8px color-mix(in srgb, var(--accent) 40%, transparent));
  transition: filter 300ms var(--ease), transform 300ms var(--ease);
}
.cap-card:hover .cap-icon {
  filter: drop-shadow(0 0 16px color-mix(in srgb, var(--accent) 70%, transparent));
  transform: scale(1.08);
}
.cap-icon svg { width: 100%; height: 100%; }

.cap-title {
  display: block; font-size: 13px; letter-spacing: .10em;
  text-transform: uppercase; color: rgba(255,255,255,.88);
  margin-bottom: 8px; position: relative; z-index: 1;
}
.cap-summary {
  display: block; color: rgba(255,255,255,.60); line-height: 1.62; font-size: 13.5px;
  position: relative; z-index: 1;
}
.cap-detail {
  display: block; color: rgba(255,255,255,.42); font-size: 12.5px; line-height: 1.65;
  margin-top: 10px; position: relative; z-index: 1;
  max-height: 0; overflow: hidden;
  transition: max-height 350ms var(--ease), opacity 300ms var(--ease), margin-top 300ms var(--ease);
  opacity: 0;
}
.cap-card:hover .cap-detail {
  max-height: 120px; opacity: 1; margin-top: 10px;
}

/* Logos */
.logos { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 18px; }
.logo-pill {
  padding: 7px 14px; border-radius: 999px;
  border: 1px solid rgba(255,255,255,.09);
  background: rgba(0,0,0,.18);
  font-family: var(--mono); font-size: 10px;
  letter-spacing: .18em; text-transform: uppercase;
  color: rgba(255,255,255,.65);
}

/* ── Workflow ── */
.wf-steps { display: flex; flex-direction: column; gap: 0; margin-bottom: 28px; }
.wf-step {
  display: flex; gap: 28px; align-items: flex-start;
  padding: 24px 0;
  border-bottom: 1px solid rgba(255,255,255,.06);
  opacity: 0; transform: translateX(-20px);
  transition: opacity 500ms var(--ease), transform 500ms var(--ease);
}
.wf-step.revealed { opacity: 1; transform: translateX(0); }
.wf-step:last-child { border-bottom: none; }

.wf-num {
  font-family: var(--mono); font-size: 12px; letter-spacing: .22em;
  color: rgba(241,231,198,.55); min-width: 32px; padding-top: 3px;
  flex-shrink: 0;
}
.wf-body b { display: block; font-size: 15px; letter-spacing: .04em; margin-bottom: 6px; color: var(--ink); }
.wf-body p { margin: 0; color: var(--muted); font-size: 14px; line-height: 1.7; max-width: 64ch; }

/* CTA Band */
.cta-band {
  border-radius: 24px;
  border: 1px solid rgba(255,255,255,.11);
  background: linear-gradient(135deg, rgba(241,231,198,.09), rgba(0,217,255,.08), rgba(123,97,255,.08));
  padding: 28px 32px;
  display: flex; align-items: center; justify-content: space-between;
  gap: 20px; backdrop-filter: blur(18px);
  box-shadow: var(--shadow);
  flex-wrap: wrap;
  transition: background 400ms var(--ease);
}
.cta-band:hover {
  background: linear-gradient(135deg, rgba(241,231,198,.12), rgba(0,217,255,.11), rgba(123,97,255,.11));
}
.cta-band h3 { margin: 0; font-family: var(--serif); font-weight: 600; font-size: 22px; }
.cta-band p { margin: 6px 0 0; color: rgba(255,255,255,.62); max-width: 54ch; font-size: 14px; }

/* ── Security ── */
.sec-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.sec-card {
  border-radius: 18px; border: 1px solid rgba(255,255,255,.08);
  background: rgba(255,255,255,.025); padding: 22px 20px;
}
.sec-card b { display: block; font-size: 13px; letter-spacing: .10em; text-transform: uppercase; color: rgba(255,255,255,.84); margin-bottom: 10px; }
.sec-card p { margin: 0; color: rgba(255,255,255,.58); font-size: 13.5px; line-height: 1.66; }

/* ── Footer ── */
footer { padding: 32px 0 44px; color: rgba(255,255,255,.50); font-size: 13px; }
.foot {
  display: flex; align-items: center; justify-content: space-between;
  gap: 16px; border-top: 1px solid rgba(255,255,255,.07);
  padding-top: 18px; flex-wrap: wrap;
}
.foot-brand { display: flex; align-items: center; gap: 10px; font-family: var(--mono); letter-spacing: .3em; font-size: 11px; text-transform: uppercase; color: rgba(255,255,255,.75); }
.foot-links { display: flex; align-items: center; gap: 10px; }
.foot-links a, .foot-links button { color: rgba(255,255,255,.50); text-decoration: none; transition: color 160ms; }
.foot-links a:hover, .foot-links button:hover { color: var(--ink); }
.foot-links span { color: rgba(255,255,255,.22); }

/* ── Utilities ── */
.landing-linklike { border: 0; background: transparent; padding: 0; font: inherit; cursor: pointer; }

/* ── Responsive ── */
@media (max-width: 1040px) {
  .hero-grid { grid-template-columns: 1fr; min-height: auto; gap: 36px; }
  .graph-container { height: 300px; }
  .cap-grid { grid-template-columns: repeat(2, 1fr); }
  .sec-grid { grid-template-columns: 1fr; }
  .nav-links { display: none; }
}

@media (max-width: 640px) {
  .cap-grid { grid-template-columns: 1fr; }
  .cta-band { flex-direction: column; align-items: flex-start; }
  .h1 { font-size: 36px; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.001ms !important; transition-duration: 0.001ms !important; }
  .hero-word { opacity: 1 !important; transform: none !important; }
  .cap-card, .wf-step { opacity: 1 !important; transform: none !important; }
}
`;
