import { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

// Landing page ported from: server/src/landing.html
// Goal: preserve design + animations + interactions, but keep routing inside the SPA.

export default function Landing() {
    const navigate = useNavigate();
    const stageRef = useRef<HTMLDivElement | null>(null);

    const year = useMemo(() => String(new Date().getFullYear()), []);

    useEffect(() => {
        // Premium 3D tilt interaction (no libs)
        const el = stageRef.current;
        if (!el) return;

        const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduce) return;

        let raf: number | null = null;
        let target = { rx: 0, ry: 0 };
        let cur = { rx: 0, ry: 0 };

        function schedule() {
            if (raf) return;
            raf = window.requestAnimationFrame(tick);
        }

        function tick() {
            if (!el) return;
            raf = null;
            cur.rx += (target.rx - cur.rx) * 0.12;
            cur.ry += (target.ry - cur.ry) * 0.12;
            el.style.transform = `perspective(1100px) rotateX(${cur.rx.toFixed(3)}deg) rotateY(${cur.ry.toFixed(3)}deg)`;
            if (Math.abs(target.rx - cur.rx) + Math.abs(target.ry - cur.ry) > 0.02) schedule();
        }

        function onMove(e: PointerEvent) {
            if (!el) return;
            const rect = el.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            const y = (e.clientY - rect.top) / rect.height;
            const dx = x - 0.5;
            const dy = y - 0.5;
            target.ry = dx * 10;
            target.rx = -dy * 8;
            schedule();
        }

        function onLeave() {
            target = { rx: 0, ry: 0 };
            schedule();
        }

        el.addEventListener('pointermove', onMove);
        el.addEventListener('pointerleave', onLeave);

        return () => {
            if (raf) window.cancelAnimationFrame(raf);
            el.removeEventListener('pointermove', onMove);
            el.removeEventListener('pointerleave', onLeave);
        };
    }, []);

    const goToApp = () => navigate('/app');

    return (
        <div className="landing-root">
            <style>{landingCss}</style>

            <header className="nav">
                <div className="container nav-inner">
                    <a
                        className="brand"
                        href="#top"
                        aria-label="VECTRON home"
                        onClick={(e) => {
                            // Prevent full page reload and keep anchor scroll.
                            // This preserves original behavior while staying SPA.
                            e.preventDefault();
                            document.getElementById('top')?.scrollIntoView({ behavior: 'smooth' });
                        }}
                    >
                        <span className="brand-mark" aria-hidden="true" />
                        VECTRON
                    </a>

                    <nav className="nav-links" aria-label="Primary">
                        <a href="#capabilities">Capabilities</a>
                        <a href="#workflow">Workflow</a>
                        <a href="#security">Security</a>
                    </nav>

                    <div className="nav-actions">
                        <a className="btn ghost" href="/docs" target="_blank" rel="noreferrer">
                            Docs
                        </a>
                        <button type="button" className="btn primary" onClick={goToApp}>
                            Launch App ΓåÆ
                        </button>
                    </div>
                </div>
            </header>

            <main id="top" className="hero">
                <div className="container hero-grid">
                    <div>
                        <div className="pill">
                            <span className="dot" aria-hidden="true" /> Open Source ΓÇó MIT-minded ΓÇó MCP-ready
                        </div>
                        <h1 className="h1">
                            An <span className="grad">ultra-premium</span> agentic view of your codebase.
                        </h1>
                        <p className="sub">
                            VECTRON turns repositories into a living system mapΓÇödependency graph, blast radius, semantic search, and MCP toolsΓÇöso teams ship faster without breaking things.
                        </p>

                        <div className="cta-row">
                            <button type="button" className="btn primary" onClick={goToApp}>
                                Launch VECTRON ΓåÆ
                            </button>
                            <a className="btn" href="#workflow">
                                See it in action
                            </a>
                        </div>

                        <div className="fineprint">
                            <span>
                                <i aria-hidden="true" /> Instant graph + AI context
                            </span>
                            <span>
                                <i aria-hidden="true" /> Local-first deploys
                            </span>
                            <span>
                                <i aria-hidden="true" /> Enterprise security posture
                            </span>
                        </div>
                    </div>

                    <div className="stage" id="stage" ref={stageRef} aria-label="Interactive 3D preview">
                        <div className="stage-inner">
                            <div className="hud">
                                <div className="hud-left">
                                    <div className="lights" aria-hidden="true">
                                        <b />
                                        <b />
                                        <b />
                                    </div>
                                    <div className="hud-title">VECTRON ΓÇó Codebase Intelligence</div>
                                </div>
                                <div className="hud-right">
                                    <div className="chip">Graph</div>
                                    <div className="chip">AI</div>
                                    <div className="chip">MCP</div>
                                </div>
                            </div>

                            <div className="bento">
                                <div className="card">
                                    <div className="spark" aria-hidden="true" />
                                    <h3>Blast radius</h3>
                                    <p>Quantify change impact across services, packages, and critical paths. See downstream risk instantly.</p>
                                </div>
                                <div className="card">
                                    <div
                                        className="spark"
                                        aria-hidden="true"
                                        style={{ animationDuration: '13s', opacity: 0.52 }}
                                    />
                                    <h3>Semantic map</h3>
                                    <p>Search intent, not filenames. Retrieve the right code + context, fast.</p>
                                </div>
                                <div className="card term">
                                    <h3 style={{ margin: '12px 14px 10px' }}>Preview</h3>
                                    <div className="code" role="region" aria-label="Example commands">
                                        $ <span className="k">vectron</span> <span className="t">index</span> ./repo
                                        {'\n'}Γå│ graph: <span className="m">2,318</span> modules ΓÇó <span className="m">8,441</span> edges
                                        {'\n'}Γå│ risk: <span className="m">3</span> critical paths touched
                                        {'\n\n'}$ <span className="k">vectron</span> <span className="t">ask</span> "what breaks if I change auth middleware?"
                                        {'\n'}Γå│ answer: 7 routes, 2 services, 1 async consumer
                                        {'\n'}Γå│ suggested tests: auth.spec.ts, api-contract.spec.ts
                                        {'\n\n'}$ <span className="k">vectron</span> <span className="t">mcp</span> connect
                                        {'\n'}Γå│ tools: repo_search, dependency_trace, diff_summarize
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <section id="capabilities">
                <div className="container">
                    <div className="section-title">
                        <div>
                            <div className="kicker">Capabilities</div>
                            <h2 className="h2">High signal, low noise. Designed for teams shipping daily.</h2>
                        </div>
                        <div
                            className="pill"
                            style={{
                                borderColor: 'rgba(241,231,198,.16)',
                                background: 'rgba(241,231,198,.06)',
                            }}
                        >
                            Premium glass + motion
                        </div>
                    </div>

                    <div className="grid3">
                        <div className="feature">
                            <b>Dependency graph</b>
                            <span>Trace imports, runtime edges, and service boundaries. Navigate by risk, not by folder.</span>
                        </div>
                        <div className="feature">
                            <b>Blast radius scoring</b>
                            <span>Rank the downstream impact of a change with a reproducible scoring model and explainable paths.</span>
                        </div>
                        <div className="feature">
                            <b>Agentic workflows</b>
                            <span>Use MCP to connect tooling: search, trace, summarize diffs, and generate test plans.</span>
                        </div>
                        <div className="feature">
                            <b>Design-grade UI</b>
                            <span>Glassmorphism, bento layouts, and subtle depthΓÇöresponsive, accessible, and fast.</span>
                        </div>
                        <div className="feature">
                            <b>Local-first</b>
                            <span>Run on your infra. Keep code in your perimeter. Keep telemetry optional.</span>
                        </div>
                        <div className="feature">
                            <b>Security posture</b>
                            <span>Least-privilege by default. Make compliance easy with predictable behavior.</span>
                        </div>
                    </div>

                    <div className="logos" aria-label="Social proof">
                        <div className="logo-pill">SOC 2-ready</div>
                        <div className="logo-pill">SSO/SAML</div>
                        <div className="logo-pill">On-prem</div>
                        <div className="logo-pill">Audit logs</div>
                        <div className="logo-pill">Role-based access</div>
                    </div>
                </div>
            </section>

            <section id="workflow">
                <div className="container">
                    <div className="section-title">
                        <div>
                            <div className="kicker">Workflow</div>
                            <h2 className="h2">From repo to system map in minutes.</h2>
                        </div>
                        <button type="button" className="btn" onClick={goToApp}>
                            Open the app
                        </button>
                    </div>

                    <div className="grid3">
                        <div className="feature">
                            <b>1. Index</b>
                            <span>Build a dependency + semantic index across modules and services.</span>
                        </div>
                        <div className="feature">
                            <b>2. Explore</b>
                            <span>Navigate bento cards and tracesΓÇöfollow edges to what matters.</span>
                        </div>
                        <div className="feature">
                            <b>3. Ship</b>
                            <span>Get safe change plans with tests, impacted owners, and rollback guidance.</span>
                        </div>
                    </div>

                    <div style={{ height: 18 }} />
                    <div className="cta-band">
                        <div>
                            <h3>Hermes-level polish + 3D glass interaction.</h3>
                            <p>Minimal copy, editorial type, premium glass, and responsive performanceΓÇöbuilt to feel like a top-tier AI company.</p>
                        </div>
                        <div className="cta-row" style={{ margin: 0 }}>
                            <button type="button" className="btn primary" onClick={goToApp}>
                                Launch App ΓåÆ
                            </button>
                            <a className="btn ghost" href="#capabilities">
                                Capabilities
                            </a>
                        </div>
                    </div>
                </div>
            </section>

            <section id="security">
                <div className="container">
                    <div className="section-title">
                        <div>
                            <div className="kicker">Security</div>
                            <h2 className="h2">Built to live inside serious organizations.</h2>
                        </div>
                        <span className="pill">No trackers by default</span>
                    </div>

                    <div className="grid3">
                        <div className="feature">
                            <b>Data perimeter</b>
                            <span>Your repositories stay in your network. Deploy on-prem or in your cloud account.</span>
                        </div>
                        <div className="feature">
                            <b>Policy controls</b>
                            <span>Role-based access, audit logs, and predictable auth pathways for compliance.</span>
                        </div>
                        <div className="feature">
                            <b>Operational clarity</b>
                            <span>Deterministic indexing + explainable traces. No black-box surprises.</span>
                        </div>
                    </div>
                </div>
            </section>

            <footer>
                <div className="container">
                    <div className="foot">
                        <div>VECTRON</div>
                        <div>
                            <a
                                href="#top"
                                style={{ color: 'rgba(255,255,255,.70)' }}
                                onClick={(e) => {
                                    e.preventDefault();
                                    document.getElementById('top')?.scrollIntoView({ behavior: 'smooth' });
                                }}
                            >
                                Home
                            </a>{' '}
                            ΓÇó{' '}
                            <a href="/docs" target="_blank" rel="noreferrer" style={{ color: 'rgba(255,255,255,.70)' }}>
                                Docs
                            </a>{' '}
                            ΓÇó{' '}
                            <button
                                type="button"
                                className="landing-linklike"
                                onClick={goToApp}
                                style={{ color: 'rgba(255,255,255,.70)' }}
                            >
                                App
                            </button>
                        </div>
                        <div>
                            ┬⌐ {year} ΓÇó Built for speed
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}

const landingCss = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,600;9..144,700&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@300;400;500;600&display=swap');

:root{
  --bg0:#05060a;
  --bg1:#070814;
  --ink:rgba(255,255,255,.92);
  --muted:rgba(255,255,255,.66);
  --dim:rgba(255,255,255,.50);
  --line:rgba(255,255,255,.10);
  --line2:rgba(255,255,255,.16);
  --cyan:#00d9ff;
  --violet:#7b61ff;
  --lime:#a2ff52;
  --gold:#f1e7c6;
  --serif:"Fraunces", ui-serif, Georgia, serif;
  --sans:Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
  --mono:"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  --radius:18px;
  --radius2:24px;
  --container:1160px;
  --shadow: 0 28px 120px rgba(0,0,0,.70);
  --glow: 0 0 0 1px rgba(0,217,255,.16), 0 0 90px rgba(123,97,255,.13);
  --glow2: 0 0 0 1px rgba(241,231,198,.14), 0 0 120px rgba(0,217,255,.10);
}

/* Reset + layout */
.landing-root{
  background:
    radial-gradient(900px 650px at 10% 10%, rgba(0,217,255,.14), transparent 55%),
    radial-gradient(900px 650px at 85% 20%, rgba(123,97,255,.16), transparent 56%),
    radial-gradient(850px 650px at 60% 90%, rgba(162,255,82,.09), transparent 56%),
    radial-gradient(1200px 800px at 55% 45%, rgba(241,231,198,.08), transparent 60%),
    linear-gradient(180deg, var(--bg0), var(--bg1) 56%, #04040a 100%);
  color: var(--ink);
  font-family: var(--sans);
  height: 100vh;
  overflow-x: hidden;
  overflow-y: auto;
  position: relative;
  -webkit-font-smoothing: antialiased;
  text-rendering: geometricPrecision;
}

.landing-root *{ box-sizing: border-box; }
.landing-root::before{
  content:"";
  position:fixed; inset:0;
  pointer-events:none;
  background-image:
    linear-gradient(to right, rgba(255,255,255,.05) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(255,255,255,.05) 1px, transparent 1px);
  background-size: 120px 120px;
  opacity:.14;
  mask-image: radial-gradient(circle at 35% 20%, rgba(0,0,0,.95), rgba(0,0,0,.35) 55%, transparent 78%);
  z-index:0;
}
.landing-root::after{
  content:"";
  position:fixed; inset:0;
  pointer-events:none;
  opacity:.075;
  mix-blend-mode: overlay;
  background-image:url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="3" stitchTiles="stitch"/></filter><rect width="240" height="240" filter="url(%23n)" opacity="0.35"/></svg>');
  z-index:0;
}
.landing-root > header,
.landing-root > main,
.landing-root > section,
.landing-root > footer{ position:relative; z-index:1; }

.container{ width:min(100%, var(--container)); margin:0 auto; padding:0 28px; }

/* Top nav */
.nav{
  position: sticky;
  top: 0;
  z-index: 50;
  height: 68px;
  display:flex;
  align-items:center;
  backdrop-filter: blur(22px);
  background: rgba(6,7,12,.55);
  border-bottom: 1px solid rgba(255,255,255,.08);
}

.nav-inner{ display:flex; align-items:center; justify-content:space-between; gap: 14px; width:100%; }

.brand{ display:inline-flex; align-items:center; gap:12px; text-decoration:none; color: rgba(255,255,255,.86); font-family:var(--mono); letter-spacing:.36em; font-size: 12px; text-transform: uppercase; white-space:nowrap; }
.brand-mark{
  width: 12px; height: 12px; border-radius: 4px;
  background: linear-gradient(135deg, var(--cyan), var(--violet));
  box-shadow: 0 0 30px rgba(0,217,255,.16);
}

.nav-links{ display:flex; align-items:center; gap: 18px; }
.nav-links a{ color: var(--dim); text-decoration:none; font-size: 13px; letter-spacing:.08em; text-transform:uppercase; }
.nav-links a:hover{ color: var(--ink); }

.nav-actions{ display:flex; align-items:center; gap: 10px; }

/* Buttons */
.btn{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(255,255,255,.03);
  color: var(--ink);
  text-decoration:none;
  font-size: 12px;
  letter-spacing:.08em;
  cursor:pointer;
  transition: transform 160ms ease, border-color 160ms ease, background 160ms ease;
}
.btn:hover{ transform: translateY(-1px); border-color: rgba(255,255,255,.18); background: rgba(255,255,255,.05); }
.btn.primary{
  border-color: rgba(241,231,198,.22);
  background:
    linear-gradient(135deg, rgba(241,231,198,.14), rgba(0,217,255,.13)),
    radial-gradient(120px 60px at 20% 20%, rgba(0,217,255,.18), transparent 55%),
    radial-gradient(160px 70px at 80% 40%, rgba(123,97,255,.16), transparent 55%);
  box-shadow: var(--glow2);
}
.btn.primary:hover{ filter: saturate(1.12); box-shadow: 0 0 0 1px rgba(241,231,198,.20), 0 0 160px rgba(123,97,255,.14); }
.btn.ghost{ border-color: rgba(255,255,255,.12); background: rgba(255,255,255,.02); }

/* Hero */
.hero{ padding-top: 112px; padding-bottom: 56px; position:relative; }
.hero-grid{ display:grid; grid-template-columns: 1.05fr .95fr; gap: 34px; align-items:center; min-height: calc(100vh - 150px); }

.pill{
  display:inline-flex;
  align-items:center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(255,255,255,.04);
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: .12em;
  color: rgba(255,255,255,.78);
}
.dot{ width: 7px; height: 7px; border-radius: 999px; background: var(--lime); box-shadow: 0 0 18px rgba(162,255,82,.20); }

.h1{ font-family: var(--serif); font-weight: 600; letter-spacing:-0.02em; font-size: clamp(40px, 4.3vw, 72px); margin: 16px 0 14px; line-height: 1.02; }
.grad{
  background: linear-gradient(135deg, rgba(241,231,198,.95), rgba(0,217,255,.86), rgba(123,97,255,.88));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 18px 90px rgba(0,0,0,.45));
}

.sub{ color: var(--muted); font-size: 16px; line-height: 1.7; max-width: 54ch; margin: 0 0 22px; }

.cta-row{ margin-top: 18px; display:flex; gap: 12px; flex-wrap: wrap; }

.fineprint{
  display:flex;
  gap: 14px;
  color: rgba(255,255,255,.50);
  font-size: 13px;
  margin-top: 14px;
  flex-wrap: wrap;
}

.fineprint span{ display:inline-flex; align-items:center; gap:10px; }
.fineprint i{ width:6px; height:6px; border-radius:99px; background: rgba(241,231,198,.65); box-shadow: 0 0 16px rgba(241,231,198,.14); display:inline-block; }

/* 3D stage */
.stage{
  position:relative;
  border-radius: var(--radius2);
  border: 1px solid rgba(255,255,255,.10);
  background: linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.02));
  backdrop-filter: blur(18px);
  box-shadow: var(--shadow);
  overflow:hidden;
  transform-style: preserve-3d;
  will-change: transform;
}

