# VECTRON

**Interactive Structural Code Intelligence & Safe Refactor Simulation**

VECTRON is a dependency propagation engine that visualizes code structures as interactive graphs. Upload any JavaScript/TypeScript codebase and instantly see how your files, functions, classes, and methods are connected.

## Features

- **Dependency Graph Visualization** — Sigma.js WebGL graph with ForceAtlas2 layout
- **Blast Radius Simulation** — Select any node and see which parts of the codebase would be affected by a change
- **Structural Impact Metrics** — Risk scoring based on cascade depth, affected nodes, and cross-module connections
- **Code Inspector** — Click any node to view its source code with syntax highlighting
- **AI Refactor Prompts** — Generate safe refactoring prompts based on blast radius analysis
- **Module Clustering** — Automatic color-coding by module for visual cluster identification

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite |
| Graph | Sigma.js, Graphology, ForceAtlas2 |
| Server | Express, Babel Parser (AST) |
| Styling | Vanilla CSS |

## Getting Started

```bash
cd vectron-app

# Install dependencies
npm run install:all

# Start development server
npm run dev
```

Open `http://localhost:5173` and upload a ZIP of any JS/TS project.

## Project Structure

```
vectron-app/
├── client/              # React frontend
│   └── src/
│       ├── components/  # GraphView2D, ExplorerPanel, CodeInspector, etc.
│       └── types/       # Shared TypeScript types
└── server/              # Express backend
    └── src/
        ├── parser.ts      # Babel AST parser
        ├── graph-builder.ts # Dependency graph construction
        └── index.ts       # Express server + zip upload endpoint
```

## How It Works

1. **Upload** a ZIP of your codebase
2. **Parse** — Server extracts AST nodes (functions, classes, methods, imports) and relationships (IMPORTS, CALLS, DEFINES)
3. **Visualize** — Client renders the dependency graph with Sigma.js
4. **Analyze** — Enable VECTRON mode to simulate blast radius propagation

## License

MIT
