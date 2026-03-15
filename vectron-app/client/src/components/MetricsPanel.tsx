import type { BlastMetrics } from '../types/graph';

interface MetricsPanelProps {
    metrics: BlastMetrics | null;
    selectedLabel: string | null;
    vectronMode: boolean;
    totalNodes: number;
    totalEdges: number;
    crossModuleEdgesTotal: number;
    onTraceProcesses?: () => void;
}

const RISK_COLORS: Record<string, string> = {
    LOW: '#6EE7B7',
    MEDIUM: '#FCD34D',
    HIGH: '#FDBA74',
    CRITICAL: '#FCA5A5',
};

export default function MetricsPanel({
    metrics, selectedLabel, vectronMode,
    totalNodes, totalEdges, crossModuleEdgesTotal,
    onTraceProcesses,
}: MetricsPanelProps) {

    // Graph overview — always visible when graph is loaded
    const graphOverview = (
        <div className="panel-section">
            <div className="panel-label">Graph Overview</div>
            <div className="metrics-grid">
                <div className="metric-card">
                    <div className="metric-value">{totalNodes}</div>
                    <div className="metric-name">Total Nodes</div>
                </div>
                <div className="metric-card">
                    <div className="metric-value">{totalEdges}</div>
                    <div className="metric-name">Total Edges</div>
                </div>
                <div className="metric-card" style={{ gridColumn: 'span 2' }}>
                    <div className="metric-value" style={{ fontSize: 18 }}>{crossModuleEdgesTotal}</div>
                    <div className="metric-name">Cross-Module Edges</div>
                </div>
            </div>
        </div>
    );

    if (!vectronMode) {
        return (
            <>
                {graphOverview}
                <div className="panel-section">
                    <div className="panel-label">Simulation</div>
                    <div className="empty-state" style={{ height: 'auto', padding: 0 }}>
                        <span style={{ fontSize: 12 }}>Enable VECTRON simulation mode to analyze blast radius</span>
                    </div>
                </div>
            </>
        );
    }

    if (!metrics) {
        return (
            <>
                {graphOverview}
                <div className="panel-section">
                    <div className="panel-label">Blast Radius</div>
                    <div className="empty-state" style={{ height: 'auto', padding: 0 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            Click any node to simulate structural impact
                        </span>
                    </div>
                </div>
            </>
        );
    }

    // Compute max depth for the depth bar
    const maxD = metrics.cascadeDepth || 1;
    const depthLayers = Array.from({ length: maxD + 1 }, (_, i) => i);

    // Count nodes per layer
    const layerCounts = new Map<number, number>();
    for (const [, depth] of metrics.depthMap) {
        layerCounts.set(depth, (layerCounts.get(depth) ?? 0) + 1);
    }

    return (
        <>
            {graphOverview}
            <div className="panel-section">
                <div className="panel-label">Structural Impact Metrics</div>

                {selectedLabel && (
                    <div className="target-badge">
                        <span style={{ opacity: 0.6 }}>Target:</span> {selectedLabel}
                    </div>
                )}

                {selectedLabel && onTraceProcesses && (
                    <button
                        className="trace-process-btn"
                        onClick={onTraceProcesses}
                    >
                        [ Trace Processes -&gt; ]
                    </button>
                )}

                <div className="metrics-grid">
                    <div className="metric-card">
                        <div className="metric-value">{metrics.impactedNodes}</div>
                        <div className="metric-name">Nodes Hit</div>
                    </div>
                    <div className="metric-card">
                        <div className="metric-value">{metrics.impactedFiles}</div>
                        <div className="metric-name">Files Hit</div>
                    </div>
                    <div className="metric-card">
                        <div className="metric-value">{metrics.cascadeDepth}</div>
                        <div className="metric-name">BFS Depth</div>
                    </div>
                    <div className="metric-card">
                        <div className="metric-value">{metrics.crossModuleEdges}</div>
                        <div className="metric-name">Cross-Module</div>
                    </div>
                </div>

                {/* Risk score */}
                <div className="risk-score-row">
                    <span className="risk-score-label">Risk Score</span>
                    <span className="risk-score-value" style={{ color: RISK_COLORS[metrics.riskLevel] }}>
                        {metrics.riskScore}
                    </span>
                </div>

                {/* Depth bar */}
                <div className="depth-bar-section">
                    <div className="panel-label" style={{ marginBottom: 6 }}>Propagation Layers</div>
                    {depthLayers.map(d => {
                        const count = layerCounts.get(d) ?? 0;
                        const pct = metrics.impactedNodes > 0
                            ? (count / metrics.impactedNodes) * 100
                            : 0;
                        return (
                            <div key={d} className="depth-row">
                                <span className="depth-label">D{d}</span>
                                <div className="depth-track">
                                    <div
                                        className="depth-fill"
                                        style={{
                                            width: `${pct}%`,
                                            background: d === 0
                                                ? '#F59E0B'
                                                : d <= 2
                                                    ? '#EF4444'
                                                    : '#FDBA74',
                                            opacity: Math.max(0.4, 1 - d * 0.1),
                                        }}
                                    />
                                </div>
                                <span className="depth-count">{count}</span>
                            </div>
                        );
                    })}
                </div>

                <span className={`risk-badge risk-${metrics.riskLevel}`}>
                    <span style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: RISK_COLORS[metrics.riskLevel],
                        display: 'inline-block',
                        flexShrink: 0,
                    }} />
                    {metrics.riskLevel} RISK — {metrics.impactedNodes} node{metrics.impactedNodes !== 1 ? 's' : ''}
                </span>
            </div>
        </>
    );
}
