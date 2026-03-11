import { useState, useCallback } from 'react';
import type { GraphData, BlastMetrics } from '../types/graph';

interface PromptPanelProps {
    selectedLabel: string | null;
    metrics: BlastMetrics | null;
    graph: GraphData;
}

export default function PromptPanel({ selectedLabel, metrics, graph }: PromptPanelProps) {
    const [intent, setIntent] = useState('');
    const [prompt, setPrompt] = useState('');
    const [copied, setCopied] = useState(false);

    const generate = useCallback(() => {
        if (!selectedLabel) return;

        const count = metrics?.impactedNodes ?? 0;
        const depth = metrics?.cascadeDepth ?? 0;
        const risk = metrics?.riskLevel ?? 'UNKNOWN';

        const affected: string[] = [];
        if (metrics && graph) {
            for (const id of metrics.nodeIds) {
                const n = graph.nodes.find(x => x.id === id);
                if (n) affected.push(`- ${n.label} (${n.filePath})`);
            }
        }

        const lines = [
            '═══════════════════════════════════════════',
            'VECTRON — Safe Refactor Prompt',
            '═══════════════════════════════════════════',
            '',
            `Refactor Target : ${selectedLabel}`,
            `Risk Level      : ${risk}`,
            `Cascade Depth   : ${depth}`,
            `Impacted Nodes  : ${count}`,
            '',
            'Intent:',
            intent.trim() || '(no intent provided)',
            '',
            'Affected Nodes:',
            ...(affected.length > 0 ? affected : ['- (run simulation first)']),
            '',
            'Safety Requirements:',
            '1. Update all downstream call sites.',
            '2. Preserve existing return types and parameter contracts.',
            '3. Maintain backward compatibility in affected files.',
            '4. Avoid breaking import chains.',
            '5. Run tests across all impacted modules.',
            '',
            '═══════════════════════════════════════════',
        ];

        setPrompt(lines.join('\n'));
        setCopied(false);
    }, [selectedLabel, metrics, graph, intent]);

    const copyToClipboard = useCallback(() => {
        if (!prompt) return;
        navigator.clipboard.writeText(prompt).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    }, [prompt]);

    return (
        <div className="prompt-panel">
            <div className="prompt-scroll">
                <div className="panel-label">AI Refactor Prompt</div>

                <textarea
                    className="prompt-textarea"
                    rows={4}
                    value={intent}
                    onChange={e => setIntent(e.target.value)}
                    placeholder="Describe your intended change…&#10;e.g. Rename this function and update its return type"
                />

                <button
                    className="btn primary"
                    onClick={generate}
                    disabled={!selectedLabel}
                    style={{ width: '100%', justifyContent: 'center', opacity: selectedLabel ? 1 : 0.4 }}
                >
                    Generate Safe Refactor Prompt
                </button>

                {prompt && (
                    <>
                        <div className="copy-row">
                            <button className="copy-btn" onClick={copyToClipboard}>
                                {copied ? '✓ Copied' : '⎘ Copy'}
                            </button>
                        </div>
                        <pre className="prompt-output">{prompt}</pre>
                    </>
                )}

                {!selectedLabel && (
                    <div className="empty-state" style={{ height: 'auto', paddingTop: 8 }}>
                        <span style={{ fontSize: 12 }}>Select a node in VECTRON mode to generate a prompt</span>
                    </div>
                )}
            </div>
        </div>
    );
}
