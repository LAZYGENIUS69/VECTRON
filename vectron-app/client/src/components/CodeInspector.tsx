import { useEffect, useRef, useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { fetchFile } from '../lib/api';

interface CodeInspectorProps {
    fileId: string | null;
    startLine?: number;
    endLine?: number;
    isOpen: boolean;
    onClose: () => void;
}

export default function CodeInspector({ fileId, startLine, endLine, isOpen, onClose }: CodeInspectorProps) {
    const [code, setCode] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!fileId) {
            setCode(null);
            setError(null);
            return;
        }

        let ignore = false;
        async function load() {
            setLoading(true);
            setError(null);
            try {
                const content = await fetchFile(fileId!);
                if (!ignore) setCode(content);
            } catch (err: any) {
                if (!ignore) setError(err.message);
            } finally {
                if (!ignore) setLoading(false);
            }
        }
        load();
        return () => {
            ignore = true;
        };
    }, [fileId]);

    useEffect(() => {
        if (!code || !startLine || !containerRef.current) return;
        setTimeout(() => {
            if (!containerRef.current) return;
            const lines = containerRef.current.querySelectorAll('.code-line');
            if (lines.length > startLine - 1) {
                (lines[startLine - 1] as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 50);
    }, [code, startLine]);

    useEffect(() => {
        if (!isOpen) return;
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const filename = fileId ? fileId.split('/').pop() : null;

    return (
        <>
            <div
                className="code-inspector-overlay"
                onClick={onClose}
                aria-hidden="true"
            />

            <div className="code-inspector-modal" role="dialog" aria-modal="true" aria-label="Code inspector">
                <div className="code-inspector-header">
                    <div className="code-inspector-header-main">
                        <div className="code-inspector-back-nav">
                            <button className="back-nav-btn" onClick={onClose}>
                                <span className="back-nav-btn-icon" aria-hidden="true">
                                    &larr;
                                </span>
                                <span className="back-nav-btn-label">Close file</span>
                            </button>
                        </div>
                        <span className="code-inspector-filename">
                            {filename ?? 'Code Inspector'}
                        </span>
                    </div>

                    <button
                        onClick={onClose}
                        title="Close (Esc)"
                        className="code-inspector-close"
                    >
                        X
                    </button>
                </div>

                <div
                    ref={containerRef}
                    className="code-inspector-body"
                >
                    {loading && (
                        <div className="code-inspector-state">
                            <span className="spinner" />
                        </div>
                    )}

                    {error && (
                        <div className="code-inspector-error">
                            {error}
                        </div>
                    )}

                    {!fileId && !loading && (
                        <div className="code-inspector-state">
                            <div className="empty-state empty-state-fill">
                                <strong>No file selected</strong>
                                <span>Select a node with source code to inspect its contents here.</span>
                            </div>
                        </div>
                    )}

                    {code && (
                        <SyntaxHighlighter
                            language="typescript"
                            style={vscDarkPlus}
                            showLineNumbers
                            wrapLines
                            lineProps={(line: number) => {
                                const isHighlighted = startLine && endLine && line >= startLine && line <= endLine;
                                return {
                                    className: `code-line ${isHighlighted ? 'highlighted' : ''}`,
                                    style: {
                                        display: 'block',
                                        backgroundColor: isHighlighted
                                            ? 'rgba(0, 217, 255, 0.12)'
                                            : 'transparent',
                                    },
                                };
                            }}
                            customStyle={{
                                margin: 0,
                                padding: '16px 0',
                                background: 'transparent',
                                fontSize: '12px',
                                fontFamily: 'JetBrains Mono, monospace',
                            }}
                        >
                            {code}
                        </SyntaxHighlighter>
                    )}
                </div>
            </div>
        </>
    );
}
