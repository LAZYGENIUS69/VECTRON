import React, { useState, useRef, useEffect } from 'react';
import type { GraphData } from '../types/graph';

interface Message {
    role: 'user' | 'ai';
    content: string;
}

interface QueryPanelProps {
    graph: GraphData;
    onQueryResult: (nodeIds: string[]) => void;
    onClearQuery: () => void;
}

export default function QueryPanel({ graph, onQueryResult, onClearQuery }: QueryPanelProps) {
    const [question, setQuestion] = useState('');
    const [history, setHistory] = useState<Message[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasResult, setHasResult] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-scroll to bottom of chat
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [history, loading]);

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!question.trim() || loading) return;

        const userQ = question.trim();
        setQuestion('');
        setHistory(prev => [...prev, { role: 'user', content: userQ }]);
        setLoading(true);

        try {
            const res = await fetch('http://localhost:3001/api/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: userQ, graphData: graph }),
            });

            if (!res.ok) throw new Error('Server error');
            
            const data = await res.json();
            setHistory(prev => [...prev, { role: 'ai', content: data.explanation }]);
            
            if (data.relevantNodes && data.relevantNodes.length > 0) {
                onQueryResult(data.relevantNodes);
                setHasResult(true);
            }
        } catch (err) {
            setHistory(prev => [...prev, { role: 'ai', content: 'ERROR: Could not analyze codebase. Ensure the backend is running.' }]);
        } finally {
            setLoading(false);
            // Re-focus after submit
            setTimeout(() => textareaRef.current?.focus(), 50);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    const handleClear = () => {
        onClearQuery();
        setHasResult(false);
    };

    return (
        <div className="query-panel" style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            minHeight: '400px',
            maxHeight: '600px',
            background: '#0d1117',
            borderTop: '1px solid rgba(0, 217, 255, 0.15)',
            position: 'relative',
            zIndex: 10
        }}>
            {/* Header */}
            <div style={{
                padding: '10px 16px',
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.15em',
                color: '#00D9FF',
                background: 'rgba(0, 217, 255, 0.05)',
                borderBottom: '1px solid rgba(0, 217, 255, 0.1)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontFamily: 'var(--mono)'
            }}>
                <span>ASK YOUR CODEBASE</span>
                {hasResult && (
                    <button 
                        onClick={handleClear}
                        style={{
                            background: 'rgba(255, 59, 48, 0.1)',
                            border: '1px solid rgba(255, 59, 48, 0.3)',
                            color: '#FF3B30',
                            fontSize: '9px',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontFamily: 'var(--mono)'
                        }}
                    >
                        ✕ CLEAR HIGHLIGHT
                    </button>
                )}
            </div>

            {/* Chat History */}
            <div 
                ref={scrollRef}
                style={{ 
                    flex: 1, 
                    overflowY: 'auto', 
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    fontFamily: 'var(--mono)',
                    fontSize: '12px',
                    minHeight: '200px'
                }}
            >
                {history.length === 0 && !loading && (
                    <div style={{ color: '#64748B', textAlign: 'center', marginTop: '40px', fontSize: '11px' }}>
                        {"// SYSTEM READY..."}<br/>
                        Type a structural question to begin analysis.
                    </div>
                )}

                {history.map((msg, i) => (
                    <div 
                        key={i}
                        style={{
                            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                            maxWidth: '90%',
                            padding: '10px 12px',
                            borderRadius: '4px',
                            background: msg.role === 'user' ? 'rgba(0, 217, 255, 0.03)' : '#161b22',
                            border: msg.role === 'user' ? '1px solid rgba(0, 217, 255, 0.2)' : '1px solid #30363d',
                            color: msg.role === 'user' ? '#00D9FF' : '#E4E4ED',
                            lineHeight: '1.5',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word'
                        }}
                    >
                        {msg.role === 'user' ? `> ${msg.content}` : msg.content}
                    </div>
                ))}

                {loading && (
                    <div style={{ 
                        alignSelf: 'flex-start',
                        color: '#00D9FF',
                        fontSize: '10px',
                        letterSpacing: '2px',
                        padding: '8px 0',
                        animation: 'pulse 1.5s infinite'
                    }}>
                        ANALYZING CODEBASE...
                    </div>
                )}
            </div>

            {/* Input Area */}
            <div style={{
                padding: '12px',
                background: '#161b22',
                borderTop: '1px solid #30363d'
            }}>
                <div style={{ position: 'relative', display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                    <textarea 
                        ref={textareaRef}
                        rows={2}
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask anything about your codebase..."
                        style={{
                            flex: 1,
                            background: '#0d1117',
                            border: '1px solid #30363d',
                            borderRadius: '4px',
                            padding: '10px 12px',
                            color: '#E4E4ED',
                            fontSize: '12px',
                            fontFamily: 'var(--mono)',
                            outline: 'none',
                            resize: 'none',
                            lineHeight: '1.4'
                        }}
                    />
                    <button 
                        onClick={() => handleSubmit()}
                        disabled={loading || !question.trim()}
                        style={{
                            background: '#00D9FF',
                            border: 'none',
                            borderRadius: '4px',
                            width: '36px',
                            height: '36px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: (loading || !question.trim()) ? 'default' : 'pointer',
                            opacity: (loading || !question.trim()) ? 0.3 : 1,
                            flexShrink: 0
                        }}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="22" y1="2" x2="11" y2="13"></line>
                            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                        </svg>
                    </button>
                </div>
                <div style={{ fontSize: '9px', color: '#4B5563', marginTop: '6px', textAlign: 'right', fontFamily: 'var(--mono)' }}>
                    Press Enter to send
                </div>
            </div>

            <style>{`
                @keyframes pulse {
                    0% { opacity: 0.4; }
                    50% { opacity: 1; }
                    100% { opacity: 0.4; }
                }
            `}</style>
        </div>
    );
}
