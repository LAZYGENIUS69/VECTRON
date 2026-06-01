import JSZip from 'jszip';
import type { DetectedProcess, EdgeKind, GraphData, GraphNode } from '../types/graph';

type GraphNodeType = GraphNode['type'];

type SourceFile = {
    path: string;
    content: string;
};

type ParsedNode = {
    name: string;
    type: GraphNodeType;
    edgeKind: EdgeKind;
    startLine?: number;
    endLine?: number;
};

type ParsedFile = {
    fileNodeType: 'file' | 'doc';
    nodes: ParsedNode[];
    imports: string[];
    callees: string[];
};

const MAX_FILE_BYTES = 500 * 1024;
const MAX_SOURCE_FILES = 2500;
const MAX_TOTAL_SOURCE_BYTES = 25 * 1024 * 1024;
const CALLABLE_NODE_TYPES = new Set<GraphNodeType>([
    'function',
    'method',
    'python_function',
    'python_class',
]);
const NON_FILE_NODE_TYPES = new Set<GraphNodeType>([
    'function',
    'class',
    'method',
    'import',
    'python_function',
    'python_class',
    'config',
    'doc',
]);
const PYTHON_CALL_IGNORE = new Set([
    'and',
    'class',
    'def',
    'elif',
    'except',
    'False',
    'for',
    'from',
    'if',
    'import',
    'in',
    'is',
    'lambda',
    'None',
    'not',
    'or',
    'print',
    'raise',
    'return',
    'True',
    'while',
    'with',
    'yield',
]);

let sequence = 0;
let localFileCache = new Map<string, string>();

function uid(prefix: string): string {
    sequence += 1;
    return `${prefix}_${sequence}`;
}

function byteLength(text: string): number {
    return new TextEncoder().encode(text).length;
}

function basename(filePath: string): string {
    return filePath.split('/').pop() || filePath;
}

function dirname(filePath: string): string {
    const parts = filePath.split('/');
    parts.pop();
    return parts.join('/') || '.';
}

function joinPath(...parts: string[]): string {
    const stack: string[] = [];
    parts.join('/').split('/').forEach((part) => {
        if (!part || part === '.') return;
        if (part === '..') {
            stack.pop();
            return;
        }
        stack.push(part);
    });
    return stack.join('/');
}

function normalizeRepoPath(filePath: string): string {
    return filePath.replace(/\\/g, '/').replace(/^\.\//, '');
}

function extractModule(filePath: string): string {
    const parts = normalizeRepoPath(filePath).split('/');
    return parts.length > 1 ? parts[0] : 'root';
}

function isIgnoredSourcePath(entryPath: string): boolean {
    return /(node_modules|\.git|dist|build|\.next|coverage|vendor|target|__pycache__)\//.test(entryPath);
}

function isSupportedSourceFile(entryPath: string): boolean {
    if (isIgnoredSourcePath(entryPath)) return false;
    if (/(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|poetry\.lock|Cargo\.lock)$/i.test(entryPath)) {
        return false;
    }
    return /\.(js|jsx|ts|tsx|py|json|ya?ml|md)$/i.test(entryPath);
}

function createEmptyParsedFile(fileNodeType: 'file' | 'doc' = 'file'): ParsedFile {
    return {
        fileNodeType,
        nodes: [],
        imports: [],
        callees: [],
    };
}

function addUnique(items: string[], seen: Set<string>, value: string) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    items.push(trimmed);
}

