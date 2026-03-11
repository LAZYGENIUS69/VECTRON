# VECTRON

> **Structural Code Intelligence & Safe Refactor Simulation**
> *"AI refactors locally. VECTRON simulates globally."*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## What Is VECTRON?

VECTRON builds an **interactive knowledge graph** from your codebase (files, functions, imports, call relationships) and lets you simulate the structural **blast radius** of any refactor before you write a single line of code.

---

## Features

| | |
|---|---|
| 📦 **Zip Upload** | Upload any JS/TS repository as a `.zip` |
| 🗺️ **Graph Visualization** | Interactive force-directed graph (Sigma.js) |
| ⚡ **VECTRON Mode** | Click a node → BFS simulation highlights all downstream dependents |
| 📊 **Risk Metrics** | Impacted nodes · files · cascade depth · LOW/MEDIUM/HIGH/CRITICAL |
| 🤖 **Prompt Generator** | Generates a structured, safety-aware prompt for any LLM |

---

## Quick Start

```bash
# Install all dependencies
cd vectron-app
npm install
npm run install:all

# Start dev servers (client + server)
npm run dev
```

- **Frontend:** http://localhost:5173  
- **Backend API:** http://localhost:3001

---

## How It Works

1. Upload a `.zip` of your repository
2. The Express server extracts it in memory and parses every `.js/.ts/.jsx/.tsx` file using `@babel/parser`
3. A three-pass graph builder creates:
   - **File nodes** + **Function nodes**
   - **IMPORTS** edges (file → file, resolved from relative specifiers)
   - **CALLS** edges (function → function, resolved by name)
4. The JSON graph is sent to the React frontend rendered with Sigma.js
5. Activate **VECTRON Mode** and click any node to run BFS downstream traversal
6. The **Metrics Panel** shows the blast radius; the **Prompt Panel** generates an LLM-ready refactor prompt

---

## Project Structure

```
vectron-app/
├── client/                 # React + Vite + TypeScript
│   └── src/
│       ├── components/     # Header, GraphView, UploadZone, MetricsPanel, PromptPanel
│       ├── lib/            # bfs.ts, risk.ts, api.ts
│       └── types/          # graph.ts (shared types)
├── server/                 # Express + @babel/parser
│   └── src/
│       ├── index.ts        # Express server, /api/upload route
│       ├── parser.ts       # AST walker (functions, imports, callees)
│       └── graph-builder.ts # Three-pass graph construction
├── LICENSE                 # MIT
└── README.md
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Graph Rendering | Sigma.js 3 + Graphology |
| Backend | Express.js + TypeScript |
| Code Parsing | @babel/parser + @babel/traverse |
| Zip Handling | adm-zip |

---

## License

MIT © 2025 VECTRON Contributors
