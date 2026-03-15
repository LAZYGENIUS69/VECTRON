import { useEffect, useMemo, useState } from 'react';
import { generateReport } from '../lib/api';
import type { GraphData } from '../types/graph';

interface ReportModalProps {
    graph: GraphData;
}

const LOADING_STEPS = [
    'Analyzing graph structure...',
    'Identifying dependency patterns...',
    'Assessing risk factors...',
    'Writing report...',
];

function renderInlineMarkdown(text: string) {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);

    return parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>;
        }

        return <span key={`${part}-${index}`}>{part}</span>;
    });
}

function renderMarkdown(report: string) {
    const lines = report.split('\n');
    const blocks: React.ReactNode[] = [];
    let bulletItems: string[] = [];
    let paragraphLines: string[] = [];

    const flushBullets = () => {
        if (bulletItems.length === 0) return;
        blocks.push(
            <ul key={`ul-${blocks.length}`} className="report-markdown-list">
                {bulletItems.map((item, index) => (
                    <li key={`${item}-${index}`}>{renderInlineMarkdown(item)}</li>
                ))}
            </ul>,
        );
        bulletItems = [];
    };

    const flushParagraph = () => {
        if (paragraphLines.length === 0) return;
        blocks.push(
            <p key={`p-${blocks.length}`} className="report-markdown-p">
                {renderInlineMarkdown(paragraphLines.join(' '))}
            </p>,
        );
        paragraphLines = [];
    };

    lines.forEach((rawLine) => {
        const line = rawLine.trim();

        if (!line) {
            flushBullets();
            flushParagraph();
            return;
        }

        if (line.startsWith('# ')) {
            flushBullets();
            flushParagraph();
            blocks.push(<h1 key={`h1-${blocks.length}`}>{line.slice(2)}</h1>);
            return;
        }

        if (line.startsWith('## ')) {
            flushBullets();
            flushParagraph();
            blocks.push(<h2 key={`h2-${blocks.length}`}>{line.slice(3)}</h2>);
            return;
        }

        if (line.startsWith('### ')) {
            flushBullets();
            flushParagraph();
            blocks.push(<h3 key={`h3-${blocks.length}`}>{line.slice(4)}</h3>);
            return;
        }

        if (line.startsWith('- ')) {
            flushParagraph();
            bulletItems.push(line.slice(2));
            return;
        }

        flushBullets();
        paragraphLines.push(line);
    });

    flushBullets();
    flushParagraph();

    return blocks;
}

export default function ReportModal({ graph }: ReportModalProps) {
    const [loading, setLoading] = useState(false);
    const [report, setReport] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [loadingStepIndex, setLoadingStepIndex] = useState(0);

    useEffect(() => {
        setReport('');
        setError(null);
        setCopied(false);
        setLoading(false);
        setLoadingStepIndex(0);
    }, [graph]);

    useEffect(() => {
        if (!loading) {
            setLoadingStepIndex(0);
            return;
        }

        const interval = window.setInterval(() => {
            setLoadingStepIndex((current) => (current + 1) % LOADING_STEPS.length);
        }, 1100);

        return () => window.clearInterval(interval);
    }, [loading]);

    const loadReport = async () => {
        setLoading(true);
        setError(null);
        setCopied(false);

        try {
            const nextReport = await generateReport(graph);
            setReport(nextReport);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not generate report.');
        } finally {
            setLoading(false);
        }
    };

    const renderedReport = useMemo(() => renderMarkdown(report), [report]);

    const handleDownload = () => {
        if (!report) return;

        const blob = new Blob([report], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const link = document.createElement('a');
        link.href = url;
        link.download = `vectron-report-${timestamp}.md`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const handleCopy = async () => {
        if (!report) return;

        try {
            await navigator.clipboard.writeText(report);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
        } catch (err) {
            setError('Could not copy report to clipboard.');
        }
    };

    return (
        <div className="report-page">
            <div className="report-page-header">
                <div>
                    <h2 className="report-page-title">CODEBASE INTELLIGENCE REPORT</h2>
                    <p className="report-page-subtitle">
                        Generate a senior-level architectural readout from the current dependency graph.
                    </p>
                </div>

                <div className="report-actions">
                    {report && !loading && (
                        <>
                            <button className="process-chart-btn" onClick={handleDownload}>
                                Download .md
                            </button>
                            <button className="process-chart-btn" onClick={handleCopy}>
                                {copied ? 'Copied!' : 'Copy'}
                            </button>
                            <button className="process-chart-btn" onClick={loadReport}>
                                Regenerate
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="report-page-body">
                {!loading && !error && !report && (
                    <div className="report-empty-state">
                        <button className="report-generate-btn" onClick={loadReport}>
                            Generate Report
                        </button>
                    </div>
                )}

                {loading && (
                    <div className="report-loading-panel">
                        <div className="report-loading-headline">Generating intelligence report</div>
                        <div className="report-loading-steps">
                            {LOADING_STEPS.map((step, index) => (
                                <div
                                    key={step}
                                    className={`report-loading-step ${index === loadingStepIndex ? 'active' : ''} ${index < loadingStepIndex ? 'complete' : ''}`}
                                >
                                    {step}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {!loading && error && (
                    <div className="report-error-wrap report-page-error">
                        <div className="process-error" style={{ minHeight: 120 }}>
                            {error}
                        </div>
                        <button className="process-chart-btn" onClick={loadReport}>
                            Retry Report
                        </button>
                    </div>
                )}

                {!loading && !error && report && (
                    <div className="report-markdown report-page-markdown">
                        {renderedReport}
                    </div>
                )}
            </div>
        </div>
    );
}
