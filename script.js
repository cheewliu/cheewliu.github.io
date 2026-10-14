/* =========================================================
   CONFIG
   ========================================================= */
const GITHUB_USERNAME = 'cheewliu';

// Featured repos — leave empty [] to show all (filtered).
// Add repo names here to pin specific ones in this exact order.
const GITHUB_PINNED = [];

// Max repos to display after filtering
const GITHUB_MAX_REPOS = 6;

// Cloudflare Worker proxy — API key lives in Cloudflare secrets, never here
const CLAUDE_PROXY = 'https://jacky-portfolio-proxy.cheewei-1988.workers.dev';
const CLAUDE_MODEL = 'claude-opus-5-5';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* =========================================================
   STORAGE — sessionStorage/localStorage can throw (private mode)
   ========================================================= */
const store = {
  get(area, key) { try { return window[area].getItem(key); } catch (_) { return null; } },
  set(area, key, val) { try { window[area].setItem(key, val); } catch (_) {} },
  del(area, key) { try { window[area].removeItem(key); } catch (_) {} },
};

/* =========================================================
   NAV — scrolled state, active section, mobile menu
   ========================================================= */
const nav     = $('#nav');
const menuBtn = $('#menu-btn');
const navList = $('#nav-links');

function setMenu(open) {
  navList.classList.toggle('open', open);
  nav.classList.toggle('menu-open', open);
  menuBtn.setAttribute('aria-expanded', String(open));
  menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
}

menuBtn.addEventListener('click', () => setMenu(!navList.classList.contains('open')));
$$('a', navList).forEach(a => a.addEventListener('click', () => setMenu(false)));
document.addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });
document.addEventListener('click', e => {
  if (navList.classList.contains('open') && !nav.contains(e.target)) setMenu(false);
});

const toTop = $('#to-top');
function onScroll() {
  const y = window.scrollY;
  nav.classList.toggle('scrolled', y > 8);
  toTop.classList.toggle('visible', y > 900);
}
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();
toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }));

// Highlight the nav link for the section in the middle of the viewport
const navLinkById = Object.fromEntries(
  $$('a', navList).map(a => [a.getAttribute('href').slice(1), a])
);
const sectionObserver = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (!e.isIntersecting) return;
    $$('a', navList).forEach(a => a.classList.remove('active'));
    const link = navLinkById[e.target.id];
    if (link) link.classList.add('active');
  });
}, { rootMargin: '-45% 0px -50% 0px' });
$$('main section[id]').forEach(s => sectionObserver.observe(s));

/* =========================================================
   THEME — initial value set inline in <head>
   ========================================================= */
$('#theme-toggle').addEventListener('click', () => {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  store.set('localStorage', 'theme', next);
});

/* =========================================================
   REVEAL ON SCROLL
   ========================================================= */
const revealObserver = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in');
    revealObserver.unobserve(e.target);
  });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

function observeReveal(els) {
  els.forEach((el, i) => {
    if (reduceMotion) { el.classList.add('in'); return; }
    // Stagger siblings that enter together
    el.style.transitionDelay = `${Math.min(i % 4, 3) * 70}ms`;
    revealObserver.observe(el);
  });
}
observeReveal($$('.reveal'));

/* =========================================================
   TOAST
   ========================================================= */
let toastTimer;
function showToast(msg, ms = 2000) {
  const toast = $('#toast');
  toast.textContent = msg;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), ms);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (_) {
    // Fallback for browsers that block the async clipboard API
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (_) {}
    ta.remove();
    return ok;
  }
}

$('#copy-email').addEventListener('click', async () => {
  const ok = await copyText('cheewei.1988@gmail.com');
  showToast(ok ? 'Email copied' : 'Copy failed — select the address instead');
});

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* =========================================================
   GITHUB PROJECTS
   ========================================================= */
const GITHUB_CACHE_KEY = 'gh_repos_v2';
const GITHUB_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

