import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { GraphData } from '../types/graph';
import { queryCodebase } from '../lib/api';
import GraphView2D from './GraphView2D';

interface Message {
    role: 'user' | 'ai';
    content: string;
}

interface QueryPanelProps {
    graph: GraphData;
    onQueryResult: (nodeIds: string[]) => void;
    onClearQuery: () => void;
}

function formatAiMessage(content: string) {
    const lines = content.split('\n');
    const callChainIndex = lines.findIndex((line) => /call chain/i.test(line));

    if (callChainIndex === -1) {
        return {
            callChain: null,
            body: content,
        };
    }

    return {
        callChain: lines[callChainIndex],
        body: lines.filter((_, index) => index !== callChainIndex).join('\n').trim(),
    };
}

export default function QueryPanel({
    graph,
    onQueryResult,
    onClearQuery,
}: QueryPanelProps) {
    const [question, setQuestion] = useState('');
    const [history, setHistory] = useState<Message[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasResult, setHasResult] = useState(false);
    const [highlightedNodeIds, setHighlightedNodeIds] = useState<string[]>([]);
    const scrollRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const allNodeFilters = useMemo(() => ({
        file: true,
        function: true,
        class: true,
        method: true,
        import: true,
    }), []);
    const allEdgeFilters = useMemo(() => ({
        DEFINES: true,
        IMPORTS: true,
        CALLS: true,
        EXTENDS: true,
        CONTAINS: true,
    }), []);
    const highlightedSet = useMemo(() => new Set(highlightedNodeIds), [highlightedNodeIds]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [history, loading]);

    useEffect(() => {
        const timer = window.setTimeout(() => textareaRef.current?.focus(), 80);
        return () => window.clearTimeout(timer);
    }, []);

    useEffect(() => () => onClearQuery(), [onClearQuery]);

    const handleSubmit = async (event?: React.FormEvent) => {
        if (event) event.preventDefault();
        if (!question.trim() || loading) return;

        const userQuestion = question.trim();
        setQuestion('');
        setHistory((prev) => [...prev, { role: 'user', content: userQuestion }]);
        setLoading(true);
        setHasResult(false);
        setHighlightedNodeIds([]);
        onClearQuery();

        try {
            const data = await queryCodebase(graph, userQuestion);
            setHistory((prev) => [...prev, { role: 'ai', content: data.explanation }]);

            if (data.relevantNodes.length > 0) {
                setHighlightedNodeIds(data.relevantNodes);
                onQueryResult(data.relevantNodes);
                setHasResult(true);
            }
        } catch (error) {
            setHistory((prev) => [
                ...prev,
                { role: 'ai', content: 'ERROR: Could not analyze codebase. Ensure the backend is running.' },
            ]);
        } finally {
            setLoading(false);
            window.setTimeout(() => textareaRef.current?.focus(), 40);
        }
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleSubmit();
        }
    };

    const emptyState = useMemo(() => (
        <div className="query-empty-state">
            {"// SYSTEM READY..."}
            <br />
            Ask a structural question to inspect call chains, dependencies, and impact paths.
        </div>
    ), []);

    return (
        <div className="ask-ai-page">
            <section className="ask-ai-chat-pane">
                <div className="ask-ai-pane-header">
                    <div>
                        <h2 className="ask-ai-title">ASK YOUR CODEBASE</h2>
                        <p className="ask-ai-subtitle">
                            Probe call chains, dependency flow, and architectural behavior in plain language.
                        </p>
                    </div>
                    {hasResult && (
                        <button
                            className="ask-ai-clear-btn"
                            onClick={() => {
                                setHighlightedNodeIds([]);
                                setHasResult(false);
                                onClearQuery();
                            }}
                        >
                            Clear Highlights
                        </button>
                    )}
                </div>

                <div ref={scrollRef} className="ask-ai-history">
                    {history.length === 0 && !loading && emptyState}

                    {history.map((message, index) => {
                        const formatted = message.role === 'ai'
                            ? formatAiMessage(message.content)
                            : null;

                        return (
                            <div
                                key={`${message.role}-${index}`}
                                className={`query-message ${message.role === 'user' ? 'user' : 'ai'}`}
                            >
                                {message.role === 'user' ? (
                                    <div className="query-message-body">{message.content}</div>
                                ) : (
                                    <div className="query-ai-content ask-ai-mono">
                                        {formatted?.callChain && (
                                            <div className="query-call-chain">{formatted.callChain}</div>
                                        )}
                                        {formatted?.body && (
                                            <div className="query-message-body">{formatted.body}</div>
                                        )}
                                        {!formatted?.body && !formatted?.callChain && (
                                            <div className="query-message-body">{message.content}</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {loading && (
                        <div className="query-loading">
                            ANALYZING...
                        </div>
                    )}
                </div>

                <div className="ask-ai-composer">
                    <form className="query-input-row" onSubmit={handleSubmit}>
                        <textarea
                            ref={textareaRef}
                            rows={3}
                            value={question}
                            onChange={(event) => setQuestion(event.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask anything about your codebase..."
                            className="query-input ask-ai-input"
                        />
                        <button
                            type="submit"
                            className="query-send-btn ask-ai-send-btn"
                            disabled={loading || !question.trim()}
                        >
                            SEND
                        </button>
                    </form>
                </div>
            </section>

            <section className="ask-ai-graph-pane">
                <div className="ask-ai-pane-header ask-ai-graph-header">
                    <div>
                        <h3 className="ask-ai-graph-title">RELEVANT STRUCTURE</h3>
                        <p className="ask-ai-subtitle">
                            AI-highlighted nodes appear in white for quick visual verification.
                        </p>
                    </div>
                </div>
                <div className="ask-ai-mini-graph">
                    <GraphView2D
                        data={graph}
                        vectronMode={false}
                        fileViewMode={false}
                        blastIds={new Set<string>()}
                        depthMap={new Map<string, number>()}
                        selectedId={null}
                        focusedFileId={null}
                        onNodeClick={() => undefined}
                        onFileView={() => undefined}
                        nodeFilters={allNodeFilters}
                        edgeFilters={allEdgeFilters}
                        queryIds={highlightedSet}
                        interactive={false}
                    />
                    <div className="ask-ai-graph-overlay" aria-hidden="true" />
                </div>
            </section>
        </div>
    );
}
