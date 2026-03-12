import { useMemo, useState } from 'react';
import type { GraphNode } from '../types/graph';

// Interface for the hierarchical tree structure
interface ExplorerDir {
    type: 'dir';
    name: string;
    path: string;
    children: (ExplorerDir | ExplorerFile)[];
}

interface ExplorerFile {
    type: 'file';
    name: string;
    path: string;
    node: GraphNode;
}

interface ExplorerPanelProps {
    nodes: GraphNode[];
    focusedFileId: string | null;
    onFileClick: (fileId: string) => void;
}

function buildTree(fileNodes: GraphNode[]): ExplorerDir {
    const root: ExplorerDir = { type: 'dir', name: 'root', path: '', children: [] };

    for (const node of fileNodes) {
        const parts = node.filePath.replace(/\\/g, '/').split('/');
        let current = root;

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const isFile = i === parts.length - 1;
            const currPath = parts.slice(0, i + 1).join('/');

            if (isFile) {
                current.children.push({
                    type: 'file',
                    name: part,
                    path: currPath,
                    node
                });
            } else {
                let existingDir = current.children.find(c => c.type === 'dir' && c.name === part) as ExplorerDir | undefined;
                if (!existingDir) {
                    existingDir = { type: 'dir', name: part, path: currPath, children: [] };
                    current.children.push(existingDir);
                }
                current = existingDir;
            }
        }
    }

    // Sort: dirs first, then files
    const sortDir = (dir: ExplorerDir) => {
        dir.children.sort((a, b) => {
            if (a.type === b.type) return a.name.localeCompare(b.name);
            return a.type === 'dir' ? -1 : 1;
        });
        dir.children.forEach(c => { if (c.type === 'dir') sortDir(c); });
    };
    sortDir(root);

    return root;
}

const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
    <svg
        width="14" height="14" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round"
        style={{
            transform: expanded ? 'rotate(90deg)' : 'none',
            transition: 'transform 0.1s ease-in-out',
            marginRight: 6,
            opacity: 0.7
        }}
    >
        <polyline points="9 18 15 12 9 6"></polyline>
    </svg>
);

const FileIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, opacity: 0.6 }}>
        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
        <polyline points="13 2 13 9 20 9"></polyline>
    </svg>
);

function DirNode({ dir, level, focusedFileId, onFileClick }: { dir: ExplorerDir, level: number, focusedFileId: string | null, onFileClick: (id: string) => void }) {
    const [expanded, setExpanded] = useState(level < 1); // Auto-expand only root by default

    return (
        <div className="explorer-item-container">
            <div
                className="explorer-item explorer-dir"
                style={{ paddingLeft: level * 12 + 12 }}
                onClick={() => setExpanded(e => !e)}
            >
                <ChevronIcon expanded={expanded} />
                <span className="explorer-name">{dir.name}</span>
            </div>
            {expanded && (
                <div className="explorer-children">
                    {dir.children.map(child => child.type === 'dir'
                        ? <DirNode key={child.path} dir={child} level={level + 1} focusedFileId={focusedFileId} onFileClick={onFileClick} />
                        : <FileNode key={child.path} file={child} level={level + 1} focusedFileId={focusedFileId} onFileClick={onFileClick} />
                    )}
                </div>
            )}
        </div>
    );
}

function FileNode({ file, level, focusedFileId, onFileClick }: { file: ExplorerFile, level: number, focusedFileId: string | null, onFileClick: (id: string) => void }) {
    const isFocused = focusedFileId === file.node.fileId;
    return (
        <div
            className={`explorer-item explorer-file ${isFocused ? 'focused' : ''}`}
            style={{ paddingLeft: level * 12 + 12 + 20 }} // Add extra 20px for the missing chevron
            onClick={() => onFileClick(file.node.fileId)}
        >
            <FileIcon />
            <span className="explorer-name">{file.name}</span>
        </div>
    );
}

export default function ExplorerPanel({ nodes, focusedFileId, onFileClick }: ExplorerPanelProps) {
    const fileNodes = useMemo(() => nodes.filter(n => n.type === 'file'), [nodes]);
    const tree = useMemo(() => buildTree(fileNodes), [fileNodes]);

    return (
        <div className="explorer-tree-container" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="panel-header">EXPLORER</div>
            <div className="explorer-tree">
                {tree.children.map(child => child.type === 'dir'
                    ? <DirNode key={child.path} dir={child} level={0} focusedFileId={focusedFileId} onFileClick={onFileClick} />
                    : <FileNode key={child.path} file={child} level={0} focusedFileId={focusedFileId} onFileClick={onFileClick} />
                )}
            </div>
        </div>
    );
}