async function fetchGitHubProjects() {
  const grid    = $('#projects-grid');
  const errorEl = $('#projects-error');

  const cached = JSON.parse(store.get('sessionStorage', GITHUB_CACHE_KEY) || 'null');
  if (cached && Date.now() - cached.ts < GITHUB_CACHE_TTL) {
    renderRepos(cached.repos, grid);
    return;
  }

  try {
    let repos = null;

    // 1st attempt: Worker proxy (authenticated — 5000 req/hr)
    try {
      const res = await fetch(`${CLAUDE_PROXY}/github?user=${GITHUB_USERNAME}&per_page=12`);
      if (res.ok) repos = await res.json();
    } catch (_) {}

    // 2nd attempt: direct GitHub API (unauthenticated — 60 req/hr per IP)
    if (!Array.isArray(repos)) {
      const res = await fetch(`https://api.github.com/users/${GITHUB_USERNAME}/repos?sort=updated&per_page=12&type=public`);
      if (!res.ok) throw new Error(`GitHub API ${res.status}`);
      repos = await res.json();
    }

    store.set('sessionStorage', GITHUB_CACHE_KEY, JSON.stringify({ ts: Date.now(), repos }));
    renderRepos(repos, grid);
  } catch (err) {
    console.error('GitHub fetch error:', err);
    grid.innerHTML = '';
    grid.setAttribute('aria-busy', 'false');
    errorEl.classList.remove('hidden');
  }
}

$('#projects-retry').addEventListener('click', () => {
  $('#projects-error').classList.add('hidden');
  const grid = $('#projects-grid');
  grid.setAttribute('aria-busy', 'true');
  grid.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';
  store.del('sessionStorage', GITHUB_CACHE_KEY);
  fetchGitHubProjects();
});

function timeAgo(iso) {
  const days = Math.floor((Date.now() - new Date(iso)) / 86400000);
  if (days < 1) return 'today';
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function renderRepos(repos, grid) {
  grid.innerHTML = '';
  grid.setAttribute('aria-busy', 'false');

  // Pinned takes priority; otherwise drop forks/archived,
  // sort by stars then most recent push, cap at GITHUB_MAX_REPOS.
  let curated;
  if (GITHUB_PINNED.length) {
    const byName = Object.fromEntries(repos.map(r => [r.name, r]));
    curated = GITHUB_PINNED.map(n => byName[n]).filter(Boolean);
  } else {
    curated = repos
      .filter(r => !r.fork && !r.archived)
      .sort((a, b) => (b.stargazers_count - a.stargazers_count)
        || (new Date(b.pushed_at) - new Date(a.pushed_at)))
      .slice(0, GITHUB_MAX_REPOS);
  }

  if (!curated.length) {
    grid.innerHTML = '<p class="notice">No public repositories yet.</p>';
    return;
  }

  const cards = curated.map(repo => {
    const card = document.createElement('a');
    card.className = 'project reveal';
    card.href      = repo.html_url;
    card.target    = '_blank';
    card.rel       = 'noopener';
    card.innerHTML = `
      <div class="project-top">
        <span class="project-name">${escHtml(repo.name)}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17L17 7M8 7h9v9"/></svg>
      </div>
      <p class="project-desc">${escHtml(repo.description || 'No description yet.')}</p>
      <div class="project-meta">
        ${repo.language ? `<span class="lang">${escHtml(repo.language)}</span>` : ''}
        ${repo.stargazers_count ? `<span>★ ${repo.stargazers_count}</span>` : ''}
        <span>Updated ${timeAgo(repo.pushed_at)}</span>
      </div>`;
    grid.appendChild(card);
    return card;
  });
  observeReveal(cards);
}

/* =========================================================
   CLAUDE — shared call through the Worker proxy
   ========================================================= */
async function callClaude(body) {
  const res = await fetch(CLAUDE_PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: CLAUDE_MODEL, ...body }),
  });
  if (res.status === 429) throw Object.assign(new Error('rate'), { kind: 'rate' });
  if (!res.ok) throw new Error(`Claude API ${res.status}`);

  const data = await res.json();
  if (data.stop_reason === 'refusal') throw new Error('Claude declined the request');

  // Opus 5.5 always thinks, so the response can start with thinking blocks —
  // read only the text blocks.
  const text = (data.content || [])
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('')
    .trim();
  if (!text) throw new Error('Empty response');
  return text;
}