.stage::before{
  content:"";
  position:absolute; inset:-2px;
  background:
    radial-gradient(420px 240px at 20% 18%, rgba(0,217,255,.20), transparent 60%),
    radial-gradient(460px 260px at 80% 30%, rgba(123,97,255,.20), transparent 64%),
    radial-gradient(560px 360px at 55% 110%, rgba(241,231,198,.16), transparent 60%);
  opacity: .85;
  filter: blur(2px);
  z-index: 0;
}

.stage::after{
  content:"";
  position:absolute; inset:0;
  background:
    linear-gradient(135deg, rgba(255,255,255,.08), transparent 55%),
    radial-gradient(900px 400px at 50% 0%, rgba(255,255,255,.08), transparent 65%);
  opacity:.75;
  z-index: 0;
  pointer-events:none;
}

.stage-inner{ position:relative; z-index:1; padding: 18px; }

.hud{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:14px;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(0,0,0,.18);
}

.hud-left{ display:flex; align-items:center; gap:10px; }
.lights{ display:flex; gap:7px; }
.lights b{ width:10px; height:10px; border-radius:999px; display:block; }
.lights b:nth-child(1){ background:#ff5f57; box-shadow: 0 0 12px rgba(255,95,87,.18); }
.lights b:nth-child(2){ background:#febc2e; box-shadow: 0 0 12px rgba(254,188,46,.16); }
.lights b:nth-child(3){ background:#28c840; box-shadow: 0 0 12px rgba(40,200,64,.14); }

.hud-title{ font-family: var(--mono); font-size: 12px; letter-spacing:.16em; text-transform:uppercase; color: rgba(255,255,255,.72); }

.hud-right{ display:flex; gap:8px; }
.chip{
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: .12em;
  text-transform: uppercase;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.12);
  background: rgba(255,255,255,.04);
  color: rgba(255,255,255,.70);
}

/* Interactive 3D cards inside stage */
.bento{
  display:grid;
  grid-template-columns: 1.15fr .85fr;
  gap: 12px;
  margin-top: 12px;
}

.card{
  position:relative;
  border-radius: 18px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(0,0,0,.18);
  overflow:hidden;
  padding: 14px;
  min-height: 142px;
  transform: translateZ(22px);
  transition: transform 180ms ease, border-color 180ms ease, background 180ms ease;
}
.card:hover{ border-color: rgba(241,231,198,.22); transform: translateZ(26px) translateY(-1px); }

.card h3{ margin:0 0 8px; font-size: 14px; letter-spacing:.10em; text-transform: uppercase; color: rgba(255,255,255,.86); }
.card p{ margin:0; color: rgba(255,255,255,.62); font-size: 13px; line-height: 1.6; }

.spark{
  position:absolute; inset:-60px;
  background: conic-gradient(from 220deg, rgba(0,217,255,.0), rgba(0,217,255,.24), rgba(123,97,255,.20), rgba(241,231,198,.16), rgba(0,217,255,.0));
  filter: blur(18px);
  opacity:.65;
  animation: spin 10s linear infinite;
  mask-image: radial-gradient(circle at 50% 50%, rgba(0,0,0,.78), transparent 62%);
  pointer-events:none;
}
@keyframes spin{ to{ transform: rotate(360deg); } }

.term{
  grid-column: 1 / -1;
  padding: 0;
  min-height: auto;
}

.code{
  font-family: var(--mono);
  font-size: 12px;
  line-height: 1.55;
  color: rgba(255,255,255,.78);
  padding: 14px;
  border-top: 1px solid rgba(255,255,255,.08);
  white-space: pre;
  overflow:auto;
  max-height: 210px;
}
.code .k{ color: rgba(0,217,255,.90); }
.code .t{ color: rgba(241,231,198,.92); }
.code .m{ color: rgba(162,255,82,.85); }

/* Sections */
section{ padding: 44px 0; }

.section-title{
  display:flex;
  align-items:baseline;
  justify-content:space-between;
  gap: 16px;
  padding-bottom: 14px;
  border-bottom: 1px solid rgba(255,255,255,.08);
  margin-bottom: 22px;
  flex-wrap: wrap;
}

.kicker{
  font-family: var(--mono);
  letter-spacing: .34em;
  text-transform: uppercase;
  color: rgba(241,231,198,.82);
  font-size: 12px;
  margin-bottom: 10px;
}

.h2{ font-family: var(--serif); font-weight: 600; font-size: clamp(24px, 2.4vw, 36px); margin: 0; }

.grid3{ display:grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }

.feature{
  border-radius: 18px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(255,255,255,.03);
  backdrop-filter: blur(14px);
  padding: 18px;
  box-shadow: 0 0 0 1px rgba(255,255,255,.02) inset;
}

.feature b{ display:block; font-size: 13px; letter-spacing:.10em; text-transform: uppercase; color: rgba(255,255,255,.86); margin-bottom: 10px; }
.feature span{ display:block; color: rgba(255,255,255,.62); line-height: 1.65; font-size: 14px; }

.logos{
  display:flex; gap: 14px; flex-wrap:wrap;
  margin-top: 14px;
}
.logo-pill{
  padding: 8px 12px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(0,0,0,.18);
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing:.18em;
  text-transform: uppercase;
  color: rgba(255,255,255,.70);
}

.cta-band{
  border-radius: 24px;
  border:  1px solid rgba(255,255,255,.12);
  background: linear-gradient(135deg, rgba(241,231,198,.10), rgba(0,217,255,.09), rgba(123,97,255,.09));
  padding: 22px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap: 18px;
  backdrop-filter: blur(18px);
  box-shadow: var(--shadow);
  flex-wrap: wrap;
}

.cta-band h3{ margin:0; font-family: var(--serif); font-weight: 600; font-size: 22px; }
.cta-band p{ margin:6px 0 0; color: rgba(255,255,255,.64); max-width: 56ch; }

footer{
  padding: 32px 0 40px;
  color: rgba(255,255,255,.54);
  font-size: 13px;
}
.foot{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap: 16px;
  border-top: 1px solid rgba(255,255,255,.08);
  padding-top: 16px;
  flex-wrap: wrap;
}

/* Responsiveness */
@media (max-width: 980px){
  .hero-grid{ grid-template-columns: 1fr; min-height: auto; }
  .stage{ max-width: 740px; }
  .grid3{ grid-template-columns: 1fr; }
  .nav-links{ display:none; }
}

@media (prefers-reduced-motion: reduce){
  *{ scroll-behavior:auto !important; }
  .spark{ animation: none !important; }
  .btn, .card{ transition: none !important; }
}

.landing-linklike{ border: 0; background: transparent; padding: 0; font: inherit; cursor: pointer; }
`;
