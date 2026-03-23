# VECTRON MCP Integration Guide

## Overview
VECTRON exposes a Model Context Protocol (MCP) server on port 3002,
giving AI coding assistants structural codebase context.

## Quick Setup

### Antigravity / OpenCode
Add to MCP settings:
- Name: VECTRON
- URL: http://localhost:3002/sse
- Type: Streamable HTTP

### Claude Code
Add to ~/.claude/mcp.json:
```json
{
  "mcpServers": {
    "vectron": {
      "url": "http://localhost:3002/sse",
      "type": "http"
    }
  }
}
```

### Cursor
Add to ~/.cursor/mcp.json:
```json
{
  "mcpServers": {
    "vectron": {
      "command": "node",
      "url": "http://localhost:3002/sse"
    }
  }
}
```

## Tools Reference

### vectron_status
Check if a graph is loaded.
No parameters required.
Example: "Use VECTRON to check status"

### vectron_blast_radius
Find all nodes affected by changing a given node.
Parameters:
- nodeLabel (string, required): name of the node
- depth (number, optional, default 3): how many hops to trace
Example: "Use VECTRON to find blast radius of GraphView2D"

### vectron_get_callers
Find everything that calls or imports a given node.
Parameters:
- nodeLabel (string, required): name of the node
Example: "Use VECTRON to find everything that calls handleUpload"

### vectron_get_dependencies
Find everything a given node depends on.
Parameters:
- nodeLabel (string, required): name of the node
Example: "Use VECTRON to find what App.tsx depends on"

### vectron_query
Ask a natural language question about the codebase.
Parameters:
- question (string, required): your question
Example: "Use VECTRON to answer: how does authentication work?"

## Example Workflow

1. Start VECTRON locally:
   `cd vectron-app && npm run dev`

2. Upload your codebase at `localhost:5173`

3. Connect MCP in your editor

4. Ask your AI assistant:
   "I want to refactor the parseAST function.
    Use VECTRON to check the blast radius first."

5. AI automatically calls `vectron_blast_radius("parseAST")`
   and returns every affected file before touching anything.