/* =========================================================
   TYPEWRITER — types text into el, returns Promise
   ========================================================= */
function typewriter(el, text, speed = 16) {
  if (reduceMotion) { el.textContent = text; return Promise.resolve(); }
  return new Promise(resolve => {
    el.textContent = '';
    const cursor = document.createElement('span');
    cursor.className = 'type-cursor';
    el.appendChild(cursor);
    let i = 0;
    const tick = setInterval(() => {
      if (i < text.length) {
        cursor.insertAdjacentText('beforebegin', text[i++]);
      } else {
        clearInterval(tick);
        cursor.classList.add('done');
        resolve();
      }
    }, speed);
  });
}

/* =========================================================
   AI SUMMARY — generated once per session when About scrolls in
   ========================================================= */
const BIO_CACHE_KEY = 'ai_summary_v3';

async function loadAISummary() {
  const bodyEl = $('#ai-bio-body');

  const cached = store.get('sessionStorage', BIO_CACHE_KEY);
  if (cached) { bodyEl.textContent = cached; return; }

  const prompt = `Write a 2-sentence professional summary for a portfolio website.
Person: Liu Chee Wei (Jacky), R&D Software Manager at Keysight Technologies, Penang, Malaysia (promoted Sep 2026 from R&D Software Lead Engineer).
Facts: leads the 14-engineer team that designs and builds PathWave Test Executive for Manufacturing (PTEM), Keysight's manufacturing test executive used globally; the team extends OpenTAP with platform features, instrument plugins, and test solutions for automotive and manufacturing applications; previously PTEM's lead engineer and architect (2019-2026) and Scrum Master; co-inventor of 2 US patents in automated LiDAR target simulation; 15 years across Keysight, WAFTECH (semiconductor equipment, C#/WPF, SECS/GEM) and co-founding a 3D printing startup; C#, C++, Python.
Rules: third person, lead with PTEM and the team, specific, under 55 words, plain text only, no filler or superlatives.`;

  try {
    const summary = await callClaude({
      max_tokens: 2000,
      output_config: { effort: 'low' },
      messages: [{ role: 'user', content: prompt }],
    });
    store.set('sessionStorage', BIO_CACHE_KEY, summary);
    await typewriter(bodyEl, summary);
  } catch (err) {
    // Fallback to the static bio, and don't claim AI wrote it
    bodyEl.textContent = bodyEl.getAttribute('data-fallback');
    $('#ai-bio-badge').textContent = 'Summary';
  }
}

// Only call the API when the reader actually reaches the About section
const bioObserver = new IntersectionObserver(entries => {
  if (!entries[0].isIntersecting) return;
  bioObserver.disconnect();
  loadAISummary();
}, { rootMargin: '200px 0px' });
bioObserver.observe($('#ai-bio'));

/* =========================================================
   AI MATCH — score + strengths/gaps + cover letter
   ========================================================= */
