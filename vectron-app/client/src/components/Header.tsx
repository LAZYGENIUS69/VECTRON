interface HeaderProps {
    vectronMode: boolean;
    onToggleVectron: () => void;
    onUploadNew: () => void;
    hasGraph: boolean;
    nodeCount: number;
    edgeCount: number;
}

export default function Header({
    vectronMode, onToggleVectron, onUploadNew, hasGraph, nodeCount, edgeCount,
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

                        <button className="btn" onClick={onUploadNew} title="Upload a new repository">
                            Upload New
                        </button>
                    </>
                )}
            </div>
        </header>
    );
}
