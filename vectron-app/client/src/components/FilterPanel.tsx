import React from 'react';

interface FilterPanelProps {
    nodeFilters: Record<string, boolean>;
    setNodeFilters: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
    edgeFilters: Record<string, boolean>;
    setEdgeFilters: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
    hideHeader?: boolean;
}

const NODE_TYPES = [
    { id: 'file', label: 'File', color: '#FF2D55' },
    { id: 'function', label: 'Function', color: '#00C7BE' },
    { id: 'class', label: 'Class', color: '#FF9F0A' },
    { id: 'method', label: 'Method', color: '#30D158' },
    { id: 'import', label: 'Import', color: '#636366' },
];

const EDGE_TYPES = [
    { id: 'DEFINES', label: 'DEFINES' },
    { id: 'IMPORTS', label: 'IMPORTS' },
    { id: 'CALLS', label: 'CALLS' },
    { id: 'EXTENDS', label: 'EXTENDS' },
    { id: 'CONTAINS', label: 'CONTAINS' },
];

const TerminalSwitch = ({ active, onClick, color }: { active: boolean, onClick: () => void, color?: string }) => (
    <div
        className="filter-switch"
        onClick={onClick}
        style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer',
            userSelect: 'none',
            padding: 0,
            fontFamily: "'Segoe UI', system-ui, sans-serif",
            fontSize: '11px'
        }}
    >
        <div
            className="filter-switch-track"
            style={{
                width: '28px',
                height: '14px',
                background: active ? '#0078d4' : '#3c3c3c',
                border: active ? 'none' : '1px solid #555555',
                borderRadius: '7px',
                position: 'relative',
                transition: 'all 0.2s'
            }}
        >
            <div
                className="filter-switch-thumb"
                style={{
                    position: 'absolute',
                    top: '2px',
                    left: active ? '16px' : '2px',
                    width: '10px',
                    height: '10px',
                    background: '#ffffff',
                    borderRadius: '50%',
                    transition: 'all 0.2s'
                }}
            />
        </div>
        <div className="filter-switch-meta" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {color && <div className="filter-color-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />}
            <span className="filter-switch-state" style={{ color: '#858585', fontSize: '10px' }}>{active ? '[ON]' : '[OFF]'}</span>
        </div>
    </div>
);

export default function FilterPanel({ nodeFilters, setNodeFilters, edgeFilters, setEdgeFilters, hideHeader = false }: FilterPanelProps) {
    const [isCollapsed, setIsCollapsed] = React.useState(false);

    const toggleNode = (id: string) => {
        setNodeFilters(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const toggleEdge = (id: string) => {
        setEdgeFilters(prev => ({ ...prev, [id]: !prev[id] }));
    };

    return (
        <div
            className="filter-panel"
            style={{
                borderTop: hideHeader ? 'none' : '1px solid #2d2d2d',
                background: '#1e1e1e',
                display: 'flex',
                flexDirection: 'column',
                flexShrink: 0
            }}
        >
            {!hideHeader && (
                <div
                    className="filter-panel-header"
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    style={{
                        padding: '8px 12px',
                        fontSize: '11px',
                        fontWeight: 700,
                        letterSpacing: '0.1em',
                        color: '#bbbbbb',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        userSelect: 'none',
                        background: '#1e1e1e',
                        borderBottom: '1px solid #2d2d2d'
                    }}
                >
                    <span>FILTERS</span>
                    <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#858585' }}>{isCollapsed ? '\u25B8' : '\u25BE'}</span>
                </div>
            )}

            {(!isCollapsed || hideHeader) && (
                <div className="filter-panel-content" style={{ padding: '6px 0 8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div>
                        <div
                            className="filter-group-title"
                            style={{
                                fontSize: '11px',
                                color: '#858585',
                                marginBottom: '2px',
                                fontWeight: 600,
                                letterSpacing: '0.08em',
                                padding: '10px 12px 4px'
                            }}
                        >
                            NODE TYPES
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                            {NODE_TYPES.map(type => (
                                <div key={type.id} className="filter-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 12px', height: '24px' }}>
                                    <div className="filter-label-wrap" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div className="filter-color-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: type.color, flexShrink: 0 }} />
                                        <span className="filter-label" style={{ fontSize: '12px', color: '#cccccc', fontFamily: "'Segoe UI', system-ui, sans-serif" }}>{type.label}</span>
                                    </div>
                                    <TerminalSwitch
                                        active={!!nodeFilters[type.id]}
                                        onClick={() => toggleNode(type.id)}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="filter-group-divider" style={{ borderTop: '1px solid #2d2d2d', paddingTop: '6px' }}>
                        <div
                            className="filter-group-title"
                            style={{
                                fontSize: '11px',
                                color: '#858585',
                                marginBottom: '2px',
                                fontWeight: 600,
                                letterSpacing: '0.08em',
                                padding: '10px 12px 4px'
                            }}
                        >
                            EDGE TYPES
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                            {EDGE_TYPES.map(type => (
                                <div key={type.id} className="filter-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 12px', height: '24px' }}>
                                    <span className="filter-label" style={{ fontSize: '12px', color: '#cccccc', fontFamily: "'Segoe UI', system-ui, sans-serif" }}>{type.label}</span>
                                    <TerminalSwitch
                                        active={!!edgeFilters[type.id]}
                                        onClick={() => toggleEdge(type.id)}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
