import path from 'path';
import { parseFile } from './parser';

// ── Public types ─────────────────────────────────────────────────────────────
export type NodeKind = 'file' | 'function';
export type EdgeKind = 'IMPORTS' | 'CALLS' | 'CONTAINS' | 'DEFINES' | 'EXTENDS';

export interface GraphNode {
    id: string;
    label: string;
    type: 'file' | 'function' | 'class' | 'method' | 'import';
    fileId: string;
    filePath: string;
    startLine?: number;
    endLine?: number;
    centrality: number;   // degree centrality 0–1
    module: string;       // top-level folder/group name
}

export interface GraphEdge {
    id: string;
    source: string;
    target: string;
    kind: EdgeKind;
}

export interface GraphData {
    nodes: GraphNode[];
    edges: GraphEdge[];
    crossModuleEdges: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
let _seq = 0;
function uid(prefix: string): string {
    return `${prefix}_${++_seq}`;
}

/**
 * Extract top-level module name from a file path.
 * e.g. "src/components/Foo.tsx" → "components"
 *      "index.ts"               → "root"
 */
function extractModule(filePath: string): string {
    const parts = filePath.replace(/\\/g, '/').split('/');
    // Return the very first directory segment — this is the top-level module
    // e.g. 'my-lib/src/hooks/useAuth.ts' → 'my-lib'
    // e.g. 'src/components/Foo.tsx' → 'src'
    // e.g. 'index.ts' → 'root'
    if (parts.length > 1) return parts[0];
    return 'root';
}

/**
 * Resolve an import specifier (relative or bare) against the importing file,
 * and return the canonical file path as it would appear in our node map.
 */
function resolveImport(importerPath: string, specifier: string, knownPaths: Set<string>): string | null {
    // Bare module import — skip (we only track project-internal deps)
    if (!specifier.startsWith('.')) return null;

    const base = path.dirname(importerPath);
    const resolved = path.join(base, specifier).replace(/\\/g, '/');

    // Try with common extensions
    const candidates = [
        resolved,
        `${resolved}.ts`,
        `${resolved}.tsx`,
        `${resolved}.js`,
        `${resolved}.jsx`,
        `${resolved}/index.ts`,
        `${resolved}/index.tsx`,
        `${resolved}/index.js`,
    ];

    for (const c of candidates) {
        if (knownPaths.has(c)) return c;
    }

    return null;
}

// ── Main builder ─────────────────────────────────────────────────────────────
export function buildGraph(files: { path: string; content: string }[]): GraphData {
    _seq = 0;
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    // ── Pass 1: create file nodes + parse ────────────────────────────────────
    const fileNodeMap = new Map<string, string>(); // filePath → nodeId
    const knownPaths = new Set(files.map(f => f.path));

    for (const file of files) {
        const nodeId = uid('file');
        const mod = extractModule(file.path);
        fileNodeMap.set(file.path, nodeId);
        nodes.push({
            id: nodeId,
            label: path.basename(file.path),
            type: 'file',
            fileId: file.path,
            filePath: file.path,
            centrality: 0, // computed in pass 4
            module: mod,
        });
    }

    // ── Pass 2: parse + create function nodes + edges ─────────────────────────
    // Map: function name → array of node IDs (same name can exist in multiple files)
    const fnNameToIds = new Map<string, string[]>();

    for (const file of files) {
        const parsed = parseFile(file.path, file.content);
        if (!parsed) continue;

        const fileNodeId = fileNodeMap.get(file.path)!;
        const mod = (nodes.find(n => n.id === fileNodeId)?.module) ?? 'root';

        // Nodes
        for (const n of parsed.nodes) {
            const nId = uid('node');
            nodes.push({
                id: nId,
                label: n.name,
                type: n.type,
                fileId: file.path,
                filePath: file.path,
                startLine: n.startLine,
                endLine: n.endLine,
                centrality: 0,
                module: mod,
            });

            if (!fnNameToIds.has(n.name)) fnNameToIds.set(n.name, []);
            fnNameToIds.get(n.name)!.push(nId);

            // DEFINES edge: file → function/class/method
            // This creates the branching tree structure that makes
            // This creates the branching tree structure (tight clusters around files)
            if (n.type !== 'import') {
                edges.push({
                    id: uid('e'),
                    source: fileNodeId,
                    target: nId,
                    kind: 'DEFINES',
                });
            }
        }

        // IMPORTS edges (file → file)
        for (const specifier of parsed.imports) {
            const targetPath = resolveImport(file.path, specifier, knownPaths);
            if (!targetPath) continue;
            const targetId = fileNodeMap.get(targetPath);
            if (!targetId || targetId === fileNodeId) continue;

            edges.push({
                id: uid('e'),
                source: fileNodeId,
                target: targetId,
                kind: 'IMPORTS',
            });
        }

        // Stash callees for pass 3
        (file as { path: string; content: string } & { _callees?: string[]; _fileNodeId?: string })._callees = parsed.callees;
        (file as { path: string; content: string } & { _callees?: string[]; _fileNodeId?: string })._fileNodeId = fileNodeId;
    }

    // ── Pass 3: CALLS edges (function → function by name) ────────────────────
    for (const file of files) {
        const f = file as { path: string; content: string } & { _callees?: string[]; _fileNodeId?: string };
        if (!f._callees || !f._fileNodeId) continue;

        const sourceFnIds = nodes
            .filter(n => n.type !== 'file' && n.type !== 'import' && n.filePath === file.path)
            .map(n => n.id);

        for (const callee of f._callees) {
            const targetIds = fnNameToIds.get(callee);
            if (!targetIds) continue;

            for (const sourceId of sourceFnIds) {
                for (const targetId of targetIds) {
                    if (sourceId === targetId) continue;
                    edges.push({
                        id: uid('e'),
                        source: sourceId,
                        target: targetId,
                        kind: 'CALLS',
                    });
                }
            }
        }
    }

    // ── Pass 4: compute degree centrality ────────────────────────────────────
    const N = nodes.length;
    const outDegree = new Map<string, number>();
    for (const node of nodes) outDegree.set(node.id, 0);
    for (const edge of edges) {
        outDegree.set(edge.source, (outDegree.get(edge.source) ?? 0) + 1);
    }

    const maxDegree = Math.max(1, ...outDegree.values());
    for (const node of nodes) {
        node.centrality = N > 1
            ? (outDegree.get(node.id) ?? 0) / maxDegree
            : 0;
    }

    // ── Pass 5: count cross-module edges ─────────────────────────────────────
    const nodeModuleMap = new Map<string, string>();
    for (const node of nodes) nodeModuleMap.set(node.id, node.module);

    let crossModuleEdges = 0;
    for (const edge of edges) {
        const srcMod = nodeModuleMap.get(edge.source);
        const tgtMod = nodeModuleMap.get(edge.target);
        if (srcMod && tgtMod && srcMod !== tgtMod) crossModuleEdges++;
    }

    return { nodes, edges, crossModuleEdges };
}
