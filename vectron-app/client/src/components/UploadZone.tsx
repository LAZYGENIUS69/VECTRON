import { useEffect, useRef, useState, useCallback, type ChangeEvent } from 'react';
import { cloneGithubRepo, uploadZip, uploadZipFromPath } from '../lib/api';
import type { GraphData } from '../types/graph';

interface UploadZoneProps {
    onGraph: (data: GraphData) => void;
}

type UploadMode = 'zip' | 'github';
type LoadingMode = 'zip' | 'github' | null;

const GITHUB_LOADING_STEPS = [
    'Cloning repository...',
    'Parsing files...',
    'Building graph...',
] as const;

const EXAMPLE_REPOS = [
    'facebook/react',
    'expressjs/express',
    'microsoft/typescript',
] as const;

function buildGithubUrl(example: string) {
    return `https://github.com/${example}`;
}

export default function UploadZone({ onGraph }: UploadZoneProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [mode, setMode] = useState<UploadMode>('zip');
    const [dragging, setDragging] = useState(false);
    const [loadingMode, setLoadingMode] = useState<LoadingMode>(null);
    const [loadingStepIndex, setLoadingStepIndex] = useState(0);
    const [githubUrl, setGithubUrl] = useState('');
    const [zipPath, setZipPath] = useState('');
    const [error, setError] = useState<string | null>(null);

    const isLoading = loadingMode !== null;
    const canAnalyzeGithub = githubUrl.trim().length > 0 && !isLoading;
    const canAnalyzeZipPath = zipPath.trim().length > 0 && !isLoading;

    useEffect(() => {
        if (loadingMode !== 'github') {
            setLoadingStepIndex(0);
            return;
        }

        const interval = window.setInterval(() => {
            setLoadingStepIndex((current) => {
                if (current >= GITHUB_LOADING_STEPS.length - 1) {
                    return current;
                }

                return current + 1;
            });
        }, 1100);

        return () => window.clearInterval(interval);
    }, [loadingMode]);

    const handleFile = useCallback(async (file: File) => {
        if (!file.name.toLowerCase().endsWith('.zip')) {
            setError('Please upload a .zip file.');
            return;
        }

        setError(null);
        setLoadingMode('zip');

        try {
            const graph = await uploadZip(file);
            onGraph(graph);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Upload failed');
        } finally {
            setLoadingMode(null);
        }
    }, [onGraph]);

    const handleGithubAnalyze = useCallback(async () => {
        setError(null);
        setLoadingStepIndex(0);
        setLoadingMode('github');

        try {
            const graph = await cloneGithubRepo(githubUrl.trim());
            onGraph(graph);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Repository analysis failed');
        } finally {
            setLoadingMode(null);
        }
    }, [githubUrl, onGraph]);

    const handleZipSelection = useCallback((event: ChangeEvent<HTMLInputElement>) => {
        const input = event.currentTarget;
        const file = input.files?.[0];

        // Reset immediately so the same ZIP can be picked again after an error.
        input.value = '';

        if (file) {
            void handleFile(file);
        }
    }, [handleFile]);

    const handleZipPathAnalyze = useCallback(async () => {
        setError(null);
        setLoadingMode('zip');

        try {
            const graph = await uploadZipFromPath(zipPath.trim());
            onGraph(graph);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Upload failed');
        } finally {
            setLoadingMode(null);
        }
    }, [onGraph, zipPath]);

    const currentGithubStep = GITHUB_LOADING_STEPS[loadingStepIndex];

    return (
        <div className="upload-overlay">
            <input
                ref={inputRef}
                type="file"
                style={{ display: 'none' }}
                onChange={handleZipSelection}
            />

            <div className={`upload-box ${dragging ? 'drag' : ''} ${mode === 'github' ? 'is-form' : ''}`}>
                <div className="upload-tabs" role="tablist" aria-label="Repository input mode">
                    <button
                        type="button"
                        className={`upload-tab ${mode === 'zip' ? 'active' : ''}`}
                        onClick={() => {
                            setMode('zip');
                            setError(null);
                        }}
                        disabled={isLoading}
                    >
                        Upload ZIP
                    </button>
                    <button
                        type="button"
                        className={`upload-tab ${mode === 'github' ? 'active' : ''}`}
                        onClick={() => {
                            setMode('github');
                            setError(null);
                        }}
                        disabled={isLoading}
                    >
                        GitHub URL
                    </button>
                </div>

                {mode === 'zip' ? (
                    <div
                        className="upload-pane"
                        onClick={() => !isLoading && inputRef.current?.click()}
                        onDragOver={(e) => {
                            e.preventDefault();
                            setDragging(true);
                        }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={(e) => {
                            e.preventDefault();
                            setDragging(false);
                            const file = e.dataTransfer.files[0];
                            if (file) {
                                void handleFile(file);
                            }
                        }}
                    >
                        <div className="upload-icon">
                            {loadingMode === 'zip' ? (
                                <div style={{ display: 'flex', justifyContent: 'center' }}>
                                    <div className="spinner" />
                                </div>
                            ) : '^'}
                        </div>

                        <div className="upload-title">
                            {loadingMode === 'zip' ? 'Parsing repository...' : 'Upload Repository'}
                        </div>
                        <div className="upload-sub">
                            {loadingMode === 'zip'
                                ? 'Building knowledge graph from AST'
                                : 'Drag and drop a .zip file or click to browse'}
                        </div>
                        {!isLoading && (
                            <div className="upload-sub" style={{ marginTop: 10 }}>
                                If the Windows picker hangs in Downloads, drag the ZIP here instead.
                            </div>
                        )}
                        <input
                            type="text"
                            className="upload-github-input"
                            value={zipPath}
                            onChange={(event) => setZipPath(event.target.value)}
                            placeholder="Or paste a local ZIP path, for example C:\\Users\\abhay\\Downloads\\repo.zip"
                            disabled={isLoading}
                            onClick={(event) => event.stopPropagation()}
                        />
                        <button
                            type="button"
                            className="upload-analyze-btn"
                            onClick={(event) => {
                                event.stopPropagation();
                                void handleZipPathAnalyze();
                            }}
                            disabled={!canAnalyzeZipPath}
                        >
                            {loadingMode === 'zip' ? 'PARSING ZIP...' : 'ANALYZE LOCAL ZIP PATH'}
                        </button>
                        <div className="upload-hint">Supports JS | TS | JSX | TSX | PY | JSON | YAML | MD</div>
                    </div>
                ) : (
                    <div className="upload-pane upload-pane-form">
                        <div className="upload-icon">
                            {loadingMode === 'github' ? (
                                <div style={{ display: 'flex', justifyContent: 'center' }}>
                                    <div className="spinner" />
                                </div>
                            ) : '->'}
                        </div>

                        <div className="upload-title">
                            {loadingMode === 'github' ? currentGithubStep : 'Analyze GitHub Repository'}
                        </div>
                        <div className="upload-sub">
                            {loadingMode === 'github'
                                ? 'Fetching the latest commit snapshot directly from GitHub'
                                : 'Paste a public GitHub repository URL to analyze it instantly'}
                        </div>

                        <input
                            type="url"
                            className="upload-github-input"
                            value={githubUrl}
                            onChange={(event) => setGithubUrl(event.target.value)}
                            placeholder="https://github.com/username/repository"
                            disabled={isLoading}
                        />

                        <button
                            type="button"
                            className="upload-analyze-btn"
                            onClick={handleGithubAnalyze}
                            disabled={!canAnalyzeGithub}
                        >
                            {loadingMode === 'github' ? (
                                <>
                                    <span className="spinner" />
                                    {currentGithubStep}
                                </>
                            ) : (
                                'ANALYZE REPOSITORY ->'
                            )}
                        </button>

                        <div className="upload-examples">
                            <span className="upload-examples-label">Try these:</span>
                            <div className="upload-example-list">
                                {EXAMPLE_REPOS.map((example) => (
                                    <button
                                        key={example}
                                        type="button"
                                        className="upload-example-chip"
                                        onClick={() => setGithubUrl(buildGithubUrl(example))}
                                        disabled={isLoading}
                                    >
                                        {example}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {error && <div className="upload-error">{error}</div>}
            </div>
        </div>
    );
}
