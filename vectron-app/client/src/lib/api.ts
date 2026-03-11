import type { GraphData } from '../types/graph';

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
