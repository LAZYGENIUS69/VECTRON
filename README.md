# VECTRON

**Dependency propagation engine for codebase intelligence**

> ChatGPT can explain a function. VECTRON shows what breaks when that function changes.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-vectron--app.vercel.app-00D9FF?style=flat-square)](https://vectron-app.vercel.app)
[![GitHub](https://img.shields.io/badge/GitHub-LAZYGENIUS69%2FVECTRON-white?style=flat-square&logo=github)](https://github.com/LAZYGENIUS69/VECTRON)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

[Architecture](docs/ARCHITECTURE.md) · [MCP Guide](docs/MCP.md) · [API Reference](docs/API.md) · [Contributing](docs/CONTRIBUTING.md)

---

## What Is VECTRON?

VECTRON is an AI-powered dependency analysis workspace. Upload a JavaScript, TypeScript, Python, config, or documentation-heavy repository and VECTRON builds an interactive knowledge graph of files, functions, classes, imports, calls, ownership boundaries, and process flows.

It is built for the moment before a refactor, migration, or onboarding session, when the important question is not only "what does this code do?" but "what depends on it, what breaks if it changes, and where should I look next?"

---

## Live Demo

🔗 **[vectron-app.vercel.app](https://vectron-app.vercel.app)**

Upload a repository ZIP or analyze a public GitHub URL. No signup required.

---

## Core Capabilities

| Capability | What VECTRON Does |
|---|---|
| Dependency graph generation | Parses source files and builds a typed graph of files, functions, classes, imports, calls, docs, and config relationships. |
| Blast radius simulation | Runs downstream traversal from any selected node to show affected dependencies and impact depth. |
| Interactive graph workspace | Renders large dependency graphs with Sigma.js, Graphology, filtering, search, sidebars, and node intelligence panels. |
| Process flow detection | Finds execution flows and renders Mermaid diagrams for call chains and file transitions. |
| AI codebase query | Compresses graph context and routes analysis through Featherless.ai, Groq, and Cerebras. |
| Intelligence reports | Produces architecture summaries, risk analysis, onboarding guidance, and multi-agent insights. |
| MCP server | Exposes graph-aware tools to AI coding assistants through Model Context Protocol over SSE. |

---

## Screenshots

| View | Preview |
|---|---|
| Graph View | ![Graph View](docs/screenshots/graph.png) |
| Blast Radius | ![Blast Radius](docs/screenshots/blast-radius.png) |
| Metrics Dashboard | ![Metrics](docs/screenshots/metrics.png) |
| AI Query | ![AI Query](docs/screenshots/ai-query.png) |
| Process Flows | ![Processes](docs/screenshots/processes.png) |
| Intelligence Report | ![Report](docs/screenshots/report.png) |

---

## How It Works

```mermaid
flowchart TD
    A[Repository Input] --> A1[ZIP Upload]
    A --> A2[GitHub URL]
    A1 --> B[Server Intake]
    A2 --> B

    B --> C[File Walker]
    C --> D{File Category}

    D -->|JS TS JSX TSX| E[Babel AST Parser]
    D -->|Python| F[Python Structure Parser]
    D -->|JSON YAML TOML| G[Config Parser]
    D -->|Markdown Docs| H[Documentation Parser]

    E --> I[Symbol Extraction]
    F --> I
    G --> I
    H --> I

    I --> J[Graph Builder]
    J --> J1[Create File Nodes]
    J --> J2[Create Symbol Nodes]
    J --> J3[Resolve Imports]
    J --> J4[Resolve Calls]
    J --> J5[Attach Docs and Config]

    J1 --> K[(Graph Store)]
    J2 --> K
    J3 --> K
    J4 --> K
    J5 --> K

    K --> L[React Workspace]
    K --> M[Analysis Services]
    K --> N[MCP Server]

    L --> L1[Sigma.js Renderer]
    L1 --> L2[ForceAtlas2 Layout]
    L2 --> L3[Interactive Graph]

    M --> M1[Blast Radius BFS]
    M --> M2[Risk Scoring]
    M --> M3[Process Detection]
    M --> M4[AI Reports]

    N --> N1[Claude Code]
    N --> N2[Cursor]
    N --> N3[Other MCP Clients]
```

---

## System Architecture

```mermaid
flowchart LR
    subgraph Client[Client: React + TypeScript + Vite]
        C1[Upload Zone]
        C2[Graph Workspace]
        C3[Explorer and Filters]
        C4[Node Intelligence]
        C5[Query, Metrics, Reports]
    end

    subgraph Server[Server: Express + TypeScript]
        S1[Upload and Clone Routes]
        S2[Parser Pipeline]
        S3[Graph Builder]
        S4[Graph Store]
        S5[LLM Orchestrator]
        S6[MCP SSE Server]
    end

    subgraph AI[AI Providers]
        A1[Featherless.ai]
        A2[Groq]
        A3[Cerebras]
    end

    subgraph Runtime[Runtime and Deployment]
        R1[Railway]
        R2[Nixpacks]
        R3[Environment Variables]
        R4[Health Checks]
    end

    C1 --> S1
    S1 --> S2
    S2 --> S3
    S3 --> S4
    S4 --> C2
    S4 --> C3
    S4 --> C4
    S4 --> C5
    C5 --> S5
    S5 --> A1
    S5 --> A2
    S5 --> A3
    S4 --> S6
    S6 --> C4
    R1 --> R2
    R2 --> Server
    R3 --> Server
    R4 --> Server
```

---

## Analysis Pipeline

```mermaid
sequenceDiagram
    participant User
    participant Client as React Client
    participant API as Express API
    participant Parser as Parser Pipeline
    participant Graph as Graph Builder
    participant Store as Graph Store
    participant AI as LLM Orchestrator

    User->>Client: Upload ZIP or submit GitHub URL
    Client->>API: POST repository payload
    API->>Parser: Extract files and classify source types
    Parser->>Parser: Parse functions, classes, imports, calls, docs, config
    Parser->>Graph: Send extracted symbols and relationships
    Graph->>Graph: Normalize IDs and resolve edges
    Graph->>Store: Persist GraphData in memory
    Store-->>Client: Return nodes, edges, metrics, files
    Client->>Client: Render Sigma.js graph
    User->>Client: Ask a question or select a node
    Client->>API: Send graph context and query
    API->>AI: Compress context and call provider chain
    AI-->>API: Explanation and relevant nodes
    API-->>Client: AI answer and graph highlights
```

---

## Graph Model

```mermaid
classDiagram
    class GraphData {
        nodes: GraphNode[]
        edges: GraphEdge[]
        files: SourceFile[]
        crossModuleEdges: number
    }

    class GraphNode {
        id: string
        label: string
        type: file | function | class | method | import | config | doc
        fileId: string
        startLine: number
        endLine: number
        metrics: NodeMetrics
    }

    class GraphEdge {
        source: string
        target: string
        type: DEFINES | IMPORTS | CALLS | EXTENDS | CONTAINS | DOCUMENTS
        weight: number
    }

    class NodeMetrics {
        inDegree: number
        outDegree: number
        riskScore: number
        blastRadius: number
    }

    class SourceFile {
        id: string
        path: string
        language: string
        content: string
    }

    GraphData "1" --> "*" GraphNode
    GraphData "1" --> "*" GraphEdge
    GraphData "1" --> "*" SourceFile
    GraphNode "1" --> "1" NodeMetrics
```

---

## AI and MCP Flow

```mermaid
flowchart TD
    A[Loaded GraphData] --> B[Context Compressor]
    B --> C{Requested Capability}

    C -->|Natural language question| D[AI Query]
    C -->|Architecture summary| E[Intelligence Report]
    C -->|Execution path| F[Process Analysis]
    C -->|External assistant request| G[MCP Tool Call]

    D --> H[LLM Router]
    E --> H
    F --> H

    H --> I[Featherless.ai]
    H --> J[Groq]
    H --> K[Cerebras]

    G --> M[MCP SSE Endpoint]
    M --> N[vectron_status]
    M --> O[vectron_blast_radius]
    M --> P[vectron_get_callers]
    M --> Q[vectron_get_dependencies]
    M --> R[vectron_query]

    I --> S[Answer + Relevant Nodes]
    J --> S
    K --> S
    S --> T[Graph Highlights and Panels]
```

---

## Quick Start

### Web (Instant)

Visit **[vectron-app.vercel.app](https://vectron-app.vercel.app)** and upload a repository ZIP.

### Local Development

```bash
git clone https://github.com/LAZYGENIUS69/VECTRON
cd VECTRON/vectron-app
npm install --prefix client
npm install --prefix server
npm run dev
```

Open:

```text
Frontend: http://localhost:5173
Backend:  http://localhost:3001
MCP SSE:  http://localhost:3002/sse
```

### Environment Variables

```env
FEATHERLESS_API_KEY=your_featherless_key_here
GROQ_API_KEY=your_groq_key_here
CEREBRAS_API_KEY=your_cerebras_key_here
CORS_ORIGIN=http://localhost:5173
PORT=3001
```

For Railway, add `FEATHERLESS_API_KEY`, `GROQ_API_KEY`, `CEREBRAS_API_KEY`, `CORS_ORIGIN`, and `PORT` in the service environment variables.

---

## API Surface

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/upload` | POST | Upload and analyze a ZIP repository. |
| `/api/clone` | POST | Analyze a public GitHub repository URL. |
| `/api/query` | POST | Ask an AI question against the loaded graph. |
| `/api/processes` | POST | Detect execution flows and Mermaid process diagrams. |
| `/api/report` | POST | Generate an architecture and risk intelligence report. |
| `/api/node-summary` | POST | Generate node-level AI summaries. |
| `/api/file` | GET | Return cached source file contents. |
| `/health` | GET | Runtime health check. |

---

## MCP Tools

| Tool | Parameters | Description |
|---|---|---|
| `vectron_status` | none | Check whether a graph is loaded. |
| `vectron_blast_radius` | `nodeLabel`, `depth?` | Find downstream impact from a node. |
| `vectron_get_callers` | `nodeLabel` | List functions or files that call a node. |
| `vectron_get_dependencies` | `nodeLabel` | List direct dependencies for a node. |
| `vectron_query` | `question` | Ask a natural language question about the codebase. |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, TypeScript, Vite |
| Graph Rendering | Sigma.js, Graphology, ForceAtlas2 |
| Backend | Express, Node.js, TypeScript |
| Parsing | Babel parser, custom Python/config/docs parsers |
| AI Layer | Featherless.ai, Groq, Cerebras |
| Process Diagrams | Mermaid |
| MCP | `@modelcontextprotocol/sdk` |
| Deployment | Railway, Nixpacks |

---

## Why VECTRON?

| Feature | VECTRON | General Chatbot | Code Completion Tool |
|---|---|---|---|
| Full dependency graph | Yes | No | No |
| Blast radius simulation | Yes | No | No |
| Interactive graph exploration | Yes | No | Limited |
| Codebase-aware MCP tools | Yes | No | No |
| Risk scoring | Yes | No | No |
| Process flow diagrams | Yes | No | No |
| Multi-provider AI layer | Yes | Limited | Limited |
| Self-hostable | Yes | No | Sometimes |

---

## Roadmap

- Deeper multi-provider AI orchestration for codebase analysis.
- Persistent graph storage for long-lived workspaces.
- Broader parser support for Java, Go, Rust, and C#.
- Team sharing controls for graph links and reports.
- More MCP tools for refactor planning and impact-aware code review.

---

## Contributing Guide

1. Fork the repo and create a feature branch.
2. Run the client and server locally from `vectron-app/`.
3. Keep changes scoped and verify with local builds before opening a PR.
4. Document any new endpoints, MCP tools, or UI workflows in the README.
5. Open a pull request with screenshots if the change affects the interface.

---

## What's Next

- ASI:One Agentverse Integration — register custom VECTRON agents on the Agentverse marketplace for deeper orchestration

---

## Architecture

```mermaid
graph TD
    A[🗂️ ZIP Upload] --> B[Babel AST Parser]
    B --> C[Graph Builder]
    C --> D[(Graph Store\nIn Memory)]

    D --> E[Sigma.js Renderer]
    E --> F[ForceAtlas2 Layout]
    F --> G[🔴 Interactive Graph]

    D --> H[Blast Radius BFS]
    H --> I[Risk Scoring]
    I --> G

    D --> J[ASI-1 LLM\nasi1]
    J --> K[AI Query]
    J --> L[Process Detection]
    J --> M[Intelligence Report]
    K --> G

    D --> N[MCP Server\nPort 3002]
    N --> O[Claude Code]
    N --> P[Cursor]
    N --> Q[Antigravity]

    style A fill:#1a1a2e,stroke:#00D9FF,color:#fff
    style G fill:#1a1a2e,stroke:#FF2D55,color:#fff
    style D fill:#1a1a2e,stroke:#00D9FF,color:#fff
    style N fill:#1a1a2e,stroke:#7B61FF,color:#fff
    style J fill:#1a1a2e,stroke:#FF9F0A,color:#fff
```

---

*Made with obsession by [@LAZYGENIUS69](https://github.com/LAZYGENIUS69)*