const RESUME_TEXT = `Liu Chee Wei (Jacky) | R&D Software Manager | Penang, Malaysia
linkedin.com/in/jacky-liu-chee-wei | github.com/cheewliu | cheewei.1988@gmail.com

SUMMARY
R&D Software Manager at Keysight Technologies, leading a 14-engineer team that designs and builds PathWave Test Executive for Manufacturing (PTEM), a manufacturing test executive used globally. The team extends OpenTAP with platform features, instrument plugins, and test solutions for automotive and manufacturing applications. Previously PTEM's lead engineer and architect (2019–2026). 15 years in test and automation software; co-inventor of two US patents in automated LiDAR target simulation. Hands-on in C#, C++ and Python; applies AI where it gives real engineering leverage.

SKILLS
Leadership: Engineering management, hiring and coaching, roadmapping, Scrum Master, Agile delivery, release process
Languages: C#, WPF, C++, Python, JavaScript, PowerShell
Platforms & Tools: PTEM, OpenTAP, .NET, Git, Cloudflare Workers, Claude API
Domain: Manufacturing test, automotive test, instrument automation and plugins, LiDAR/ADAS, SECS/GEM

EXPERIENCE
R&D Software Manager | Keysight Technologies Malaysia | Sep 2026 – Present
- Lead a 14-engineer R&D team designing and building PTEM (PathWave Test Executive for Manufacturing), used by customers globally
- Drive the PTEM roadmap on OpenTAP: user-facing platform features, instrument plugins, and test solutions for automotive and manufacturing applications
- Hire, coach and develop engineers; own delivery planning and stakeholder alignment across global programs

R&D Software Lead Engineer | Keysight Technologies Malaysia | Oct 2019 – Aug 2026
- Led a team of 10 on PTEM architecture and development on OpenTAP, from platform features to instrument plugins
- Scrum Master; established the SQ release process across global programs
- Sole software developer on the LiDAR Target Simulator project; co-invented 2 US patents in automated LiDAR target simulation scanning

Motion Control & Software Dev Senior Engineer | WAFTECH | Apr 2016 – Sep 2019
- Built next-generation machine control software in C# and WPF
- Implemented SECS/GEM integration for semiconductor equipment communication
- Led on-site deployments and mentored junior engineers

Co-Founder | Makerzone Sdn Bhd | Apr 2011 – Mar 2016
- Co-founded and ran a 3D printing service business; built the company website; delivered customer projects end to end

Machine Automation Software Engineer | WAFTECH | Oct 2014 – Apr 2015
- Developed motion control and wafer handling software in C# and WPF

R&D System Engineer | Keysight Technologies Malaysia | Jun 2011 – Oct 2014
- Developed automotive test systems in C++; supported the TS-5000 hardware handler library

EDUCATION
Bachelor of Engineering (Hons), Electrical & Electronic Engineering — Universiti Tunku Abdul Rahman (UTAR), 2007 – 2011

CERTIFICATIONS
Agile SCRUM for Practitioners — DreamCatcher Consulting, Feb 2026
Practical AI with Machine and Deep Learning — DreamCatcher Consulting, Mar 2021

PATENTS
US20220260714A1 — Automated LiDAR Target Simulation Scanning Systems & Methods
US20230132855A1 — Automated LiDAR Target Simulation Scanning Systems and Methods`;

const SAMPLE_JDS = {
  manager: `Engineering Manager, Test Automation Platform

We're hiring an Engineering Manager to lead a team of 8–12 software engineers building our test automation platform for electric vehicle and ADAS validation.

Responsibilities
- Lead, hire and grow a team of software engineers; run 1:1s, performance reviews and career development
- Own the roadmap and delivery for the test platform, working with product, hardware and customer teams worldwide
- Keep the architecture healthy as the platform scales; make build-vs-buy calls
- Drive Agile delivery and a reliable release process

Requirements
- 10+ years in software engineering, 2+ years leading engineers
- Strong background in C# / .NET or C++; Python a plus
- Experience with automotive test systems, HIL, or instrument automation
- Excellent communication with global stakeholders`,
  architect: `Senior Test Automation Architect — ADAS Sensors

Design the software architecture for our next-generation ADAS sensor test systems (LiDAR, radar, camera).

You will
- Define the architecture for a modular, plugin-based test sequencing framework
- Build instrument drivers and integrate HIL setups
- Set coding standards and review designs across three teams
- Prototype ML-assisted test analysis

You have
- 8+ years building test automation or instrument control software
- Expert C#; C++ and Python
- Experience with OpenTAP, TestStand or similar sequencers
- Knowledge of LiDAR or radar test methods; patents a plus
- Automotive SPICE / ISO 26262 exposure`,
};

