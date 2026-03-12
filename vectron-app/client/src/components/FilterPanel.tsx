import React from 'react';

interface FilterPanelProps {
    nodeFilters: Record<string, boolean>;
    setNodeFilters: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
    edgeFilters: Record<string, boolean>;
    setEdgeFilters: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
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
        onClick={onClick}
        style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            userSelect: 'none',
            padding: '4px 0',
            fontFamily: 'var(--mono)',
            fontSize: '11px',
            transition: 'opacity 0.2s',
            opacity: active ? 1 : 0.4
        }}
    >
        <div style={{
            width: '32px',
            height: '14px',
            background: active ? 'rgba(0, 217, 255, 0.15)' : '#1F2937',
            border: `1px solid ${active ? '#00D9FF' : '#374151'}`,
            borderRadius: '2px',
            position: 'relative',
            transition: 'all 0.2s'
        }}>
            <div style={{
                position: 'absolute',
                top: '2px',
                left: active ? '18px' : '2px',
                width: '8px',
                height: '8px',
                background: active ? '#00D9FF' : '#64748B',
                boxShadow: active ? '0 0 8px #00D9FF' : 'none',
                transition: 'all 0.2s'
            }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {color && <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />}
            <span style={{ color: active ? '#E4E4ED' : '#64748B' }}>{active ? '[ON]' : '[OFF]'}</span>
        </div>
    </div>
);

export default function FilterPanel({ nodeFilters, setNodeFilters, edgeFilters, setEdgeFilters }: FilterPanelProps) {
    const [isCollapsed, setIsCollapsed] = React.useState(false);

    const toggleNode = (id: string) => {
        setNodeFilters(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const toggleEdge = (id: string) => {
        setEdgeFilters(prev => ({ ...prev, [id]: !prev[id] }));
    };

    return (
        <div style={{ 
            borderTop: '1px solid var(--border)', 
            background: 'var(--surface)',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0
        }}>
            <div 
                onClick={() => setIsCollapsed(!isCollapsed)}
                style={{
                    padding: '10px 16px',
                    fontSize: '10px',
                    fontWeight: 700,
                    letterSpacing: '0.15em',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    userSelect: 'none',
                    background: 'rgba(255,255,255,0.02)'
                }}
            >
                <span>FILTERS</span>
                <span style={{ fontSize: '12px' }}>{isCollapsed ? '+' : '−'}</span>
            </div>

            {!isCollapsed && (
                <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                        <div style={{ 
                            fontSize: '9px', 
                            color: '#00D9FF', 
                            marginBottom: '10px', 
                            fontWeight: 600, 
                            letterSpacing: '0.1em' 
                        }}>NODE TYPES</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {NODE_TYPES.map(type => (
                                <div key={type.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--mono)' }}>{type.label}</span>
                                    <TerminalSwitch 
                                        active={!!nodeFilters[type.id]} 
                                        onClick={() => toggleNode(type.id)}
                                        color={type.color}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
                        <div style={{ 
                            fontSize: '9px', 
                            color: '#00D9FF', 
                            marginBottom: '10px', 
                            fontWeight: 600, 
                            letterSpacing: '0.1em' 
                        }}>EDGE TYPES</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {EDGE_TYPES.map(type => (
                                <div key={type.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--mono)' }}>{type.label}</span>
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
