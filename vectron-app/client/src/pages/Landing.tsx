import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

type Particle = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    color: string;
};

const statements = [
    'Upload any JS/TS repository as a ZIP',
    'Get a live interactive dependency graph instantly',
    'Click any node. See the blast radius before you touch anything.',
];

const features = [
    {
        mark: '◎',
        title: 'Blast Radius BFS',
        description: 'Trace dependency propagation outward from any node and quantify exactly how far a risky change can travel.',
    },
    {
        mark: '⬡',
        title: 'Dependency Graph',
        description: 'Render files, functions, classes, and methods as a live graph with structural edges you can inspect in motion.',
    },
    {
        mark: '⌘',
        title: 'AI Codebase Query',
        description: 'Ask plain-English questions and get graph-grounded call chains that stay anchored to real nodes in your codebase.',
    },
    {
        mark: '≋',
        title: 'Process Detection',
        description: 'Surface meaningful runtime flows from trigger to side effect, then inspect them as generated Mermaid diagrams.',
    },
    {
        mark: '◈',
        title: 'Risk Scoring',
        description: 'Highlight connected components so you can prioritize refactors around the modules most likely to create damage.',
    },
    {
        mark: '⎙',
        title: 'Intelligence Report',
        description: 'Generate an architecture brief with hotspots, onboarding paths, and actionable codebase intelligence in one pass.',
    },
];

const tools = [
    'vectron_status',
    'vectron_blast_radius',
    'vectron_get_callers',
    'vectron_get_dependencies',
    'vectron_query',
];

const tech = [
    'React',
    'TypeScript',
    'Sigma.js',
    'Graphology',
    'ForceAtlas2',
    'Express',
    'Babel',
    'Groq',
    'Cerebras',
    'Mermaid.js',
    'MCP',
    'Railway',
];

function ParticleCanvas() {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        const cvs = canvas;
        const ctx = context;
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const particles: Particle[] = [];
        const colors = ['#00d9ff', '#7b61ff'];
        let width = 0;
        let height = 0;
        let frame = 0;

        function resizeCanvas() {
            width = cvs.offsetWidth;
            height = cvs.offsetHeight;
            const ratio = window.devicePixelRatio || 1;
            cvs.width = width * ratio;
            cvs.height = height * ratio;
            ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        }

        function createParticle(): Particle {
            const drift = Math.random() * 0.32 + 0.08;
            return {
                x: Math.random() * width,
                y: Math.random() * height,
                vx: (Math.random() - 0.5) * drift,
                vy: (Math.random() - 0.5) * drift,
                size: Math.random() * 1.7 + 1.4,
                color: colors[Math.floor(Math.random() * colors.length)],
            };
        }

        function populateParticles() {
            particles.length = 0;
            const count = width < 720 ? 26 : 42;
            for (let i = 0; i < count; i += 1) {
                particles.push(createParticle());
            }
        }

        function drawConnections() {
            for (let i = 0; i < particles.length; i += 1) {
                for (let j = i + 1; j < particles.length; j += 1) {
                    const a = particles[i];
                    const b = particles[j];
                    const dx = a.x - b.x;
                    const dy = a.y - b.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    if (distance < 156 && (i + j) % 3 === 0) {
                        const opacity = 1 - distance / 156;
                        ctx.strokeStyle = `rgba(0, 217, 255, ${0.13 * opacity})`;
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(a.x, a.y);
                        ctx.lineTo(b.x, b.y);
                        ctx.stroke();
                    }
                }
            }
        }

        function updateParticles() {
            particles.forEach((particle) => {
                if (!reduceMotion) {
                    particle.x += particle.vx;
                    particle.y += particle.vy;
                }

                if (particle.x < -36) particle.x = width + 36;
                if (particle.x > width + 36) particle.x = -36;
                if (particle.y < -36) particle.y = height + 36;
                if (particle.y > height + 36) particle.y = -36;
            });
        }

        function drawParticles() {
            particles.forEach((particle) => {
                ctx.fillStyle = particle.color;
                ctx.shadowBlur = particle.color === '#00d9ff' ? 14 : 10;
                ctx.shadowColor = particle.color;
                ctx.beginPath();
                ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
                ctx.fill();
            });
            ctx.shadowBlur = 0;
        }

        function render() {
            ctx.clearRect(0, 0, width, height);
            updateParticles();
            drawConnections();
            drawParticles();
            if (!reduceMotion) {
                frame = window.requestAnimationFrame(render);
            }
        }

        function handleResize() {
            resizeCanvas();
            populateParticles();
            render();
        }

        handleResize();
        window.addEventListener('resize', handleResize);

        if (!reduceMotion) {
            frame = window.requestAnimationFrame(render);
        }

        return () => {
            window.removeEventListener('resize', handleResize);
            window.cancelAnimationFrame(frame);
        };
    }, []);

    return <canvas ref={canvasRef} className="hero-canvas" aria-hidden="true" />;
}

