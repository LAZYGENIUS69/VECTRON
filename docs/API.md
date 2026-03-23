# VECTRON API Reference

Base URL: https://vectron-production.up.railway.app

## POST /api/upload
Upload a ZIP file for analysis.
Content-Type: multipart/form-data
Body: file (ZIP file, max 500MB)
Returns: GraphData object

## POST /api/github
Analyze a GitHub repository by URL.
Body: `{ "githubUrl": "https://github.com/owner/repo" }`
Returns: GraphData object

## POST /api/query
Natural language query about the codebase.
Body:
```json
{
  "question": "how does file upload work?",
  "graphData": "GraphData",
  "llmConfig": "optional custom LLM config"
}
```
Returns: `{ "explanation": string, "relevantNodes": string[] }`

## POST /api/processes
Detect all process flows in the codebase.
Body: `{ "graphData": GraphData }`
Returns: `{ "processes": Process[] }`

## POST /api/report
Generate a codebase intelligence report.
Body: `{ "graphData": GraphData }`
Returns: `{ "report": string (markdown) }`

## GET /api/dead-code
Find nodes with zero incoming edges.
Returns: `{ "deadNodes": GraphNode[] }`

## POST /api/share
Create a shareable link for the current graph.
Returns: `{ "shareId": string, "url": string }`

## GET /api/share/:id
Retrieve a shared graph by ID.
Returns: GraphData object

## GET /health
Health check endpoint.
Returns: `{ "status": "ok" }`
