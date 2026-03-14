import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import multer from "multer";
import AdmZip from "adm-zip";
import Groq from "groq-sdk";
import { buildGraph, GraphData } from "./graph-builder";

const app = express();
const PORT = process.env.PORT || 3001;
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const MAX_FILE_BYTES = 500 * 1024;
const MAX_SOURCE_FILES = 500;
const fileCache = new Map<string, string>();

interface ProcessDefinition {
  name: string;
  steps: number;
  explanation: string;
  mermaid: string;
}

function hasValidGroqApiKey(): boolean {
  const apiKey = process.env.GROQ_API_KEY || "";
  return !!apiKey && apiKey !== "PASTE_YOUR_KEY_HERE" && apiKey !== "your_actual_key_here";
}

function buildCompactGraphSummary(graphData: GraphData): string {
  const nodeDegree = new Map<string, number>();
  graphData.edges.forEach((edge) => {
    nodeDegree.set(edge.source, (nodeDegree.get(edge.source) || 0) + 1);
    nodeDegree.set(edge.target, (nodeDegree.get(edge.target) || 0) + 1);
  });

  const isLarge = graphData.nodes.length > 100;
  const filteredNodes = isLarge
    ? graphData.nodes.filter(
        (node) =>
          node.type === "file" ||
          node.type === "class" ||
          (nodeDegree.get(node.id) || 0) > 2,
      )
    : graphData.nodes;

  const filteredNodeIds = new Set(filteredNodes.map((node) => node.id));
  const filteredEdges = graphData.edges.filter(
    (edge) => filteredNodeIds.has(edge.source) && filteredNodeIds.has(edge.target),
  );

  const idToLabel = new Map<string, string>();
  graphData.nodes.forEach((node) => {
    idToLabel.set(node.id, node.label || node.id);
  });

  const nodeSummaries = filteredNodes.map(
    (node) =>
      `id: ${node.id} | label: ${node.label} | type: ${node.type} | file: ${node.filePath}`,
  );
  const edgeSummaries = filteredEdges.map((edge) => {
    const sourceLabel = idToLabel.get(edge.source) || edge.source;
    const targetLabel = idToLabel.get(edge.target) || edge.target;
    return `${sourceLabel} --${edge.kind}--> ${targetLabel}`;
  });

  let summary = "NODES:\n";
  summary += nodeSummaries.length > 0 ? nodeSummaries.join("\n") : "None";
  summary += "\n\nEDGES:\n";
  summary += edgeSummaries.length > 0 ? edgeSummaries.join("\n") : "None";

  if (summary.length > 12000) {
    summary = summary.substring(0, 12000) + "... [truncated]";
  }

  return summary;
}

function extractMermaidLabels(mermaid: string): string[] {
  const matches = mermaid.match(/\[[^\]]+\]/g) || [];
  return matches.map((match) => match.slice(1, -1).trim()).filter(Boolean);
}

function sanitizeProcesses(raw: unknown, allowedLabels: Set<string>): ProcessDefinition[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;

      const candidate = item as Partial<ProcessDefinition>;
      const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
      const explanation =
        typeof candidate.explanation === "string" ? candidate.explanation.trim() : "";
      const mermaid = typeof candidate.mermaid === "string" ? candidate.mermaid.trim() : "";
      const steps =
        typeof candidate.steps === "number" && Number.isFinite(candidate.steps)
          ? Math.max(0, Math.floor(candidate.steps))
          : 0;

      const labels = extractMermaidLabels(mermaid);
      const hasOnlyKnownLabels = labels.length >= 3 && labels.every((label) => allowedLabels.has(label));

      if (!name || !explanation || !mermaid || steps < 3 || !hasOnlyKnownLabels) {
        return null;
      }

      return { name, steps, explanation, mermaid };
    })
    .filter((process): process is ProcessDefinition => process !== null);
}

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json({ limit: "50mb" }));

app.post("/api/query", async (req, res) => {
  console.log("Query received:", req.body.question);
  console.log("Groq key exists:", !!process.env.GROQ_API_KEY);

  const { question, graphData } = req.body as { question: string; graphData: GraphData };

  if (!question || !graphData) {
    res.status(400).json({ error: "Missing question or graphData" });
    return;
  }

  if (!hasValidGroqApiKey()) {
    console.error("[VECTRON] GROQ_API_KEY is not set in server/.env");
    res.status(500).json({
      explanation:
        "Groq API key is not configured. Please set GROQ_API_KEY in server/.env and restart the server.",
      relevantNodes: [],
    });
    return;
  }

  try {
    const summary = buildCompactGraphSummary(graphData);

    const systemPrompt = `You are an expert software architect analyzing a real codebase.
You have been given the actual nodes and edges of a dependency graph.

When answering questions, you MUST follow this exact format:

CALL CHAIN (always first):
ComponentA.tsx -> functionB() -> api.ts -> /endpoint -> parser.ts -> output

EXPLANATION (2-3 sentences after the chain):
Explain WHY each step happens, what data is passed between them,
and what the key logic is at each step. Be specific about function
names and file names. Write like a senior engineer explaining to
a colleague, not like documentation.

RULES:
- Only reference files and functions that exist in the provided node list
- Never say 'it appears' or 'seems to' - be direct and confident
- Always show the arrow chain first before any explanation
- If multiple call chains exist show all of them
- Be technical and specific, not generic

You MUST respond with ONLY valid JSON, no markdown, no backticks:
{
  "explanation": "CALL CHAIN:\\nA -> B -> C\\n\\nEXPLANATION:\\nyour text here",
  "relevantNodes": ["nodeId1", "nodeId2", "nodeId3"]
}`;

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `GRAPH DATA:\n${summary}\n\nUSER QUESTION:\n${question}` },
      ],
      max_tokens: 1024,
      temperature: 0.3,
    });
    const text = response.choices?.[0]?.message?.content ?? "";

    try {
      const jsonStr = text.replace(/```json\n?|```/g, "").trim();
      const parsed = JSON.parse(jsonStr);
      res.json({
        explanation: parsed.explanation || "No explanation provided.",
        relevantNodes: parsed.relevantNodes || [],
      });
    } catch (parseErr) {
      console.error("[VECTRON] AI Parse error:", parseErr, "Raw text:", text);
      res.json({
        explanation: "Could not analyze codebase response. Please try again.",
        relevantNodes: [],
      });
    }
  } catch (err: unknown) {
    console.error("Groq chat error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ explanation: `Query failed: ${message}`, relevantNodes: [] });
  }
});

