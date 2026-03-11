import type { GraphData, BlastMetrics, RiskLevel } from '../types/graph';
import { bfsDownstream } from './bfs';

/**
 * Run BFS + compute risk metrics for a selected node.
 */
export function computeBlast(graph: GraphData, startId: string): BlastMetrics {
    const { nodeIds, maxDepth, depthMap } = bfsDownstream(graph, startId);

    // Count unique impacted files
    const impactedFiles = new Set<string>();
    for (const id of nodeIds) {
        const node = graph.nodes.find(n => n.id === id);
        if (node) impactedFiles.add(node.filePath);
    }

    // Count cross-module edges within blast radius
    const blastSet = new Set([...nodeIds, startId]);
    let crossModuleEdges = 0;
    for (const edge of graph.edges) {
        if (!blastSet.has(edge.source) || !blastSet.has(edge.target)) continue;
        const srcNode = graph.nodes.find(n => n.id === edge.source);
        const tgtNode = graph.nodes.find(n => n.id === edge.target);
        if (srcNode && tgtNode && srcNode.module !== tgtNode.module) {
            crossModuleEdges++;
        }
    }

    const impactedNodes = nodeIds.size;
    const totalFiles = impactedFiles.size;

    // Numeric risk score
    const riskScore = +(
        impactedNodes * 0.5 +
        maxDepth * 0.3 +
        crossModuleEdges * 0.2
    ).toFixed(1);

    // Risk classification
    let riskLevel: RiskLevel;
    if (riskScore >= 10 || (impactedNodes >= 12 && maxDepth >= 3)) {
        riskLevel = 'CRITICAL';
    } else if (riskScore >= 5 || (impactedNodes > 6 && totalFiles >= 2)) {
        riskLevel = 'HIGH';
    } else if (riskScore >= 2 || impactedNodes > 2) {
        riskLevel = 'MEDIUM';
    } else {
        riskLevel = 'LOW';
    }

    return {
        impactedNodes,
        impactedFiles: totalFiles,
        cascadeDepth: maxDepth,
        riskLevel,
        riskScore,
        crossModuleEdges,
        nodeIds,
        depthMap,
    };
}