export default function Landing() {
    const navigate = useNavigate();
    const year = useMemo(() => String(new Date().getFullYear()), []);
    const goToApp = useCallback(() => navigate('/app'), [navigate]);

    useEffect(() => {
        const elements = document.querySelectorAll<HTMLElement>('.reveal-on-scroll');
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('is-visible');
                        observer.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.18, rootMargin: '0px 0px -8% 0px' },
        );

        elements.forEach((element) => observer.observe(element));
        return () => observer.disconnect();
    }, []);

    return (
        <div className="landing-root">
            <style>{landingCss}</style>

            <div className="page-shell">
                <nav className="nav">
                    <a
                        className="nav-brand"
                        href="#top"
                        onClick={(event) => {
                            event.preventDefault();
                            document.getElementById('top')?.scrollIntoView({ behavior: 'smooth' });
                        }}
                    >
                        VECTRON
                    </a>

                    <div className="nav-actions">
                        <a
                            className="nav-link"
                            href="https://github.com/LAZYGENIUS69/VECTRON"
                            target="_blank"
                            rel="noreferrer"
                        >
                            GitHub
                        </a>
                        <button type="button" className="nav-button" onClick={goToApp}>
                            Launch App
                        </button>
                    </div>
                </nav>

                <main id="top">
                    <section className="hero">
                        <ParticleCanvas />
                        <div className="hero-inner fade-in is-visible">
                            <div className="badge">Dependency Propagation Engine</div>
                            <h1 className="hero-title">VECTRON</h1>
                            <p className="hero-subtitle">
                                Parse any codebase. Map every dependency.
                                <br />
                                See the blast radius before you break anything.
                            </p>
                            <div className="hero-actions">
                                <button type="button" className="button-primary" onClick={goToApp}>
                                    Launch App
                                </button>
                                <a
                                    className="button-secondary"
                                    href="https://github.com/LAZYGENIUS69/VECTRON"
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    View on GitHub
                                </a>
                            </div>
                        </div>
                        <a className="scroll-indicator" href="#capability" aria-label="Scroll to capability section">
                            ↓
                        </a>
                    </section>

                    <section id="capability" className="capability">
                        <div className="section-inner narrow">
                            <div className="section-label reveal-on-scroll">Core Capability</div>
                            <div className="statement-list">
                                {statements.map((statement, index) => (
                                    <div className="statement reveal-on-scroll" key={statement}>
                                        <div className="statement-number">{String(index + 1).padStart(2, '0')}</div>
                                        <div className="statement-text">{statement}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    <section id="features" className="features">
                        <div className="section-inner">
                            <div className="section-label reveal-on-scroll">Capabilities</div>
                            <div className="features-grid">
                                {features.map((feature) => (
                                    <article className="feature-card fade-in reveal-on-scroll" key={feature.title}>
                                        <div className="feature-icon">{feature.mark}</div>
                                        <h3 className="feature-title">{feature.title}</h3>
                                        <p className="feature-description">{feature.description}</p>
                                    </article>
                                ))}
                            </div>
                        </div>
                    </section>

                    <section id="mcp" className="mcp">
                        <div className="section-inner mcp-layout">
                            <div className="fade-in reveal-on-scroll">
                                <div className="mcp-badge">MCP Server</div>
                                <h2 className="mcp-title">Give your AI coding assistant a map.</h2>
                                <p className="mcp-copy">
                                    VECTRON runs as an MCP server on port 3002. Connect it to Claude Code, Cursor,
                                    or any MCP-compatible client. Your AI now has full dependency context while coding.
                                </p>
                                <div className="pill-row">
                                    {tools.map((tool) => (
                                        <span className="tool-pill" key={tool}>
                                            {tool}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div className="code-block fade-in reveal-on-scroll" aria-label="MCP configuration example">
                                <span className="code-comment">// Add to your MCP client</span>
                                <br />
                                <span className="code-punctuation">{'{'}</span>
                                <br />
                                &nbsp;&nbsp;<span className="code-key">"name"</span>
                                <span className="code-punctuation">:</span> <span className="code-value">"VECTRON"</span>
                                <span className="code-punctuation">,</span>
                                <br />
                                &nbsp;&nbsp;<span className="code-key">"url"</span>
                                <span className="code-punctuation">:</span>{' '}
                                <span className="code-value">"http://localhost:3002/sse"</span>
                                <span className="code-punctuation">,</span>
                                <br />
                                &nbsp;&nbsp;<span className="code-key">"type"</span>
                                <span className="code-punctuation">:</span> <span className="code-value">"sse"</span>
                                <br />
                                <span className="code-punctuation">{'}'}</span>
                            </div>
                        </div>
                    </section>

                    <section className="tech">
                        <div className="section-inner">
                            <div className="section-label reveal-on-scroll">Built With</div>
                            <div className="tech-row fade-in reveal-on-scroll">
                                {tech.map((item) => (
                                    <span className="tech-item" key={item}>
                                        {item}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </section>

                    <section className="cta">
                        <div className="section-inner fade-in reveal-on-scroll">
                            <h2 className="cta-title">Upload your codebase.</h2>
                            <p className="cta-copy">Supports JS · TS · JSX · TSX</p>
                            <div className="cta-actions">
                                <button type="button" className="cta-button" onClick={goToApp}>
                                    Launch VECTRON
                                </button>
                            </div>
                        </div>
                    </section>
                </main>

                <footer>
                    <div className="footer-inner">
                        <div className="footer-brand">VECTRON</div>
                        <span>© {year}</span>
                        <a
                            className="footer-link"
                            href="https://github.com/LAZYGENIUS69/VECTRON"
                            target="_blank"
                            rel="noreferrer"
                        >
                            GitHub
                        </a>
                    </div>
                </footer>
            </div>
        </div>
    );
}

const landingCss = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@300;400;500&display=swap');

:root {
  --bg: #000000;
  --bg-secondary: #080810;
  --bg-card: #0a0a14;
  --accent: #00d9ff;
  --accent-dim: rgba(0, 217, 255, 0.1);
  --border: rgba(255, 255, 255, 0.07);
  --text-primary: #ffffff;
  --text-secondary: #888899;
  --font-mono: "JetBrains Mono", monospace;
  --font-sans: "Inter", sans-serif;
  --violet: #7b61ff;
  --shadow-glow: 0 0 80px rgba(0, 217, 255, 0.12);
  --grid-line: rgba(255, 255, 255, 0.035);
  --container: 1180px;
  --ease: cubic-bezier(0.16, 1, 0.3, 1);
}

.landing-root {
  height: 100vh;
  overflow-x: hidden;
  overflow-y: auto;
  background:
    radial-gradient(circle at top center, rgba(0, 217, 255, 0.07), transparent 30%),
    radial-gradient(circle at 78% 18%, rgba(123, 97, 255, 0.1), transparent 24%),
    linear-gradient(180deg, #020204 0%, #000000 34%, #05050b 100%);
  color: var(--text-primary);
  font-family: var(--font-sans);
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
}

.landing-root * {
  box-sizing: border-box;
}

.landing-root a {
  color: inherit;
  text-decoration: none;
}

.page-shell {
  position: relative;
  overflow: hidden;
}

.page-shell::before {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  background-image:
    linear-gradient(to right, transparent 0, transparent calc(100% - 1px), var(--grid-line) calc(100% - 1px)),
    linear-gradient(to bottom, transparent 0, transparent calc(100% - 1px), var(--grid-line) calc(100% - 1px));
  background-size: 120px 120px;
  opacity: 0.32;
  mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.72), transparent 88%);
  z-index: 0;
}

.page-shell::after {
  content: "";
  position: fixed;
  top: 6vh;
  right: -16vw;
  width: 46vw;
  height: 46vw;
  border-radius: 50%;
  pointer-events: none;
  background: rgba(123, 97, 255, 0.16);
  filter: blur(96px);
  z-index: 0;
}

.nav,
main,
footer {
  position: relative;
  z-index: 1;
}

.nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 58px;
  padding: 0 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(0, 0, 0, 0.78);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--border);
  z-index: 20;
}

.nav-brand,
.footer-brand {
  font-family: var(--font-mono);
  font-size: 13px;
  letter-spacing: 0.32em;
  color: var(--text-primary);
  text-transform: uppercase;
}

.nav-actions {
  display: flex;
  align-items: center;
  gap: 18px;
}

.nav-link,
.footer-link {
  color: var(--text-secondary);
  font-size: 13px;
  transition: color 0.2s var(--ease);
}

.nav-link:hover,
.footer-link:hover {
  color: var(--text-primary);
}

.nav-button,
.button-primary,
.button-secondary,
.cta-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  border: 1px solid transparent;
  cursor: pointer;
  transition:
    background 0.2s var(--ease),
    border-color 0.2s var(--ease),
    color 0.2s var(--ease),
    transform 0.2s var(--ease),
    box-shadow 0.2s var(--ease);
}

.nav-button {
  min-height: 36px;
  padding: 0 18px;
  border-color: rgba(0, 217, 255, 0.72);
  background: rgba(0, 217, 255, 0.08);
  color: var(--accent);
  font-family: var(--font-mono);
  font-size: 12px;
  letter-spacing: 0.04em;
}

.nav-button:hover {
  background: rgba(0, 217, 255, 0.16);
  box-shadow: 0 0 24px rgba(0, 217, 255, 0.12);
  transform: translateY(-1px);
}

main {
  position: relative;
}

section {
  position: relative;
  padding: 112px 48px;
}

.section-inner {
  width: min(100%, var(--container));
  margin: 0 auto;
}

.section-inner.narrow {
  max-width: 820px;
}

.hero {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding-top: 96px;
  padding-bottom: 72px;
  isolation: isolate;
}

.hero-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: -1;
  opacity: 0.86;
}

.hero-inner {
  width: min(100%, 980px);
  margin: 0 auto;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 26px;
}

.badge,
.section-label,
.mcp-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--accent);
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.badge {
  padding: 7px 16px;
  border-radius: 20px;
  border: 1px solid rgba(0, 217, 255, 0.22);
  background: var(--accent-dim);
}

.hero-title {
  margin: 0;
  font-size: clamp(72px, 12vw, 140px);
  font-weight: 300;
  letter-spacing: 0.05em;
  line-height: 0.92;
  color: var(--text-primary);
  text-shadow: 0 0 30px rgba(255, 255, 255, 0.06);
}

.hero-subtitle {
  max-width: 560px;
  margin: 0;
  color: var(--text-secondary);
  font-size: 18px;
  font-weight: 300;
  line-height: 1.8;
}

.hero-actions,
.cta-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  flex-wrap: wrap;
}

.button-primary,
.cta-button {
  min-height: 46px;
  padding: 0 30px;
  background: var(--accent);
  color: #000000;
  font-size: 14px;
  font-weight: 500;
  box-shadow: var(--shadow-glow);
}

.button-primary:hover,
.cta-button:hover {
  background: #00bbdd;
  transform: translateY(-1px);
}

.button-secondary {
  min-height: 46px;
  padding: 0 30px;
  background: transparent;
  border-color: var(--border);
  color: var(--text-secondary);
  font-size: 14px;
}

.button-secondary:hover {
  border-color: var(--accent);
  color: var(--text-primary);
  transform: translateY(-1px);
}

.scroll-indicator {
  position: absolute;
  left: 50%;
  bottom: 28px;
  transform: translateX(-50%);
  color: var(--text-secondary);
  font-size: 22px;
  animation: bounce 1.8s infinite;
}

@keyframes bounce {
  0%, 20%, 50%, 80%, 100% { transform: translateX(-50%) translateY(0); }
  40% { transform: translateX(-50%) translateY(-8px); }
  60% { transform: translateX(-50%) translateY(-4px); }
}

.section-label,
.mcp-badge {
  justify-content: flex-start;
  margin-bottom: 24px;
}

.statement-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.statement {
  display: grid;
  grid-template-columns: 52px 1fr;
  align-items: start;
  gap: 18px;
  padding: 12px 0 12px 24px;
  border-left: 2px solid var(--accent);
}

.statement-number {
  padding-top: 5px;
  color: rgba(0, 217, 255, 0.9);
  font-family: var(--font-mono);
  font-size: 14px;
  letter-spacing: 0.08em;
}

.statement-text {
  color: var(--text-primary);
  font-size: 24px;
  font-weight: 300;
  line-height: 1.45;
}

.fade-in,
.reveal-on-scroll {
  opacity: 0;
  transform: translateY(30px);
  transition: opacity 0.78s var(--ease), transform 0.78s var(--ease);
}

.fade-in.is-visible,
.reveal-on-scroll.is-visible,
.statement.is-visible {
  opacity: 1;
  transform: translateY(0);
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 20px;
}

.feature-card {
  position: relative;
  min-height: 216px;
  overflow: hidden;
  padding: 28px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.012), rgba(255, 255, 255, 0)),
    var(--bg-card);
  transition:
    border-color 0.2s var(--ease),
    background 0.2s var(--ease),
    transform 0.2s var(--ease),
    box-shadow 0.2s var(--ease);
}