app.post("/api/processes", async (req, res) => {
  const { graphData } = req.body as { graphData: GraphData };

  if (!graphData) {
    res.status(400).json({ error: "Missing graphData" });
    return;
  }

  if (!hasValidGroqApiKey()) {
    console.error("[VECTRON] GROQ_API_KEY is not set in server/.env");
    res.status(500).json({
      error:
        "Groq API key is not configured. Please set GROQ_API_KEY in server/.env and restart the server.",
      processes: [],
    });
    return;
  }

  try {
    const summary = buildCompactGraphSummary(graphData);
    const allowedLabels = new Set(graphData.nodes.map((node) => node.label));
    const systemPrompt = `You are an expert software architect. You have been given a dependency graph of a real codebase as nodes and edges.

Analyze the graph and detect all meaningful processes - a process is a complete flow from a trigger point (user action, API call, event) through to an output or side effect.

For each process generate a Mermaid flowchart diagram.

You MUST respond with ONLY valid JSON, no markdown, no backticks:
{
  "processes": [
    {
      "name": "File Upload Flow",
      "steps": 5,
      "explanation": "plain english description of what this process does",
      "mermaid": "graph TD\\n  A[UploadZone] --> B[api.ts]\\n  B --> C[/api/upload]\\n  C --> D[parser.ts]\\n  D --> E[GraphView2D]"
    }
  ]
}

Rules:
- Detect 5-10 most important processes only
- Only reference nodes that exist in the provided graph
- Mermaid syntax must be valid - use graph TD format
- Each process must have at least 3 steps
- Process names must be human readable like 'File Upload Flow'
- Never invent nodes that dont exist in the graph`;

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `GRAPH DATA:\n${summary}` },
      ],
      max_tokens: 1800,
      temperature: 0.2,
    });
    const text = response.choices?.[0]?.message?.content ?? "";

    try {
      const jsonStr = text.replace(/```json\n?|```/g, "").trim();
      const parsed = JSON.parse(jsonStr);
      res.json({ processes: sanitizeProcesses(parsed.processes, allowedLabels) });
    } catch (parseErr) {
      console.error("[VECTRON] Process Parse error:", parseErr, "Raw text:", text);
      res.json({ processes: [] });
    }
  } catch (err: unknown) {
    console.error("Groq process error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: `Process detection failed: ${message}`, processes: [] });
  }
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/zip" || file.originalname.endsWith(".zip")) {
      cb(null, true);
    } else {
      cb(new Error("Only .zip files are accepted"));
    }
  },
});

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
      if (sourceFiles.length >= MAX_SOURCE_FILES) break;
      if (entry.isDirectory) continue;

      const entryPath = entry.entryName;

      if (/(node_modules|\.git|dist|build|\.next|coverage)\//.test(entryPath)) continue;
      if (!/\.(js|jsx|ts|tsx)$/.test(entryPath)) continue;

      if (entry.header.size > MAX_FILE_BYTES) {
        skippedOversized++;
        continue;
      }

      try {
        const content = entry.getData().toString("utf-8");
        sourceFiles.push({ path: entryPath, content });
      } catch {
        skippedUnreadable++;
      }
    }

    if (skippedOversized > 0 || skippedUnreadable > 0) {
      console.warn(
        `[VECTRON] ZIP sampled: skipped ${skippedOversized} oversized file(s) ` +
          `(>${MAX_FILE_BYTES / 1024}KB) and ${skippedUnreadable} unreadable file(s). ` +
          `Processing ${sourceFiles.length} of eligible source files.`,
      );
    } else {
      console.log(`[VECTRON] Processing ${sourceFiles.length} source file(s).`);
    }

    fileCache.clear();
    for (const file of sourceFiles) {
      fileCache.set(file.path, file.content);
    }

    if (sourceFiles.length === 0) {
      res.status(422).json({ error: "No parseable JS/TS files found in the zip" });
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

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "VECTRON Server" });
});

app.listen(PORT, () => {
  console.log(`VECTRON server listening on http://localhost:${PORT}`);
});