function parseJavaScriptLikeFile(content: string): ParsedFile {
    const parsed = createEmptyParsedFile();
    const seenNodes = new Set<string>();
    const seenImports = new Set<string>();
    const seenCallees = new Set<string>();
    const lines = content.split(/\r?\n/);

    const addNode = (node: ParsedNode) => {
        const key = `${node.type}:${node.name}`;
        if (seenNodes.has(key)) return;
        seenNodes.add(key);
        parsed.nodes.push(node);
    };

    lines.forEach((line, index) => {
        const lineNumber = index + 1;
        const importMatches = [
            ...line.matchAll(/\bimport\s+(?:[^'"]+\s+from\s+)?['"]([^'"]+)['"]/g),
            ...line.matchAll(/\bexport\s+[^'"]+\s+from\s+['"]([^'"]+)['"]/g),
            ...line.matchAll(/\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g),
        ];

        importMatches.forEach((match) => {
            const specifier = match[1];
            addNode({ name: specifier, type: 'import', edgeKind: 'DEFINES', startLine: lineNumber, endLine: lineNumber });
            addUnique(parsed.imports, seenImports, specifier);
        });

        const functionMatch = line.match(/\b(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/);
        if (functionMatch) {
            addNode({ name: functionMatch[1], type: 'function', edgeKind: 'DEFINES', startLine: lineNumber, endLine: lineNumber });
        }

        const variableFunctionMatch = line.match(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/);
        if (variableFunctionMatch) {
            addNode({ name: variableFunctionMatch[1], type: 'function', edgeKind: 'DEFINES', startLine: lineNumber, endLine: lineNumber });
        }

        const classMatch = line.match(/\b(?:export\s+)?class\s+([A-Za-z_$][\w$]*)\b/);
        if (classMatch) {
            addNode({ name: classMatch[1], type: 'class', edgeKind: 'DEFINES', startLine: lineNumber, endLine: lineNumber });
        }

        const methodMatch = line.match(/^\s*(?:async\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/);
        if (methodMatch && !['if', 'for', 'while', 'switch', 'catch', 'function'].includes(methodMatch[1])) {
            addNode({ name: methodMatch[1], type: 'method', edgeKind: 'DEFINES', startLine: lineNumber, endLine: lineNumber });
        }

        for (const match of line.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)) {
            const callee = match[1];
            if (['if', 'for', 'while', 'switch', 'catch', 'function', 'require'].includes(callee)) continue;
            addUnique(parsed.callees, seenCallees, callee);
        }
    });

    return parsed;
}

function parsePythonFile(content: string): ParsedFile {
    const parsed = createEmptyParsedFile();
    const seenNodes = new Set<string>();
    const seenImports = new Set<string>();
    const seenCallees = new Set<string>();

    const addNode = (node: ParsedNode) => {
        const key = `${node.type}:${node.name}`;
        if (seenNodes.has(key)) return;
        seenNodes.add(key);
        parsed.nodes.push(node);
    };

    content.split(/\r?\n/).forEach((line, index) => {
        const lineNumber = index + 1;
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;

        const importMatch = trimmed.match(/^import\s+(.+)$/);
        if (importMatch) {
            importMatch[1]
                .split(',')
                .map((part) => part.trim().split(/\s+as\s+/i)[0]?.trim())
                .filter(Boolean)
                .forEach((moduleName) => {
                    addNode({ name: moduleName, type: 'import', edgeKind: 'DEFINES', startLine: lineNumber, endLine: lineNumber });
                    addUnique(parsed.imports, seenImports, moduleName);
                });
        }

        const fromImportMatch = trimmed.match(/^from\s+([.\w]+)\s+import\s+(.+)$/);
        if (fromImportMatch) {
            addNode({ name: fromImportMatch[1], type: 'import', edgeKind: 'DEFINES', startLine: lineNumber, endLine: lineNumber });
            addUnique(parsed.imports, seenImports, fromImportMatch[1]);
        }

        const functionMatch = trimmed.match(/^def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/);
        if (functionMatch) {
            addNode({ name: functionMatch[1], type: 'python_function', edgeKind: 'DEFINES', startLine: lineNumber, endLine: lineNumber });
        }

        const classMatch = trimmed.match(/^class\s+([A-Za-z_][A-Za-z0-9_]*)\b/);
        if (classMatch) {
            addNode({ name: classMatch[1], type: 'python_class', edgeKind: 'DEFINES', startLine: lineNumber, endLine: lineNumber });
        }

        if (/^(def|class|from|import)\b/.test(trimmed)) return;
        for (const match of trimmed.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\s*\(/g)) {
            const callee = match[1];
            if (PYTHON_CALL_IGNORE.has(callee)) continue;
            addUnique(parsed.callees, seenCallees, callee);
        }
    });

    return parsed;
}

function parseJsonFile(content: string): ParsedFile {
    const parsed = createEmptyParsedFile();
    try {
        const value = JSON.parse(content) as unknown;
        if (!value || typeof value !== 'object' || Array.isArray(value)) return parsed;
        Object.keys(value).forEach((key) => parsed.nodes.push({ name: key, type: 'config', edgeKind: 'CONTAINS' }));
    } catch {
        return parsed;
    }
    return parsed;
}

function parseYamlFile(content: string): ParsedFile {
    const parsed = createEmptyParsedFile();
    const seenKeys = new Set<string>();
    content.split(/\r?\n/).forEach((line) => {
        if (!line.trim() || line.trim().startsWith('#') || /^\s/.test(line)) return;
        const keyMatch = line.match(/^([A-Za-z0-9_.-]+)\s*:/);
        if (keyMatch) seenKeys.add(keyMatch[1]);
    });
    seenKeys.forEach((key) => parsed.nodes.push({ name: key, type: 'config', edgeKind: 'CONTAINS' }));
    return parsed;
}

function parseMarkdownFile(content: string): ParsedFile {
    const parsed = createEmptyParsedFile('doc');
    const seenHeadings = new Set<string>();
    content.split(/\r?\n/).forEach((line, index) => {
        const headingMatch = line.match(/^(#{1,2})\s+(.+?)\s*$/);
        if (!headingMatch) return;
        const heading = headingMatch[2].trim();
        if (!heading || seenHeadings.has(heading)) return;
        seenHeadings.add(heading);
        parsed.nodes.push({ name: heading, type: 'doc', edgeKind: 'DOCUMENTS', startLine: index + 1, endLine: index + 1 });
    });
    return parsed;
}

function parseFile(filePath: string, content: string): ParsedFile | null {
    if (byteLength(content) > MAX_FILE_BYTES) return null;
    const ext = filePath.split('.').pop()?.toLowerCase();
    if (['js', 'jsx', 'ts', 'tsx'].includes(ext || '')) return parseJavaScriptLikeFile(content);
    if (ext === 'py') return parsePythonFile(content);
    if (ext === 'json') return parseJsonFile(content);
    if (ext === 'yaml' || ext === 'yml') return parseYamlFile(content);
    if (ext === 'md') return parseMarkdownFile(content);
    return null;
}

function resolveRelativePythonImport(importerPath: string, specifier: string): string {
    const normalized = specifier.replace(/\.+/g, (dots) => `__DOTS__${dots.length}__`);
    if (!normalized.startsWith('__DOTS__')) return specifier.replace(/\./g, '/');

    const first = normalized.split('/')[0];
    const dotCount = Number(first.replace(/[^0-9]/g, '')) || 1;
    const remainder = specifier.slice(dotCount).replace(/\./g, '/');
    const baseParts = dirname(importerPath).split('/');
    const keepLength = Math.max(0, baseParts.length - (dotCount - 1));
    return [baseParts.slice(0, keepLength).join('/'), remainder].filter(Boolean).join('/');
}

function resolveImport(importerPath: string, specifier: string, knownPaths: Set<string>): string | null {
    const extensionCandidates = [
        '',
        '.ts',
        '.tsx',
        '.js',
        '.jsx',
        '.py',
        '.json',
        '.yaml',
        '.yml',
        '.md',
        '/index.ts',
        '/index.tsx',
        '/index.js',
        '/index.jsx',
        '/__init__.py',
    ];

    let bases: string[] = [];
    if (specifier.startsWith('./') || specifier.startsWith('../')) {
        bases = [joinPath(dirname(importerPath), specifier)];
    } else if (/^\.+[A-Za-z0-9_.-]*$/.test(specifier)) {
        bases = [resolveRelativePythonImport(importerPath, specifier)];
    } else if (specifier.includes('.')) {
        bases = [specifier.replace(/\./g, '/')];
    } else {
        return null;
    }

    for (const baseCandidate of bases) {
        for (const extension of extensionCandidates) {
            const candidate = `${baseCandidate}${extension}`;
            if (knownPaths.has(candidate)) return candidate;
        }
    }

    return null;
}

function buildGraph(files: SourceFile[]): GraphData {
    sequence = 0;
    const nodes: GraphNode[] = [];
    const edges: GraphData['edges'] = [];
    const fileNodeMap = new Map<string, string>();
    const knownPaths = new Set(files.map((file) => file.path));
    const parsedFiles = new Map<string, ParsedFile | null>();

    files.forEach((file) => parsedFiles.set(file.path, parseFile(file.path, file.content)));

    for (const file of files) {
        const nodeId = uid('file');
        const parsed = parsedFiles.get(file.path);
        fileNodeMap.set(file.path, nodeId);
        nodes.push({
            id: nodeId,
            label: basename(file.path),
            type: parsed?.fileNodeType === 'doc' ? 'doc' : 'file',
            fileId: file.path,
            filePath: file.path,
            centrality: 0,
            module: extractModule(file.path),
        });
    }

    const callableNameToIds = new Map<string, string[]>();
    const fileMetadata = new Map<string, { callees: string[]; fileNodeId: string }>();

    for (const file of files) {
        const parsed = parsedFiles.get(file.path);
        if (!parsed) continue;

        const fileNodeId = fileNodeMap.get(file.path)!;
        const mod = extractModule(file.path);

        for (const parsedNode of parsed.nodes) {
            const nodeId = uid('node');
            nodes.push({
                id: nodeId,
                label: parsedNode.name,
                type: parsedNode.type,
                fileId: file.path,
                filePath: file.path,
                startLine: parsedNode.startLine,
                endLine: parsedNode.endLine,
                centrality: 0,
                module: mod,
            });

            if (CALLABLE_NODE_TYPES.has(parsedNode.type)) {
                if (!callableNameToIds.has(parsedNode.name)) callableNameToIds.set(parsedNode.name, []);
                callableNameToIds.get(parsedNode.name)!.push(nodeId);
            }

            if (parsedNode.type !== 'import') {
                edges.push({ id: uid('e'), source: fileNodeId, target: nodeId, kind: parsedNode.edgeKind });
            }
        }

        parsed.imports.forEach((specifier) => {
            const targetPath = resolveImport(file.path, specifier, knownPaths);
            if (!targetPath) return;
            const targetId = fileNodeMap.get(targetPath);
            if (!targetId || targetId === fileNodeId) return;
            edges.push({ id: uid('e'), source: fileNodeId, target: targetId, kind: 'IMPORTS' });
        });

        fileMetadata.set(file.path, { callees: parsed.callees, fileNodeId });
    }

    for (const file of files) {
        const metadata = fileMetadata.get(file.path);
        if (!metadata) continue;

        const sourceNodeIds = nodes
            .filter((node) => NON_FILE_NODE_TYPES.has(node.type) && node.type !== 'import' && node.filePath === file.path)
            .map((node) => node.id);

        metadata.callees.forEach((callee) => {
            const targetIds = callableNameToIds.get(callee);
            if (!targetIds) return;
            sourceNodeIds.forEach((sourceId) => {
                targetIds.forEach((targetId) => {
                    if (sourceId === targetId) return;
                    edges.push({ id: uid('e'), source: sourceId, target: targetId, kind: 'CALLS' });
                });
            });
        });
    }

    const outDegree = new Map<string, number>();
    nodes.forEach((node) => outDegree.set(node.id, 0));
    edges.forEach((edge) => outDegree.set(edge.source, (outDegree.get(edge.source) ?? 0) + 1));

    const maxDegree = Math.max(1, ...outDegree.values());
    nodes.forEach((node) => {
        node.centrality = (outDegree.get(node.id) ?? 0) / maxDegree;
    });

    const nodeModuleMap = new Map(nodes.map((node) => [node.id, node.module]));
    const crossModuleEdges = edges.reduce((count, edge) => {
        const srcMod = nodeModuleMap.get(edge.source);
        const tgtMod = nodeModuleMap.get(edge.target);
        return srcMod && tgtMod && srcMod !== tgtMod ? count + 1 : count;
    }, 0);

    return { nodes, edges, crossModuleEdges };
}

export async function parseZipLocally(file: File): Promise<GraphData> {
    const zip = await JSZip.loadAsync(file);
    const sourceFiles: SourceFile[] = [];
    let totalSourceBytes = 0;

    const entries = Object.values(zip.files).sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
        if (sourceFiles.length >= MAX_SOURCE_FILES) break;
        if (entry.dir) continue;

        const entryPath = normalizeRepoPath(entry.name);
        if (!isSupportedSourceFile(entryPath)) continue;

        const blob = await entry.async('blob');
        if (blob.size > MAX_FILE_BYTES) continue;
        if (totalSourceBytes + blob.size > MAX_TOTAL_SOURCE_BYTES) continue;

        const content = await blob.text();
        sourceFiles.push({ path: entryPath, content });
        totalSourceBytes += blob.size;
    }

    if (sourceFiles.length === 0) {
        throw new Error('No supported JS, TS, Python, JSON, YAML, or Markdown files found in the zip.');
    }

    localFileCache = new Map(sourceFiles.map((sourceFile) => [sourceFile.path, sourceFile.content]));
    return buildGraph(sourceFiles);
}

export function getLocalFileContent(filePath: string): string | undefined {
    return localFileCache.get(filePath);
}

function sanitizeMermaidLabel(label: string): string {
    return label.replace(/[\[\]{}()|"]/g, '').slice(0, 80) || 'step';
}

export function detectProcessesLocally(
    graphData: GraphData,
    focusNode?: string | null,
    minimumSteps = 3,
): DetectedProcess[] {
    const nodeById = new Map(graphData.nodes.map((node) => [node.id, node]));
    const outgoing = new Map<string, string[]>();
    const incoming = new Map<string, string[]>();

    graphData.nodes.forEach((node) => {
        outgoing.set(node.id, []);
        incoming.set(node.id, []);
    });

    graphData.edges.forEach((edge) => {
        outgoing.get(edge.source)?.push(edge.target);
        incoming.get(edge.target)?.push(edge.source);
    });

    const scoreNode = (nodeId: string): number => {
        const node = nodeById.get(nodeId);
        const out = outgoing.get(nodeId)?.length ?? 0;
        const inc = incoming.get(nodeId)?.length ?? 0;
        const typeBoost = node && ['function', 'method', 'class', 'python_function', 'python_class', 'file'].includes(node.type) ? 2 : 0;
        return out * 2 + inc + (node?.centrality ?? 0) * 10 + typeBoost;
    };

    const extendForward = (startId: string, maxSteps = 5): string[] => {
        const visited = new Set<string>([startId]);
        const path = [startId];
        let currentId = startId;

        while (path.length < maxSteps) {
            const nextId = (outgoing.get(currentId) ?? [])
                .filter((candidateId) => !visited.has(candidateId))
                .sort((a, b) => scoreNode(b) - scoreNode(a))[0];
            if (!nextId) break;
            path.push(nextId);
            visited.add(nextId);
            currentId = nextId;
        }

        return path;
    };

    const buildFocusedPath = (focusId: string, maxSteps = 5): string[] => {
        const prefix = (incoming.get(focusId) ?? []).sort((a, b) => scoreNode(b) - scoreNode(a))[0];
        return Array.from(new Set([...(prefix ? [prefix] : []), ...extendForward(focusId, maxSteps - (prefix ? 1 : 0))]));
    };

    const candidateIds = focusNode
        ? graphData.nodes.filter((node) => node.label === focusNode).map((node) => node.id)
        : graphData.nodes
            .filter((node) => ['file', 'function', 'method', 'class', 'python_function', 'python_class'].includes(node.type))
            .sort((a, b) => scoreNode(b.id) - scoreNode(a.id))
            .slice(0, 12)
            .map((node) => node.id);

    const processes: DetectedProcess[] = [];
    const seenSignatures = new Set<string>();

    for (const candidateId of candidateIds) {
        const pathIds = focusNode ? buildFocusedPath(candidateId) : extendForward(candidateId);
        const pathNodes = pathIds
            .map((nodeId) => nodeById.get(nodeId))
            .filter((node): node is GraphNode => Boolean(node));

        if (pathNodes.length < minimumSteps) continue;
        if (focusNode && !pathNodes.some((node) => node.label === focusNode)) continue;

        const signature = pathNodes.map((node) => node.label).join('>');
        if (seenSignatures.has(signature)) continue;
        seenSignatures.add(signature);

        const mermaidLines = ['graph TD'];
        pathNodes.forEach((node, index) => {
            mermaidLines.push(`  N${index}[${sanitizeMermaidLabel(node.label)}]`);
            if (index > 0) mermaidLines.push(`  N${index - 1} --> N${index}`);
        });

        const startNode = pathNodes[0];
        processes.push({
            name: `${sanitizeMermaidLabel(startNode.label)} Flow`,
            steps: pathNodes.length,
            entryPoint: startNode.label,
            explanation: `Local flow beginning at ${startNode.label} and following the strongest reachable dependencies in the current graph.`,
            mermaid: mermaidLines.join('\n'),
        });

        if (processes.length >= 6) break;
    }

    return processes;
}
