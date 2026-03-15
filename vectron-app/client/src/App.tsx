import { useState, useCallback, useEffect } from 'react';
import type { GraphData } from './types/graph';
import { computeBlast } from './lib/risk';
import Header from './components/Header';
import UploadZone from './components/UploadZone';
import DependencyCanvas from './components/GraphView2D';
import MetricsPanel from './components/MetricsPanel';
import PromptPanel from './components/PromptPanel';
import ExplorerPanel from './components/ExplorerPanel';
import CodeInspector from './components/CodeInspector';
import FilterPanel from './components/FilterPanel';
import QueryPanel from './components/QueryPanel';
import ProcessPanel from './components/ProcessPanel';
import ReportModal from './components/ReportModal';
import MetricsDashboard from './components/MetricsDashboard';

type AppTab = 'graph' | 'processes' | 'ask-ai' | 'metrics' | 'report';
type LeftSidebarTab = 'explorer' | 'filters';

export default function App() {
    const [graph, setGraph] = useState<GraphData | null>(null);
    const [activeTab, setActiveTab] = useState<AppTab>('graph');
    const [leftSidebarTab, setLeftSidebarTab] = useState<LeftSidebarTab>('explorer');
    const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
    const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
    const [selectedNodeForProcess, setSelectedNodeForProcess] = useState<string | null>(null);
    const [vectronMode, setVectronMode] = useState(false);
    const [fileViewMode, setFileViewMode] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [focusedFileId, setFocusedFileId] = useState<string | null>(null);
    const [inspectorOpen, setInspectorOpen] = useState(false);
    const [queryNodeIds, setQueryNodeIds] = useState<Set<string>>(new Set());

    const [nodeFilters, setNodeFilters] = useState<Record<string, boolean>>({
        file: true,
        function: true,
        class: true,
        method: true,
        import: false
    });
    const [edgeFilters, setEdgeFilters] = useState<Record<string, boolean>>({
        DEFINES: true,
        IMPORTS: true,
        CALLS: true,
        EXTENDS: true,
        CONTAINS: false
    });

    useEffect(() => {
        (window as Window & { setGraphDebug?: (data: GraphData) => void }).setGraphDebug = (data: GraphData) => setGraph(data);
    }, []);

    const blast = selectedId && graph && vectronMode
        ? computeBlast(graph, selectedId)
        : null;

    const selectedNode = selectedId
        ? graph?.nodes.find((node) => node.id === selectedId) ?? null
        : null;

    const handleNodeClick = useCallback((id: string) => {
        if (!id) {
            setSelectedId(null);
            setSelectedNodeForProcess(null);
            setInspectorOpen(false);
            return;
        }

        setSelectedId(id);
        const node = graph?.nodes.find((item) => item.id === id);
        if (node?.fileId) setFocusedFileId(node.fileId);
        setSelectedNodeForProcess(node?.label ?? null);

        if (!fileViewMode) {
            setInspectorOpen(false);
        }
    }, [fileViewMode, graph]);

    const handleFileView = useCallback((id: string) => {
        const node = graph?.nodes.find((item) => item.id === id);
        if (!node?.fileId) return;

        setSelectedId(node.id);
        setFocusedFileId(node.fileId);
        setSelectedNodeForProcess(node.label);
        setInspectorOpen(true);
    }, [graph]);

    const handleFileClick = useCallback((fileId: string) => {
        setFocusedFileId(fileId);
        const fileNode = graph?.nodes.find((node) => node.type === 'file' && node.fileId === fileId);
        if (fileNode) {
            setSelectedId(fileNode.id);
            setSelectedNodeForProcess(fileNode.label);
            setInspectorOpen(true);
        }
    }, [graph]);

    const handleGraph = useCallback((data: GraphData) => {
        setGraph(data);
        setActiveTab('graph');
        setSelectedId(null);
        setFocusedFileId(null);
        setVectronMode(false);
        setFileViewMode(false);
        setInspectorOpen(false);
        setQueryNodeIds(new Set());
        setSelectedNodeForProcess(null);
        setLeftSidebarTab('explorer');
        setLeftSidebarOpen(true);
        setRightSidebarOpen(true);
    }, []);

    const handleUploadNew = useCallback(() => {
        setGraph(null);
        setActiveTab('graph');
        setSelectedId(null);
        setFocusedFileId(null);
        setVectronMode(false);
        setFileViewMode(false);
        setInspectorOpen(false);
        setQueryNodeIds(new Set());
        setSelectedNodeForProcess(null);
        setLeftSidebarTab('explorer');
        setLeftSidebarOpen(true);
        setRightSidebarOpen(true);
    }, []);

    const handleTraceProcesses = useCallback(() => {
        if (!selectedNode?.label) return;
        setSelectedNodeForProcess(selectedNode.label);
        setActiveTab('processes');
    }, [selectedNode]);

    const handleQueryResult = (nodeIds: string[]) => {
        setQueryNodeIds(new Set(nodeIds));
    };

    const handleClearQuery = () => {
        setQueryNodeIds(new Set());
    };

    const handleBackToGraph = useCallback(() => {
        setSelectedId(null);
        setFocusedFileId(null);
        setInspectorOpen(false);
        setSelectedNodeForProcess(null);
        setQueryNodeIds(new Set());
    }, []);

    const emptyTabState = (
        <div className="tab-page-shell">
            <div className="tab-empty-state">
                Upload a repository on the GRAPH tab to unlock this workspace.
            </div>
        </div>
    );

    const graphTab = (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
            {graph && leftSidebarOpen && (
                <div className="explorer-panel workspace-sidebar">
                    <div className="workspace-sidebar-tabs">
                        <button
                            type="button"
                            className={`workspace-sidebar-tab ${leftSidebarTab === 'explorer' ? 'active' : ''}`}
                            onClick={() => setLeftSidebarTab('explorer')}
                        >
                            Explorer
                        </button>
                        <button
                            type="button"
                            className={`workspace-sidebar-tab ${leftSidebarTab === 'filters' ? 'active' : ''}`}
                            onClick={() => setLeftSidebarTab('filters')}
                        >
                            Filters
                        </button>
                        <button
                            type="button"
                            className="workspace-sidebar-tab-icon"
                            aria-label="Close left panel"
                            onClick={() => setLeftSidebarOpen(false)}
                        >
                            <span />
                            <span />
                        </button>
                    </div>

                    <div className="workspace-sidebar-body">
                        {leftSidebarTab === 'explorer' ? (
                            <ExplorerPanel
                                nodes={graph.nodes}
                                focusedFileId={focusedFileId}
                                onFileClick={handleFileClick}
                            />
                        ) : (
                            <FilterPanel
                                nodeFilters={nodeFilters}
                                setNodeFilters={setNodeFilters}
                                edgeFilters={edgeFilters}
                                setEdgeFilters={setEdgeFilters}
                                hideHeader
                            />
                        )}
                    </div>

                    <div className="workspace-sidebar-footer">
                        <div className="workspace-sidebar-counts">
                            <span>{graph.nodes.length} nodes</span>
                            <span>{graph.edges.length} edges</span>
                        </div>
                        <div className="workspace-sidebar-status">
                            <span className="workspace-sidebar-status-dot" />
                            Ready
                        </div>
                    </div>
                </div>
            )}

            <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minWidth: 0 }}>
                {!graph ? (
                    <UploadZone onGraph={handleGraph} />
                ) : (
                    <>
                        {!leftSidebarOpen && (
                            <button
                                type="button"
                                className="graph-edge-toggle graph-edge-toggle-left"
                                aria-label="Open left panel"
                                onClick={() => setLeftSidebarOpen(true)}
                            >
                                <span className="graph-edge-toggle-arrow" aria-hidden="true">
                                    &#8250;
                                </span>
                                <span className="graph-edge-toggle-label">Explorer</span>
                            </button>
                        )}

                        {!rightSidebarOpen && (
                            <button
                                type="button"
                                className="graph-edge-toggle graph-edge-toggle-right"
                                aria-label="Open right panel"
                                onClick={() => setRightSidebarOpen(true)}
                            >
                                <span className="graph-edge-toggle-label">Insights</span>
                                <span className="graph-edge-toggle-arrow" aria-hidden="true">
                                    &#8249;
                                </span>
                            </button>
                        )}

                        <DependencyCanvas
                            data={graph}
                            vectronMode={vectronMode}
                            fileViewMode={fileViewMode}
                            blastIds={blast?.nodeIds ?? new Set<string>()}
                            depthMap={blast?.depthMap ?? new Map<string, number>()}
                            selectedId={selectedId}
                            focusedFileId={focusedFileId}
                            onNodeClick={handleNodeClick}
                            onFileView={handleFileView}
                            nodeFilters={nodeFilters}
                            edgeFilters={edgeFilters}
                            queryIds={queryNodeIds}
                        />
                    </>
                )}
            </div>

            {graph && rightSidebarOpen && (
                <aside className="graph-right-panel">
                    <div className="graph-right-panel-header">
                        <span className="graph-right-panel-title">Node Intelligence</span>
                        <button
                            type="button"
                            className="graph-right-panel-close"
                            aria-label="Close right panel"
                            onClick={() => setRightSidebarOpen(false)}
                        >
                            &#8250;
                        </button>
                    </div>
                    <div className="graph-right-panel-scroll">
                        {selectedNode && (
                            <div className="panel-section" style={{ paddingBottom: 0 }}>
                                <button className="back-nav-btn" onClick={handleBackToGraph}>
                                    &larr; Back to graph
                                </button>
                            </div>
                        )}
                        <MetricsPanel
                            metrics={blast ?? null}
                            selectedLabel={selectedNode?.label ?? null}
                            vectronMode={vectronMode}
                            totalNodes={graph.nodes.length}
                            totalEdges={graph.edges.length}
                            crossModuleEdgesTotal={graph.crossModuleEdges}
                            onTraceProcesses={selectedNode ? handleTraceProcesses : undefined}
                        />
                        <PromptPanel
                            selectedNode={selectedNode}
                            graph={graph}
                        />
                    </div>
                </aside>
            )}
        </div>
    );

    const renderActiveTab = () => {
        if (activeTab === 'graph') {
            return graphTab;
        }

        if (!graph) {
            return emptyTabState;
        }

        if (activeTab === 'processes') {
            return (
                <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                    <ProcessPanel graph={graph} selectedNode={selectedNodeForProcess} />
                </div>
            );
        }

        if (activeTab === 'ask-ai') {
            return (
                <div className="tab-page-shell">
                    <QueryPanel
                        graph={graph}
                        onQueryResult={handleQueryResult}
                        onClearQuery={handleClearQuery}
                    />
                </div>
            );
        }

        if (activeTab === 'metrics') {
            return (
                <div className="tab-page-shell">
                    <MetricsDashboard graph={graph} />
                </div>
            );
        }

        return (
            <div className="tab-page-shell">
                <ReportModal graph={graph} />
            </div>
        );
    };

    return (
        <div style={{ height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#0A0F1A' }}>
            <Header
                vectronMode={vectronMode}
                onToggleVectron={() => setVectronMode((value) => !value)}
                fileViewMode={fileViewMode}
                onToggleFileView={() => setFileViewMode((value) => !value)}
                onUploadNew={handleUploadNew}
                hasGraph={!!graph}
                nodeCount={graph?.nodes.length ?? 0}
                edgeCount={graph?.edges.length ?? 0}
                activeTab={activeTab}
                onTabChange={setActiveTab}
            />

            {renderActiveTab()}

            <CodeInspector
                fileId={focusedFileId}
                startLine={selectedNode?.startLine}
                endLine={selectedNode?.endLine}
                isOpen={inspectorOpen}
                onClose={() => setInspectorOpen(false)}
            />
        </div>
    );
}
