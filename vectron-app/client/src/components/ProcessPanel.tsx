import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { detectProcesses } from '../lib/api';
import type { DetectedProcess, GraphData } from '../types/graph';

mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    themeVariables: {
        primaryColor: '#00D9FF',
        primaryTextColor: '#ffffff',
        lineColor: '#00D9FF',
        background: '#0d1117'
    }
});

const MermaidChart = ({ chart }: { chart: string }) => {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let isMounted = true;

        if (ref.current && chart) {
            ref.current.innerHTML = '';
            mermaid.render(`mermaid-${Date.now()}-${Math.random().toString(36).slice(2)}`, chart)
                .then(({ svg }) => {
                    if (ref.current && isMounted) {
                        ref.current.innerHTML = svg;
                    }
                })
                .catch(() => {
                    if (ref.current && isMounted) {
                        ref.current.innerHTML = '<div class="process-empty">Could not render Mermaid diagram.</div>';
                    }
                });
        }

        return () => {
            isMounted = false;
        };
    }, [chart]);

    return <div ref={ref} style={{ background: 'transparent' }} />;
};

interface ProcessPanelProps {
    graph: GraphData;
}

export default function ProcessPanel({ graph }: ProcessPanelProps) {
    const [processes, setProcesses] = useState<DetectedProcess[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const selectedProcess = processes[selectedIndex] ?? null;

    const handleDetectProcesses = async () => {
        setLoading(true);
        setError(null);

        try {
            const detected = await detectProcesses(graph);
            setProcesses(detected);
            setSelectedIndex(0);
            if (detected.length === 0) {
                setError('No valid processes were detected for this graph.');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Process detection failed.');
            setProcesses([]);
            setSelectedIndex(0);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="process-panel">
            <aside className="process-sidebar">
                <div className="process-sidebar-header">DETECTED PROCESSES</div>
                <button
                    className="process-detect-btn"
                    onClick={handleDetectProcesses}
                    disabled={loading}
                >
                    {loading ? 'Detecting...' : 'Detect All Processes'}
                </button>

                <div className="process-list">
                    {error && <div className="process-error">{error}</div>}

                    {!error && processes.length === 0 && !loading && (
                        <div className="process-empty">
                            Run detection to generate process flow diagrams from the current graph.
                        </div>
                    )}

                    {processes.map((process, index) => (
                        <button
                            key={`${process.name}-${index}`}
                            className={`process-item ${index === selectedIndex ? 'active' : ''}`}
                            onClick={() => setSelectedIndex(index)}
                        >
                            <span className="process-item-name">{process.name}</span>
                            <span className="process-item-meta">{process.steps} steps</span>
                        </button>
                    ))}
                </div>
            </aside>

            <section className="process-main">
                {selectedProcess ? (
                    <>
                        <div className="process-main-header">
                            <div>
                                <h2>{selectedProcess.name}</h2>
                                <span>{selectedProcess.steps} steps</span>
                            </div>
                        </div>
                        <div className="process-chart-wrap">
                            <MermaidChart chart={selectedProcess.mermaid} />
                        </div>
                        <div className="process-explanation">
                            {selectedProcess.explanation}
                        </div>
                    </>
                ) : (
                    <div className="process-main-empty">
                        Select a detected process to inspect its Mermaid flowchart and explanation.
                    </div>
                )}
            </section>
        </div>
    );
}
