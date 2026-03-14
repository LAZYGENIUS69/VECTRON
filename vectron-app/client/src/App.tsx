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

export default function App() {
    const [graph, setGraph] = useState<GraphData | null>(null);
    const [activeTab, setActiveTab] = useState<'graph' | 'processes'>('graph');
    const [vectronMode, setVectronMode] = useState(false);
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
            setInspectorOpen(false);
            return;
        }

        setSelectedId(id);
        const node = graph?.nodes.find((item) => item.id === id);
        if (node?.fileId) setFocusedFileId(node.fileId);
        setInspectorOpen(true);
    }, [graph]);

    const handleFileClick = useCallback((fileId: string) => {
        setFocusedFileId(fileId);
        const fileNode = graph?.nodes.find((node) => node.type === 'file' && node.fileId === fileId);
        if (fileNode) {
            setSelectedId(fileNode.id);
            setInspectorOpen(true);
        }
    }, [graph]);

    const handleGraph = useCallback((data: GraphData) => {
        setGraph(data);
        setActiveTab('graph');
        setSelectedId(null);
        setFocusedFileId(null);
        setVectronMode(false);
        setInspectorOpen(false);
        setQueryNodeIds(new Set());
    }, []);

    const handleUploadNew = useCallback(() => {
        setGraph(null);
        setActiveTab('graph');
        setSelectedId(null);
        setFocusedFileId(null);
        setVectronMode(false);
        setInspectorOpen(false);
        setQueryNodeIds(new Set());
    }, []);

    const handleQueryResult = (nodeIds: string[]) => {
        setQueryNodeIds(new Set(nodeIds));
    };

    const handleClearQuery = () => {
        setQueryNodeIds(new Set());
    };

    return (
        <div style={{ height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#0A0F1A' }}>
            <Header
                vectronMode={vectronMode}
                onToggleVectron={() => setVectronMode((value) => !value)}
                onUploadNew={handleUploadNew}
                hasGraph={!!graph}
                nodeCount={graph?.nodes.length ?? 0}
                edgeCount={graph?.edges.length ?? 0}
                activeTab={activeTab}
                onTabChange={setActiveTab}
            />

            {activeTab === 'processes' ? (
                <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                    {graph ? (
                        <ProcessPanel graph={graph} />
                    ) : (
                        <div className="process-main-empty">
                            Upload a repository first to detect process flows from its dependency graph.
                        </div>
                    )}
                </div>
            ) : (
                <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
                    {graph && (
                        <div className="explorer-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                            <ExplorerPanel
                                nodes={graph.nodes}
                                focusedFileId={focusedFileId}
                                onFileClick={handleFileClick}
                            />
                            <FilterPanel
                                nodeFilters={nodeFilters}
                                setNodeFilters={setNodeFilters}
                                edgeFilters={edgeFilters}
                                setEdgeFilters={setEdgeFilters}
                            />
                        </div>
                    )}

                    <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minWidth: 0 }}>
                        {!graph ? (
                            <UploadZone onGraph={handleGraph} />
                        ) : (
                            <DependencyCanvas
                                data={graph}
                                vectronMode={vectronMode}
                                blastIds={blast?.nodeIds ?? new Set<string>()}
                                depthMap={blast?.depthMap ?? new Map<string, number>()}
                                selectedId={selectedId}
                                focusedFileId={focusedFileId}
                                onNodeClick={handleNodeClick}
                                nodeFilters={nodeFilters}
                                edgeFilters={edgeFilters}
                                queryIds={queryNodeIds}
                            />
                        )}
                    </div>

                    {graph && (
                        <aside style={{ width: '360px', flexShrink: 0, height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', borderLeft: '1px solid rgba(0,217,255,0.15)', background: '#111827' }}>
                            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                                <MetricsPanel
                                    metrics={blast ?? null}
                                    selectedLabel={selectedNode?.label ?? null}
                                    vectronMode={vectronMode}
                                    totalNodes={graph.nodes.length}
                                    totalEdges={graph.edges.length}
                                    crossModuleEdgesTotal={graph.crossModuleEdges}
                                />
                                <PromptPanel
                                    selectedLabel={selectedNode?.label ?? null}
                                    metrics={blast ?? null}
                                    graph={graph}
                                />
                                <QueryPanel
                                    graph={graph}
                                    onQueryResult={handleQueryResult}
                                    onClearQuery={handleClearQuery}
                                />
                            </div>
                        </aside>
                    )}
                </div>
            )}

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
