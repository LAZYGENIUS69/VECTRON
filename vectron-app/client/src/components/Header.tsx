interface HeaderProps {
    vectronMode: boolean;
    onToggleVectron: () => void;
    fileViewMode: boolean;
    onToggleFileView: () => void;
    onUploadNew: () => void;
    hasGraph: boolean;
    nodeCount: number;
    edgeCount: number;
    activeTab: 'graph' | 'processes' | 'ask-ai' | 'metrics' | 'report';
    onTabChange: (tab: 'graph' | 'processes' | 'ask-ai' | 'metrics' | 'report') => void;
}

export default function Header({
    vectronMode, onToggleVectron, fileViewMode, onToggleFileView, onUploadNew, hasGraph, nodeCount, edgeCount, activeTab, onTabChange,
}: HeaderProps) {
    return (
        <header className="header">
            {/* Brand */}
            <div className="header-brand">
                <span className="header-brand-dot" />
                VECTRON
                <span className="header-tagline">dependency propagation engine</span>
            </div>

            {/* Graph stats badge */}
            {hasGraph && (
                <div className="graph-badge">
                    <span>{nodeCount}</span>
                    <span className="badge-sep">nodes</span>
                    <span className="badge-div">·</span>
                    <span>{edgeCount}</span>
                    <span className="badge-sep">edges</span>
                </div>
            )}

            <div className="header-tabs" role="tablist" aria-label="Primary views">
                <button
                    className={`header-tab ${activeTab === 'graph' ? 'active' : ''}`}
                    onClick={() => onTabChange('graph')}
                    role="tab"
                    aria-selected={activeTab === 'graph'}
                >
                    GRAPH
                </button>
                <button
                    className={`header-tab ${activeTab === 'processes' ? 'active' : ''}`}
                    onClick={() => onTabChange('processes')}
                    role="tab"
                    aria-selected={activeTab === 'processes'}
                >
                    PROCESSES
                </button>
                <button
                    className={`header-tab ${activeTab === 'ask-ai' ? 'active' : ''}`}
                    onClick={() => onTabChange('ask-ai')}
                    role="tab"
                    aria-selected={activeTab === 'ask-ai'}
                >
                    ASK AI
                </button>
                <button
                    className={`header-tab ${activeTab === 'metrics' ? 'active' : ''}`}
                    onClick={() => onTabChange('metrics')}
                    role="tab"
                    aria-selected={activeTab === 'metrics'}
                >
                    METRICS
                </button>
                <button
                    className={`header-tab ${activeTab === 'report' ? 'active' : ''}`}
                    onClick={() => onTabChange('report')}
                    role="tab"
                    aria-selected={activeTab === 'report'}
                >
                    REPORT
                </button>
            </div>

            {/* Actions */}
            <div className="header-actions">
                {hasGraph && (
                    <>
                        <button
                            className={`btn ${vectronMode ? 'active' : ''}`}
                            onClick={onToggleVectron}
                            title={vectronMode ? 'Disable VECTRON simulation mode' : 'Enable VECTRON simulation mode'}
                        >
                            <span
                                className="btn-dot"
                                style={{ background: vectronMode ? '#F59E0B' : undefined }}
                            />
                            SIMULATION {vectronMode ? 'ON' : 'OFF'}
                        </button>

                        <button
                            className={`btn ${fileViewMode ? 'cyan-active' : ''}`}
                            onClick={onToggleFileView}
                            title={fileViewMode ? 'Disable automatic code file opening' : 'Enable automatic code file opening'}
                        >
                            <span className="btn-dot" />
                            FILE VIEW {fileViewMode ? 'ON' : 'OFF'}
                        </button>

                        <button className="btn" onClick={onUploadNew} title="Upload a new repository">
                            Upload New
                        </button>
                    </>
                )}
            </div>
        </header>
    );
}
