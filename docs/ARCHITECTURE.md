# VECTRON Architecture

VECTRON is a full-stack dependency intelligence system. It turns source repositories into a graph-backed analysis workspace for refactor planning, onboarding, process tracing, risk scoring, AI codebase queries, and MCP-powered coding assistants.

---

## System Layers

```mermaid
flowchart TB
    subgraph Input[Repository Inputs]
        I1[ZIP Upload]
        I2[GitHub URL]
        I3[Future: Connected Repo]
    end

    subgraph Backend[Backend Runtime]
        B1[Express API]
        B2[Archive and Clone Intake]
        B3[File Walker]
        B4[Parser Pipeline]
        B5[Graph Builder]
        B6[(In-Memory Graph Store)]
        B7[Analysis Services]
        B8[LLM Router]
        B9[MCP SSE Server]
    end

    subgraph Frontend[Frontend Workspace]
        F1[Upload Zone]
        F2[Sigma.js Graph]
        F3[Explorer and Filters]
        F4[Node Intelligence]
        F5[Metrics Dashboard]
        F6[Process Flow Viewer]
        F7[AI Query and Report Panels]
    end

    subgraph Providers[AI Providers]
        P1[Featherless.ai]
        P2[Groq]
        P3[Cerebras]
    end

    subgraph Assistants[MCP Clients]
        M1[Claude Code]
        M2[Cursor]
        M3[Other MCP Clients]
    end

    I1 --> B2
    I2 --> B2
    I3 --> B2
    F1 --> B1
    B1 --> B2
    B2 --> B3
    B3 --> B4
    B4 --> B5
    B5 --> B6
    B6 --> B7
    B6 --> F2
    B6 --> F3
    B6 --> F4
    B7 --> F5
    B7 --> F6
    F7 --> B8
    B8 --> P1
    B8 --> P2
    B8 --> P3
    B6 --> B9
    B9 --> M1
    B9 --> M2
    B9 --> M3
```

---

## Parsing and Graph Construction

```mermaid
flowchart TD
    A[Repository Files] --> B{Supported Type}

    B -->|.js .jsx .ts .tsx| C[Babel AST Parse]
    B -->|.py| D[Python Structure Parse]
    B -->|.json .yaml .yml .toml| E[Config Parse]
    B -->|.md .mdx| F[Documentation Parse]
    B -->|Unsupported| G[Skip or Store Metadata]

    C --> H[Extract Imports]
    C --> I[Extract Functions]
    C --> J[Extract Classes and Methods]
    C --> K[Extract Call Expressions]

    D --> L[Extract Python Functions and Classes]
    E --> M[Extract Config Nodes]
    F --> N[Extract Documentation Nodes]

    H --> O[Graph Builder]
    I --> O
    J --> O
    K --> O
    L --> O
    M --> O
    N --> O

    O --> P[Pass 1: Create File Nodes]
    P --> Q[Pass 2: Create Symbol Nodes]
    Q --> R[Pass 3: Resolve Relationship Edges]
    R --> S[Calculate Cross-Module Edges]
    S --> T[Return GraphData]
```

---

## Graph Relationship Types

```mermaid
erDiagram
    FILE ||--o{ SYMBOL : DEFINES
    FILE ||--o{ FILE : IMPORTS
    FUNCTION ||--o{ FUNCTION : CALLS
    CLASS ||--o{ CLASS : EXTENDS
    FILE ||--o{ CONFIG : CONTAINS
    DOC ||--o{ FILE : DOCUMENTS

    FILE {
        string id
        string path
        string language
        string content
    }

    SYMBOL {
        string id
        string label
        string type
        string fileId
        number startLine
        number endLine
    }

    CONFIG {
        string id
        string label
        string fileId
    }

    DOC {
        string id
        string label
        string fileId
    }
```

---

## Request Lifecycle