.feature-card::before {
  content: "";
  position: absolute;
  right: -46px;
  bottom: -62px;
  width: 156px;
  height: 156px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(0, 217, 255, 0.12), transparent 66%);
  opacity: 0;
  transition: opacity 0.2s var(--ease);
}

.feature-card:hover {
  border-color: rgba(0, 217, 255, 0.28);
  background:
    linear-gradient(180deg, rgba(0, 217, 255, 0.026), rgba(255, 255, 255, 0)),
    rgba(0, 217, 255, 0.026);
  transform: translateY(-3px);
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.35);
}

.feature-card:hover::before {
  opacity: 1;
}

.feature-icon {
  margin-bottom: 18px;
  color: var(--accent);
  font-family: var(--font-mono);
  font-size: 28px;
  line-height: 1;
}

.feature-title {
  margin: 0 0 14px;
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.02em;
}

.feature-description {
  max-width: 32ch;
  margin: 0;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.6;
}

.mcp {
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  background:
    radial-gradient(circle at 10% 20%, rgba(0, 217, 255, 0.07), transparent 20%),
    linear-gradient(180deg, rgba(8, 8, 16, 0.98) 0%, rgba(4, 4, 9, 0.98) 100%);
}

.mcp-layout {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 48px;
  align-items: center;
}

