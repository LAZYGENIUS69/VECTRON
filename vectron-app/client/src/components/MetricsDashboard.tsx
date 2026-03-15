import { useMemo } from 'react';
import type { GraphData, GraphNode } from '../types/graph';

interface MetricsDashboardProps {
    graph: GraphData;
}

interface NodeMetricRow {
    node: GraphNode;
    inDegree: number;
    outDegree: number;
    connections: number;
    weightedConnections: number;
    riskScore: number;
    status: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

const TYPE_COLORS: Record<string, string> = {
    file: '#FF2D55',
    function: '#00C7BE',
    class: '#FF9F0A',
    method: '#30D158',
};

const TYPE_LABELS: Array<GraphNode['type']> = ['file', 'function', 'class', 'method'];

function truncateLabel(label: string, maxLength: number) {
    return label.length > maxLength ? `${label.slice(0, maxLength - 1)}…` : label;
}

function getBarColor(connections: number) {
    if (connections > 20) return '#FF453A';
    if (connections > 10) return '#FF9F0A';
    return '#30D158';
}

function getStatus(score: number): NodeMetricRow['status'] {
    if (score > 75) return 'CRITICAL';
    if (score > 50) return 'HIGH';
    if (score > 25) return 'MEDIUM';
    return 'LOW';
}

export default function MetricsDashboard({ graph }: MetricsDashboardProps) {
    const metrics = useMemo(() => {
        const incoming = new Map<string, number>();
        const outgoing = new Map<string, number>();

        graph.nodes.forEach((node) => {
            incoming.set(node.id, 0);
            outgoing.set(node.id, 0);
        });

        graph.edges.forEach((edge) => {
            outgoing.set(edge.source, (outgoing.get(edge.source) ?? 0) + 1);
            incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
        });

        const baseRows = graph.nodes.map((node) => {
            const inDegree = incoming.get(node.id) ?? 0;
            const outDegree = outgoing.get(node.id) ?? 0;
            const connections = inDegree + outDegree;
            const weightedConnections = inDegree * 2 + outDegree;

            return {
                node,
                inDegree,
                outDegree,
                connections,
                weightedConnections,
            };
        });

        const maxDegree = Math.max(
            1,
            ...baseRows.map((row) => row.connections),
        );

        const riskRows: NodeMetricRow[] = baseRows
            .map((row) => {
                const riskScore = Number(((row.weightedConnections / maxDegree) * 100).toFixed(1));
                return {
                    ...row,
                    riskScore,
                    status: getStatus(riskScore),
                };
            })
            .sort((a, b) => b.riskScore - a.riskScore || b.connections - a.connections);

        const topConnected = [...riskRows].sort((a, b) => b.connections - a.connections);
        const totalConnections = riskRows.reduce((sum, row) => sum + row.connections, 0);
        const typeDistribution = TYPE_LABELS.map((type) => ({
            type,
            label: type[0].toUpperCase() + type.slice(1),
            value: graph.nodes.filter((node) => node.type === type).length,
            color: TYPE_COLORS[type],
        }));

        return {
            mostConnected: topConnected[0] ?? null,
            averageConnections: graph.nodes.length === 0 ? 0 : totalConnections / graph.nodes.length,
            topConnected: topConnected.slice(0, 10),
            typeDistribution,
            riskRows: riskRows.slice(0, 20),
        };
    }, [graph]);

    const maxConnections = Math.max(1, ...metrics.topConnected.map((row) => row.connections));
    const donutTotal = Math.max(
        1,
        metrics.typeDistribution.reduce((sum, item) => sum + item.value, 0),
    );
    const donutRadius = 84;
    const donutCircumference = 2 * Math.PI * donutRadius;
    let donutOffset = 0;

    return (
        <div className="metrics-dashboard">
            <div className="metrics-dashboard-grid">
                <section className="metrics-card stats-card">
                    <span className="metrics-card-label">Total Nodes</span>
                    <strong className="metrics-card-value">{graph.nodes.length}</strong>
                </section>
                <section className="metrics-card stats-card">
                    <span className="metrics-card-label">Total Edges</span>
                    <strong className="metrics-card-value">{graph.edges.length}</strong>
                </section>
                <section className="metrics-card stats-card">
                    <span className="metrics-card-label">Most Connected Node</span>
                    <strong className="metrics-card-detail">
                        {metrics.mostConnected ? truncateLabel(metrics.mostConnected.node.label, 26) : 'None'}
                    </strong>
                    <span className="metrics-card-meta">
                        {metrics.mostConnected ? `${metrics.mostConnected.connections} connections` : '0 connections'}
                    </span>
                </section>
                <section className="metrics-card stats-card">
                    <span className="metrics-card-label">Average Connections per Node</span>
                    <strong className="metrics-card-value">{metrics.averageConnections.toFixed(1)}</strong>
                </section>
            </div>

            <div className="metrics-dashboard-row">
                <section className="metrics-panel-card metrics-chart-card">
                    <div className="metrics-section-header">
                        <h3>Top 10 Most Connected Nodes</h3>
                    </div>
                    <svg className="metrics-bar-chart" viewBox="0 0 640 360" role="img" aria-label="Top connected nodes">
                        <rect x="0" y="0" width="640" height="360" rx="16" fill="rgba(3, 10, 19, 0.75)" />
                        {metrics.topConnected.map((row, index) => {
                            const y = 28 + index * 31;
                            const barWidth = (row.connections / maxConnections) * 260;
                            const color = getBarColor(row.connections);

                            return (
                                <g key={row.node.id}>
                                    <text x="24" y={y + 14} fill="#E6FBFF" fontSize="11" fontFamily="var(--mono)">
                                        {truncateLabel(row.node.label, 26)}
                                    </text>
                                    <text x="24" y={y + 26} fill="#7C8DA6" fontSize="9" fontFamily="var(--mono)">
                                        {row.node.type}
                                    </text>
                                    <rect x="250" y={y} width="320" height="16" rx="8" fill="rgba(255,255,255,0.06)" />
                                    <rect x="250" y={y} width={barWidth} height="16" rx="8" fill={color} />
                                    <text x="580" y={y + 12} fill="#F8FAFC" fontSize="10" textAnchor="end" fontFamily="var(--mono)">
                                        {row.connections}
                                    </text>
                                </g>
                            );
                        })}
                    </svg>
                </section>

                <section className="metrics-panel-card metrics-chart-card">
                    <div className="metrics-section-header">
                        <h3>Node Type Distribution</h3>
                    </div>
                    <div className="metrics-donut-wrap">
                        <svg className="metrics-donut-chart" viewBox="0 0 260 260" role="img" aria-label="Node type distribution">
                            <circle
                                cx="130"
                                cy="130"
                                r={donutRadius}
                                stroke="rgba(255,255,255,0.08)"
                                strokeWidth="30"
                                fill="none"
                            />
                            {metrics.typeDistribution.map((slice) => {
                                const sliceLength = (slice.value / donutTotal) * donutCircumference;
                                const circle = (
                                    <circle
                                        key={slice.type}
                                        cx="130"
                                        cy="130"
                                        r={donutRadius}
                                        stroke={slice.color}
                                        strokeWidth="30"
                                        fill="none"
                                        strokeDasharray={`${sliceLength} ${donutCircumference - sliceLength}`}
                                        strokeDashoffset={-donutOffset}
                                        strokeLinecap="butt"
                                        transform="rotate(-90 130 130)"
                                    />
                                );
                                donutOffset += sliceLength;
                                return circle;
                            })}
                            <text x="130" y="124" textAnchor="middle" fill="#E6FBFF" fontSize="16" fontFamily="var(--mono)">
                                {graph.nodes.length}
                            </text>
                            <text x="130" y="146" textAnchor="middle" fill="#7C8DA6" fontSize="10" fontFamily="var(--mono)">
                                total nodes
                            </text>
                        </svg>

                        <div className="metrics-donut-legend">
                            {metrics.typeDistribution.map((slice) => (
                                <div key={slice.type} className="metrics-legend-item">
                                    <span className="metrics-legend-dot" style={{ background: slice.color }} />
                                    <span>{slice.label}</span>
                                    <strong>{slice.value}</strong>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            </div>

            <section className="metrics-panel-card metrics-risk-card">
                <div className="metrics-section-header">
                    <h3>Risk Table</h3>
                </div>

                <div className="metrics-risk-table-wrap">
                    <table className="metrics-risk-table">
                        <thead>
                            <tr>
                                <th>Node</th>
                                <th>Type</th>
                                <th>Connections</th>
                                <th>Risk Score</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {metrics.riskRows.map((row) => (
                                <tr key={row.node.id}>
                                    <td title={row.node.label}>{truncateLabel(row.node.label, 38)}</td>
                                    <td>{row.node.type}</td>
                                    <td>{row.connections}</td>
                                    <td>{row.riskScore.toFixed(1)}</td>
                                    <td>
                                        <span className={`metrics-status-pill status-${row.status.toLowerCase()}`}>
                                            {row.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}