const MATCH_SCHEMA = {
  type: 'object',
  properties: {
    score:       { type: 'integer' },
    verdict:     { type: 'string' },
    strengths:   { type: 'array', items: { type: 'string' } },
    gaps:        { type: 'array', items: { type: 'string' } },
    coverLetter: { type: 'string' },
  },
  required: ['score', 'verdict', 'strengths', 'gaps', 'coverLetter'],
  additionalProperties: false,
};

const MAX_ANALYSES = 3;
const RATE_KEY     = 'recruiter_uses';
const JD_MAX       = 3000;

const jdInput    = $('#jd-input');
const analyzeBtn = $('#analyze-btn');

function usesSoFar() { return parseInt(store.get('sessionStorage', RATE_KEY) || '0', 10); }

function updateRateDisplay() {
  const remaining = Math.max(0, MAX_ANALYSES - usesSoFar());
  const el = $('#jd-rate');
  el.textContent = remaining ? `${remaining} of ${MAX_ANALYSES} left` : 'No analyses left this visit';
  el.classList.toggle('depleted', remaining === 0);
  analyzeBtn.disabled = remaining === 0;
}

function updateCounter() {
  const len = jdInput.value.length;
  const counter = $('#jd-counter');
  counter.textContent = `${len} / ${JD_MAX}`;
  counter.classList.toggle('warn', len > JD_MAX - 500);
}

jdInput.addEventListener('input', updateCounter);
jdInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    $('#match-form').requestSubmit();
  }
});

$$('.sample-btn').forEach(btn => btn.addEventListener('click', () => {
  jdInput.value = SAMPLE_JDS[btn.dataset.sample];
  updateCounter();
  jdInput.focus();
  jdInput.setSelectionRange(0, 0);
  jdInput.scrollTop = 0;
}));

function showResultState(state) {
  $('#result-empty').classList.toggle('hidden', state !== 'empty');
  $('#result-loading').classList.toggle('hidden', state !== 'loading');
  $('#result-body').classList.toggle('hidden', state !== 'done');
  $('#match-error').classList.toggle('hidden', state !== 'error');
}

let loadingTimer;
function cycleLoadingText() {
  const steps = [
    'Reading the job description…',
    'Comparing against 15 years of experience…',
    'Weighing strengths and gaps…',
    'Drafting the cover letter…',
  ];
  let i = 0;
  $('#loading-text').textContent = steps[0];
  clearInterval(loadingTimer);
  loadingTimer = setInterval(() => {
    i = Math.min(i + 1, steps.length - 1);
    $('#loading-text').textContent = steps[i];
  }, 5000);
}

$('#match-form').addEventListener('submit', async e => {
  e.preventDefault();
  const jd = jdInput.value.trim();
  if (jd.length < 80) {
    showResultState('error');
    $('#match-error').textContent = 'Paste a fuller job description (at least a few lines) for a useful result.';
    jdInput.focus();
    return;
  }
  if (usesSoFar() >= MAX_ANALYSES) { updateRateDisplay(); return; }

  showResultState('loading');
  cycleLoadingText();
  analyzeBtn.disabled = true;
  const label = $('span', analyzeBtn);
  label.textContent = 'Analyzing…';
  if (window.matchMedia('(max-width: 920px)').matches) {
    $('#result-panel').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }

  const prompt = `You are an experienced technical recruiter. Assess how well the candidate fits the job, then write a cover letter from the candidate.

<resume>
${RESUME_TEXT}
</resume>

<job_description>
${jd}
</job_description>

Fields:
- score: integer 0-100, honest and calibrated (70+ strong fit, 50-69 moderate, below 50 weak). Don't inflate.
- verdict: 3-6 word headline for the fit, e.g. "Strong fit for this role".
- strengths: 3 specific matches between the resume and the job, each one sentence citing concrete experience.
- gaps: 1-2 honest, constructive gaps. If there are no real gaps, name the closest thing to one.
- coverLetter: 3-4 short paragraphs separated by blank lines. Open with the role's most important need, not "I am writing to apply". Reference concrete tech and experience from both documents. Confident and specific, no clichés. Sign off as "Liu Chee Wei (Jacky)".
Use only facts from the resume; never invent experience.`;

  try {
    const text = await callClaude({
      max_tokens: 8000,
      output_config: {
        effort: 'low',
        format: { type: 'json_schema', schema: MATCH_SCHEMA },
      },
      messages: [{ role: 'user', content: prompt }],
    });
    const result = JSON.parse(text.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, ''));

    store.set('sessionStorage', RATE_KEY, String(usesSoFar() + 1));
    renderMatch(result);
    showResultState('done');
    selectTab('fit');
  } catch (err) {
    console.error('AI Match error:', err);
    showResultState('error');
    $('#match-error').textContent = err.kind === 'rate'
      ? 'Too many requests from your network right now. Please try again in a little while.'
      : 'Something went wrong while analyzing. Check your connection and try again.';
  } finally {
    clearInterval(loadingTimer);
    label.textContent = 'Analyze fit';
    updateRateDisplay();
  }
});

