import express from "express";
import cors from "cors";
import multer from "multer";
import AdmZip from "adm-zip";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { buildGraph, GraphData } from "./graph-builder";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// ── Safety limits ─────────────────────────────────────────────────────────────
// Prevents "Invalid string length" crashes on large repos.
// Files that exceed these thresholds are skipped (sampled), not fatal.
const MAX_FILE_BYTES = 500 * 1024; // 500 KB per individual source file
const MAX_SOURCE_FILES = 500; // max JS/TS files processed per ZIP upload

// Global memory cache: filePath → raw source  (serves CodeInspector /api/file)
const fileCache = new Map<string, string>();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

// ── POST /api/query ───────────────────────────────────────────────────────────
app.post("/api/query", async (req, res) => {
  const { question, graphData } = req.body as { question: string, graphData: GraphData };

  if (!question || !graphData) {
    res.status(400).json({ error: "Missing question or graphData" });
    return;
  }

  try {
    // 1. Build a compact graph summary
    const nodeDegree = new Map<string, number>();
    graphData.edges.forEach(e => {
      nodeDegree.set(e.source, (nodeDegree.get(e.source) || 0) + 1);
      nodeDegree.set(e.target, (nodeDegree.get(e.target) || 0) + 1);
    });

    const isLarge = graphData.nodes.length > 100;
    const filteredNodes = isLarge 
      ? graphData.nodes.filter(n => n.type === 'file' || n.type === 'class' || (nodeDegree.get(n.id) || 0) > 2)
      : graphData.nodes;

    const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
    const filteredEdges = graphData.edges.filter(e => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target));

    let summary = "NODES:\n";
    filteredNodes.forEach(n => {
      summary += `${n.id} | ${n.label} | ${n.type} | ${n.filePath}\n`;
    });
    summary += "\nEDGES:\n";
    filteredEdges.forEach(e => {
      summary += `${e.source} -> ${e.target} (${e.kind})\n`;
    });

    if (summary.length > 12000) {
      summary = summary.substring(0, 12000) + "... [truncated]";
    }

    // 2. Call Gemini API
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    
    const prompt = `You are an expert codebase analyst. You are given a knowledge graph of a software project as a list of nodes and edges.
Your job is to answer the user's question about this codebase.

You MUST respond with ONLY a valid JSON object, no markdown, no backticks, no explanation outside the JSON.

Response format:
{
  "explanation": "A clear plain English answer to the question, 2-4 sentences, mention specific file and function names where relevant",
  "relevantNodes": ["nodeId1", "nodeId2", "nodeId3"]
}

relevantNodes must be real node IDs from the graph that are most relevant to the question. Include 3-10 nodes maximum.
If no nodes are relevant return an empty array.

GRAPH DATA:
${summary}

USER QUESTION:
${question}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    try {
      const jsonStr = text.replace(/```json\n?|```/g, "").trim();
      const parsed = JSON.parse(jsonStr);
      res.json({
        explanation: parsed.explanation || "No explanation provided.",
        relevantNodes: parsed.relevantNodes || []
      });
    } catch (parseErr) {
      console.error("[VECTRON] AI Parse error:", parseErr, "Raw text:", text);
      res.json({
        explanation: "Could not analyze codebase response. Please try again.",
        relevantNodes: []
      });
    }

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[VECTRON] Query error:", message);
    res.status(500).json({ explanation: "Could not analyze codebase. Please try again.", relevantNodes: [] });
  }
});

// ── Multer (memory storage) ───────────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB ZIP cap
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype === "application/zip" ||
      file.originalname.endsWith(".zip")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only .zip files are accepted"));
    }
  },
});

// ── POST /api/upload ──────────────────────────────────────────────────────────
app.post("/api/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  try {
    const zip = new AdmZip(req.file.buffer);
    const entries = zip.getEntries();

    const sourceFiles: { path: string; content: string }[] = [];
    let skippedOversized = 0;
    let skippedUnreadable = 0;

    for (const entry of entries) {
      // ── Limit 1: total file count cap ─────────────────────────────────
      // Hard-stop accumulating strings once we hit the cap so we never
      // load hundreds of MB of source text into memory at once.
      if (sourceFiles.length >= MAX_SOURCE_FILES) break;

      if (entry.isDirectory) continue;

      const entryPath = entry.entryName;

      // Skip non-source directories
      if (/(node_modules|\.git|dist|build|\.next|coverage)\//.test(entryPath))
        continue;

      // Accept JS / TS / JSX / TSX only
      if (!/\.(js|jsx|ts|tsx)$/.test(entryPath)) continue;

      // ── Limit 2: per-file size guard ──────────────────────────────────
      // entry.header.size is the *uncompressed* byte length.
      // Checking it before getData() prevents "Invalid string length" errors
      // that occur when toString() is called on a huge buffer.
      if (entry.header.size > MAX_FILE_BYTES) {
        skippedOversized++;
        continue;
      }

      // ── Limit 3: per-file try/catch ───────────────────────────────────
      // A corrupt or binary entry must never crash the entire upload.
      // Failures are counted and logged but otherwise silently skipped.
      try {
        const content = entry.getData().toString("utf-8");
        sourceFiles.push({ path: entryPath, content });
      } catch {
        skippedUnreadable++;
        // Unreadable or binary — skip silently, continue to next entry
      }
    }

    // Single summary log so the developer knows sampling occurred
    if (skippedOversized > 0 || skippedUnreadable > 0) {
      console.warn(
        `[VECTRON] ZIP sampled: skipped ${skippedOversized} oversized file(s) ` +
          `(>${MAX_FILE_BYTES / 1024}KB) and ${skippedUnreadable} unreadable file(s). ` +
          `Processing ${sourceFiles.length} of eligible source files.`,
      );
    } else {
      console.log(`[VECTRON] Processing ${sourceFiles.length} source file(s).`);
    }

    // Cache raw source for CodeInspector /api/file requests
    fileCache.clear();
    for (const f of sourceFiles) {
      fileCache.set(f.path, f.content);
    }

    if (sourceFiles.length === 0) {
      res
        .status(422)
        .json({ error: "No parseable JS/TS files found in the zip" });
      return;
    }

    const graph = buildGraph(sourceFiles);
    res.json(graph);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[VECTRON] Upload error:", message);
    res.status(500).json({ error: `Processing failed: ${message}` });
  }
});

// ── GET /api/file ─────────────────────────────────────────────────────────────
app.get("/api/file", (req, res) => {
  const filePath = req.query.path as string;
  if (!filePath) {
    res.status(400).json({ error: "Missing path parameter" });
    return;
  }

  const content = fileCache.get(filePath);
  if (content === undefined) {
    res.status(404).json({ error: "File not found in cache" });
    return;
  }

  res.json({ path: filePath, content });
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "VECTRON Server" });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`VECTRON server listening on http://localhost:${PORT}`);
});
