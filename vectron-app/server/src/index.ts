import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import AdmZip from 'adm-zip';
import { buildGraph } from './graph-builder';

const app = express();
const PORT = 3001;

// Global memory cache of recent uploaded repo files
// In a real app, this would be tied to a session/tenant or backed by redis
// Map: filePath -> file content
const fileCache = new Map<string, string>();

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

// ── Multer (memory storage — no disk writes except temp extraction) ──────────
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
    fileFilter: (_req, file, cb) => {
        if (file.mimetype === 'application/zip' || file.originalname.endsWith('.zip')) {
            cb(null, true);
        } else {
            cb(new Error('Only .zip files are accepted'));
        }
    },
});

// ── POST /api/upload ─────────────────────────────────────────────────────────
app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
    }

    try {
        // Extract zip from memory buffer
        const zip = new AdmZip(req.file.buffer);
        const entries = zip.getEntries();

        // Collect parseable source files
        const sourceFiles: { path: string; content: string }[] = [];
        for (const entry of entries) {
            if (entry.isDirectory) continue;
            const entryPath = entry.entryName;

            // Skip common non-source dirs
            if (/(node_modules|\.git|dist|build|\.next|coverage)\//.test(entryPath)) continue;

            // Accept JS/TS/JSX/TSX only
            if (!/\.(js|jsx|ts|tsx)$/.test(entryPath)) continue;

            try {
                const content = entry.getData().toString('utf-8');
                sourceFiles.push({ path: entryPath, content });
            } catch {
                // Binary or unreadable — skip
            }
        }

        // Cache them
        fileCache.clear();
        for (const f of sourceFiles) {
            fileCache.set(f.path, f.content);
        }

        if (sourceFiles.length === 0) {
            res.status(422).json({ error: 'No parseable JS/TS files found in the zip' });
            return;
        }

        // Build knowledge graph
        const graph = buildGraph(sourceFiles);
        res.json(graph);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ error: `Processing failed: ${message}` });
    }
});

// ── GET /api/file ────────────────────────────────────────────────────────────
app.get('/api/file', (req, res) => {
    const filePath = req.query.path as string;
    if (!filePath) {
        res.status(400).json({ error: 'Missing path parameter' });
        return;
    }

    const content = fileCache.get(filePath);
    if (content === undefined) {
        res.status(404).json({ error: 'File not found in cache' });
        return;
    }

    res.json({ path: filePath, content });
});

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'VECTRON Server' });
});

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`VECTRON server listening on http://localhost:${PORT}`);
});