function renderMatch(r) {
  const CIRC  = 2 * Math.PI * 42;
  const score = Math.max(0, Math.min(100, Math.round(Number(r.score) || 0)));
  const fill  = $('#score-ring-fill');
  const num   = $('#score-number');
  const color = score >= 70 ? 'var(--good)' : score >= 50 ? 'var(--warn)' : 'var(--bad)';

  fill.style.stroke = color;
  fill.style.strokeDasharray = CIRC;
  fill.style.strokeDashoffset = CIRC;
  $('#verdict').textContent = r.verdict || (score >= 70 ? 'Strong fit' : score >= 50 ? 'Moderate fit' : 'Weak fit');

  const start = performance.now();
  const duration = reduceMotion ? 0 : 1100;
  (function tick(now) {
    const p = duration ? Math.min((now - start) / duration, 1) : 1;
    const eased = 1 - Math.pow(1 - p, 3);
    num.textContent = Math.round(eased * score);
    fill.style.strokeDashoffset = CIRC * (1 - (eased * score) / 100);
    if (p < 1) requestAnimationFrame(tick);
  })(start);

  const item = (cls, mark, t) =>
    `<div class="fit-item ${cls}"><span class="mark" aria-hidden="true">${mark}</span><span>${escHtml(t)}</span></div>`;
  $('#pane-fit').innerHTML =
    `<h4 class="good">Strengths</h4>` +
    (r.strengths || []).map(s => item('good', '✓', s)).join('') +
    `<h4 class="gap">Gaps</h4>` +
    (r.gaps || []).map(g => item('gap', '!', g)).join('');

  $('#cover-letter').innerHTML = String(r.coverLetter || '')
    .split(/\n\s*\n/)
    .filter(p => p.trim())
    .map(p => `<p>${escHtml(p.trim()).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

// Tabs (fit / letter) with arrow-key support
const tabs = { fit: $('#tab-fit'), letter: $('#tab-letter') };
function selectTab(name) {
  Object.entries(tabs).forEach(([key, tab]) => {
    const on = key === name;
    tab.setAttribute('aria-selected', String(on));
    tab.tabIndex = on ? 0 : -1;
    $(`#${tab.getAttribute('aria-controls')}`).hidden = !on;
  });
}
Object.entries(tabs).forEach(([key, tab]) => {
  tab.addEventListener('click', () => selectTab(key));
  tab.addEventListener('keydown', e => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const next = key === 'fit' ? 'letter' : 'fit';
    selectTab(next);
    tabs[next].focus();
  });
});

$('#copy-letter').addEventListener('click', async () => {
  const ok = await copyText($('#cover-letter').innerText.trim());
  showToast(ok ? 'Cover letter copied' : 'Copy failed — select the text instead');
});

$('#download-letter').addEventListener('click', () => {
  const blob = new Blob([$('#cover-letter').innerText.trim()], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: 'Jacky-Liu-cover-letter.txt' });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

/* =========================================================
   INIT
   ========================================================= */
updateCounter();
updateRateDisplay();
showResultState('empty');
fetchGitHubProjects();
