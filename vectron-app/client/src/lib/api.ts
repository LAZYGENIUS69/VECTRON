import type { DetectedProcess, GraphData, LLMConfig } from '../types/graph';

const BASE = '/api';

/** Upload a zip file and receive the parsed graph JSON. */
export async function uploadZip(file: File): Promise<GraphData> {
    const form = new FormData();
    form.append('file', file);

    const res = await fetch(`${BASE}/upload`, { method: 'POST', body: form });

    if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(body.error ?? `Server error ${res.status}`);
    }

    return res.json() as Promise<GraphData>;
}

/** Fetch source code of a specific file from the server cache. */
export async function fetchFile(filePath: string): Promise<string> {
    const res = await fetch(`${BASE}/file?path=${encodeURIComponent(filePath)}`);
    if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(body.error ?? `Server error ${res.status}`);
    }
    const data = await res.json();
    return data.content;
}

export async function detectProcesses(graphData: GraphData, focusNode?: string | null): Promise<DetectedProcess[]> {
    const res = await fetch(`${BASE}/processes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ graphData, focusNode: focusNode || undefined }),
    });

    const body = await res.json().catch(() => ({ error: res.statusText, processes: [] }));
    if (!res.ok) {
        throw new Error(body.error ?? `Server error ${res.status}`);
    }

    return Array.isArray(body.processes) ? body.processes : [];
}

export async function queryCodebase(
    graphData: GraphData,
    question: string,
    llmConfig?: LLMConfig,
): Promise<{ explanation: string; relevantNodes: string[] }> {
    const res = await fetch(`${BASE}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ graphData, question, llmConfig }),
    });

    const body = await res.json().catch(() => ({
        explanation: '',
        relevantNodes: [],
        error: res.statusText,
    }));

    if (!res.ok) {
        throw new Error(body.error ?? `Server error ${res.status}`);
    }

    return {
        explanation: typeof body.explanation === 'string' ? body.explanation : '',
        relevantNodes: Array.isArray(body.relevantNodes) ? body.relevantNodes : [],
    };
}

export async function fetchNodeSummary(
    graphData: GraphData,
    nodeId: string,
    label: string,
    type: string,
): Promise<string> {
    const res = await fetch(`${BASE}/node-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ graphData, nodeId, label, type }),
    });

    const body = await res.json().catch(() => ({
        summary: '',
        error: res.statusText,
    }));

    if (!res.ok) {
        throw new Error(body.error ?? `Server error ${res.status}`);
    }

    return typeof body.summary === 'string' ? body.summary : '';
}

export async function generateReport(graphData: GraphData): Promise<string> {
    const res = await fetch(`${BASE}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ graphData }),
    });

    const body = await res.json().catch(() => ({ error: res.statusText, report: '' }));
    if (!res.ok) {
        throw new Error(body.error ?? `Server error ${res.status}`);
    }

    return typeof body.report === 'string' ? body.report : '';
}
