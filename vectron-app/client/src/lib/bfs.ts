import type { GraphData, EdgeKind } from '../types/graph';

const TRAVERSAL_EDGE_TYPES = new Set<EdgeKind>(['CALLS', 'IMPORTS']);

/**
 * BFS downstream traversal from a start node.
 * Returns:
 *  - nodeIds: Set of all reachable node IDs (excluding start)
 *  - maxDepth: the maximum BFS depth reached
 *  - depthMap: Map<nodeId, bfsDepth> for propagation animation
 */
export function bfsDownstream(
    graph: GraphData,
    startId: string
): { nodeIds: Set<string>; maxDepth: number; depthMap: Map<string, number> } {
    // Build bidirectional adjacency map — traverse both edge directions
    // so clicking a node finds all connected nodes regardless of edge direction.
    const adj = new Map<string, string[]>();
    const addEdge = (a: string, b: string) => {
        if (!adj.has(a)) adj.set(a, []);
        adj.get(a)!.push(b);
    };
    for (const edge of graph.edges) {
        if (!TRAVERSAL_EDGE_TYPES.has(edge.kind)) continue;
        addEdge(edge.source, edge.target); // forward
        addEdge(edge.target, edge.source); // backward — critical for callees with no outgoing edges
    }

    const visited = new Set<string>([startId]);
    const queue: { id: string; depth: number }[] = [{ id: startId, depth: 0 }];
    const result = new Set<string>();
    const depthMap = new Map<string, number>();
    depthMap.set(startId, 0);
    let maxDepth = 0;

    while (queue.length > 0) {
        const { id, depth } = queue.shift()!;
        if (depth > maxDepth) maxDepth = depth;

        const neighbors = adj.get(id) ?? [];
        for (const neighbor of neighbors) {
            if (visited.has(neighbor)) continue;
            visited.add(neighbor);
            result.add(neighbor);
            depthMap.set(neighbor, depth + 1);
            queue.push({ id: neighbor, depth: depth + 1 });
        }
    }

    return { nodeIds: result, maxDepth, depthMap };
}