```mermaid
sequenceDiagram
    participant User
    participant Client
    participant API
    participant Parser
    participant Builder
    participant Store
    participant GraphUI

    User->>Client: Upload ZIP or paste GitHub URL
    Client->>API: POST /api/upload or /api/clone
    API->>Parser: Extract and parse repository files
    Parser-->>Builder: Parsed files, symbols, imports, calls
    Builder->>Builder: Normalize nodes and resolve edges
    Builder->>Store: Save GraphData
    Store-->>API: Graph snapshot
    API-->>Client: GraphData response
    Client->>GraphUI: Render nodes and edges
    User->>GraphUI: Select node or apply filters
    GraphUI->>GraphUI: Highlight dependencies and update panels
```

---

## Blast Radius Algorithm

```mermaid
flowchart TD
    A[Selected Node] --> B[Initialize Queue]
    B --> C[Visit Outgoing Edges]
    C --> D{Depth Limit Reached?}
    D -->|No| E[Add Target Nodes]
    E --> F[Record Depth Map]
    F --> C
    D -->|Yes| G[Stop Traversal]
    G --> H[Calculate Impact Metrics]
    H --> I[Impacted Nodes]
    H --> J[Impacted Files]
    H --> K[Maximum Cascade Depth]
    H --> L[Risk Level]
    I --> M[Graph Highlight Overlay]
    J --> M
    K --> M
    L --> M
```

---

## AI Layer Flow

```mermaid
flowchart LR
    A[GraphData] --> B[Context Compressor]
    B --> C[Prompt Builder]
    C --> D[LLM Router]

    D --> E[Featherless.ai]
    D --> G[Groq]
    D --> H[Cerebras]

    E --> I[Structured AI Result]
    G --> I
    H --> I

    I --> J[Text Explanation]
    I --> K[Relevant Node IDs]
    I --> L[Process Mermaid]
    I --> M[Report Markdown]
```

---

## MCP Integration

```mermaid
flowchart TD
    A[AI Coding Assistant] --> B[MCP SSE Connection]
    B --> C[VECTRON MCP Server]
    C --> D{Tool}
    D -->|status| E[vectron_status]
    D -->|impact| F[vectron_blast_radius]
    D -->|callers| G[vectron_get_callers]
    D -->|dependencies| H[vectron_get_dependencies]
    D -->|question| I[vectron_query]

    E --> J[(Graph Store)]
    F --> J
    G --> J
    H --> J
    I --> J
    I --> K[LLM Router]

    J --> L[Graph-Aware Result]
    K --> L
    L --> A
```

---

## Key Design Decisions

| Decision | Reason |
|---|---|
| In-memory graph store | Keeps single-session analysis fast and simple for uploaded repositories. |
| Sigma.js and Graphology | WebGL rendering handles larger graphs more comfortably than SVG-heavy approaches. |
| Babel parser for JS/TS | Mature support for modern JavaScript, TypeScript, JSX, and TSX syntax. |
| Multi-provider AI layer | Keeps graph-aware reasoning available through Featherless.ai, Groq, and Cerebras. |
| MCP SSE server | Lets external AI coding tools query the same graph context visible in the UI. |
| Railway and Nixpacks | Keeps deployment lightweight while supporting client and server builds. |

---

## Runtime Structure

```text
vectron-app/
|-- client/
|   |-- src/
|   |   |-- components/       Workspace UI, graph panels, reports, process views
|   |   |-- lib/              API helpers and client-side graph metrics
|   |   |-- types/            Shared GraphData types
|   |   `-- App.tsx           Primary application shell
|   `-- package.json
|-- server/
|   |-- src/
|   |   |-- index.ts          Express API routes and LLM orchestration
|   |   |-- parser.ts         Source parsing and symbol extraction
|   |   |-- graph-builder.ts  GraphData assembly and relationship resolution
|   |   |-- graph-store.ts    Current graph singleton
|   |   `-- mcp-server.ts     MCP tools over SSE
|   `-- package.json
|-- nixpacks.toml             Railway build/start commands
`-- package.json              App-level development and production scripts
```