.mcp-title {
  margin: 0 0 20px;
  font-size: 36px;
  font-weight: 300;
  line-height: 1.15;
  letter-spacing: -0.02em;
}

.mcp-copy {
  max-width: 520px;
  margin: 0 0 26px;
  color: var(--text-secondary);
  font-size: 16px;
  line-height: 1.8;
}

.pill-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.tool-pill {
  padding: 6px 12px;
  border: 1px solid #1e1e2e;
  border-radius: 4px;
  background: #0a0a14;
  color: var(--accent);
  font-family: var(--font-mono);
  font-size: 12px;
}

.code-block {
  position: relative;
  overflow: hidden;
  padding: 24px;
  border: 1px solid #1e1e2e;
  border-radius: 8px;
  background: #0a0a14;
  color: rgba(255, 255, 255, 0.78);
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.9;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.02),
    0 30px 80px rgba(0, 0, 0, 0.35);
}

.code-block::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(135deg, rgba(0, 217, 255, 0.04), transparent 42%);
}

.code-comment { color: #555566; }
.code-key { color: #00d9ff; }
.code-value { color: #98c379; }
.code-punctuation { color: #888888; }

.tech {
  padding-top: 72px;
  padding-bottom: 72px;
}

.tech-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0;
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
}

.tech-item {
  display: inline-flex;
  align-items: center;
  padding: 18px;
  color: var(--text-secondary);
  font-family: var(--font-mono);
  font-size: 13px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.tech-item + .tech-item {
  position: relative;
}

.tech-item + .tech-item::before {
  content: "";
  position: absolute;
  left: 0;
  top: 14px;
  bottom: 14px;
  width: 1px;
  background: var(--border);
}

.cta {
  padding-top: 120px;
  padding-bottom: 120px;
  text-align: center;
}

.cta-title {
  margin: 0 0 16px;
  font-size: clamp(36px, 6vw, 72px);
  font-weight: 300;
  line-height: 1.02;
  letter-spacing: -0.03em;
}

.cta-copy {
  margin: 0 0 28px;
  color: var(--text-secondary);
  font-family: var(--font-mono);
  font-size: 14px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.cta-button {
  min-height: 54px;
  padding: 0 46px;
  font-size: 16px;
}

footer {
  border-top: 1px solid var(--border);
  color: var(--text-secondary);
  padding: 24px 48px;
}

.footer-inner {
  width: min(100%, var(--container));
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

@media (max-width: 1100px) {
  .features-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .mcp-layout {
    grid-template-columns: 1fr;
    gap: 32px;
  }
}

@media (max-width: 800px) {
  .nav,
  section,
  footer {
    padding-left: 24px;
    padding-right: 24px;
  }

  .nav {
    height: auto;
    min-height: 58px;
    padding-top: 12px;
    padding-bottom: 12px;
    flex-wrap: wrap;
    gap: 12px;
  }

  .hero {
    min-height: auto;
    padding-top: 128px;
    padding-bottom: 96px;
  }

  .hero-inner {
    gap: 22px;
  }

  .hero-title {
    letter-spacing: 0.02em;
  }

  .statement {
    grid-template-columns: 1fr;
    gap: 10px;
    padding-left: 18px;
  }

  .statement-text {
    font-size: 20px;
  }

  .cta {
    padding-top: 96px;
    padding-bottom: 96px;
  }
}

@media (max-width: 560px) {
  .nav-brand,
  .footer-brand {
    letter-spacing: 0.22em;
  }

  .nav-actions {
    width: 100%;
    justify-content: space-between;
  }

  .hero-title {
    font-size: clamp(58px, 22vw, 88px);
  }

  .hero-subtitle {
    font-size: 16px;
  }

  .features-grid {
    grid-template-columns: 1fr;
  }

  .feature-card {
    min-height: auto;
  }

  .tech-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  .tech-item {
    padding: 16px 14px;
  }

  .tech-item::before,
  .tech-item + .tech-item::before {
    display: none;
  }

  .footer-inner {
    flex-direction: column;
    align-items: flex-start;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.001ms !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
}
`;
