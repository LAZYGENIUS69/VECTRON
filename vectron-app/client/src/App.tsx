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

export default function App() {
    const [graph, setGraph] = useState<GraphData | null>(null);
    const [vectronMode, setVectronMode] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [focusedFileId, setFocusedFileId] = useState<string | null>(null);
    const [inspectorOpen, setInspectorOpen] = useState(false);
    const [queryNodeIds, setQueryNodeIds] = useState<Set<string>>(new Set());

    // Filter states
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

    // DEBUG: expose handle for headless testing
    useEffect(() => {
        (window as any).setGraphDebug = (data: GraphData) => setGraph(data);
    }, []);

    const blast = selectedId && graph && vectronMode
        ? computeBlast(graph, selectedId)
        : null;

    const selectedNode = selectedId
        ? graph?.nodes.find(n => n.id === selectedId) ?? null
        : null;

    const handleNodeClick = useCallback((id: string) => {
        if (!id) {
            setSelectedId(null);
            setInspectorOpen(false);
            return;
        }
        setSelectedId(id);

        // Auto-focus file in explorer
        const node = graph?.nodes.find(n => n.id === id);
        if (node?.fileId) setFocusedFileId(node.fileId);

        // Open inspector modal when a node with source info is clicked
        setInspectorOpen(true);
    }, [graph]);

    const handleFileClick = useCallback((fileId: string) => {
        setFocusedFileId(fileId);
        const fileNode = graph?.nodes.find(n => n.type === 'file' && n.fileId === fileId);
        if (fileNode) {
            setSelectedId(fileNode.id);
            setInspectorOpen(true);
        }
    }, [graph]);

    const handleGraph = useCallback((data: GraphData) => {
        setGraph(data);
        setSelectedId(null);
        setFocusedFileId(null);
        setVectronMode(false);
        setInspectorOpen(false);
        setQueryNodeIds(new Set());
    }, []);

    const handleUploadNew = useCallback(() => {
        setGraph(null);
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
                onToggleVectron={() => setVectronMode(v => !v)}
                onUploadNew={handleUploadNew}
                hasGraph={!!graph}
                nodeCount={graph?.nodes.length ?? 0}
                edgeCount={graph?.edges.length ?? 0}
            />

            <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
                {/* Left Panel — Explorer + Filters */}
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

                {/* Center — Graph */}
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

                {/* Right Panel — Metrics + Prompt + AI Query */}
                {graph && (
                    <aside style={{ width: '360px', flexShrink: 0, height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', borderLeft: '1px solid rgba(0,217,255,0.15)', background: '#111827' }}>
                        <div style={{ flex: 1, overflowY: 'scroll', minHeight: 0 }}>
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

            {/* Code Inspector — floating modal, rendered outside layout flow */}
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
