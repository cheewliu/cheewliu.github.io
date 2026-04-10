/* =========================================================
   CONFIG — update these before going live
   ========================================================= */
const GITHUB_USERNAME = 'cheewliu';

// Cloudflare Worker proxy — API key lives in Cloudflare secrets, never here
const CLAUDE_PROXY = 'https://jacky-portfolio-proxy.cheewei-1988.workers.dev';
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

/* =========================================================
   NAVBAR — sticky scroll + active link + mobile toggle
   ========================================================= */
const navbar     = document.getElementById('navbar');
const navLinks   = document.querySelectorAll('.nav-links a');
const hamburger  = document.getElementById('hamburger');
const navList    = document.querySelector('.nav-links');

window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 20);
  highlightActiveSection();
  updateFab();
});

function updateFab() {
  const fab     = document.getElementById('fab-match');
  const section = document.getElementById('ai-match');
  if (!fab || !section) return;
  const rect = section.getBoundingClientRect();
  // Hide when ai-match is visible in the viewport
  const inView = rect.top < window.innerHeight && rect.bottom > 0;
  fab.classList.toggle('hidden', inView);
}

hamburger.addEventListener('click', () => {
  navList.classList.toggle('open');
});

// Close mobile menu on link click
navList.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => navList.classList.remove('open'));
});

function highlightActiveSection() {
  const sections = document.querySelectorAll('section[id]');
  let current = '';
  sections.forEach(sec => {
    if (window.scrollY >= sec.offsetTop - 100) current = sec.id;
  });
  navLinks.forEach(link => {
    link.classList.toggle('active', link.getAttribute('href') === `#${current}`);
  });
}

/* =========================================================
   SCROLL FADE-IN ANIMATION
   ========================================================= */
const fadeEls = document.querySelectorAll(
  '.timeline-item, .project-card, .skill-category, .contact-card, .about-text, .resume-cta, .recruiter-tool'
);
fadeEls.forEach(el => el.classList.add('fade-in'));

const observer = new IntersectionObserver(
  entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); }),
  { threshold: 0.1 }
);
fadeEls.forEach(el => observer.observe(el));

/* =========================================================
   GITHUB PROJECTS — dynamic repo fetch
   ========================================================= */
async function fetchGitHubProjects() {
  const grid    = document.getElementById('projects-grid');
  const loading = document.getElementById('projects-loading');
  const errorEl = document.getElementById('projects-error');

  // Update placeholder links
  document.querySelectorAll('a[href*="GITHUB_USERNAME"]').forEach(a => {
    a.href = a.href.replace('GITHUB_USERNAME', GITHUB_USERNAME);
  });
  document.querySelectorAll('.projects-meta .accent').forEach(el => {
    if (el.textContent === 'GITHUB_USERNAME') el.textContent = GITHUB_USERNAME;
  });

  if (GITHUB_USERNAME === 'GITHUB_USERNAME') {
    loading.innerHTML = `<span class="accent monospace">// Set GITHUB_USERNAME in script.js to load repos</span>`;
    return;
  }

  try {
    const res = await fetch(
      `https://api.github.com/users/${GITHUB_USERNAME}/repos?sort=updated&per_page=12&type=public`
    );
    if (!res.ok) throw new Error(`GitHub API ${res.status}`);
    const repos = await res.json();

    loading.remove();

    if (!repos.length) {
      grid.innerHTML = `<p class="projects-loading">No public repositories found.</p>`;
      return;
    }

    repos.forEach(repo => {
      const card = document.createElement('a');
      card.className  = 'project-card fade-in';
      card.href       = repo.html_url;
      card.target     = '_blank';
      card.rel        = 'noopener';
      card.innerHTML  = `
        <div class="project-card-header">
          <span class="project-icon">&#128193;</span>
          <span class="project-name">${escHtml(repo.name)}</span>
        </div>
        <p class="project-desc">${escHtml(repo.description || 'No description.')}</p>
        <div class="project-footer">
          ${repo.language ? `<span class="project-lang">${escHtml(repo.language)}</span>` : ''}
          <span>&#9733; ${repo.stargazers_count}</span>
          <span>&#8508; ${repo.forks_count}</span>
        </div>
      `;
      grid.appendChild(card);
      observer.observe(card);
      setTimeout(() => card.classList.add('visible'), 50);
    });

  } catch (err) {
    console.error('GitHub fetch error:', err);
    loading.remove();
    errorEl.classList.remove('hidden');
  }
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* =========================================================
   TYPEWRITER — types text into el char by char, returns Promise
   ========================================================= */
function typewriter(el, text, speed = 22) {
  return new Promise(resolve => {
    el.innerHTML = '';

    // Inline blinking cursor appended at the end while typing
    const cursor = document.createElement('span');
    cursor.className = 'ai-type-cursor';
    cursor.textContent = '▊';
    el.appendChild(cursor);

    let i = 0;
    const tick = setInterval(() => {
      if (i < text.length) {
        cursor.insertAdjacentText('beforebegin', text[i++]);
      } else {
        clearInterval(tick);
        cursor.classList.add('done'); // stop blinking, fade out
        resolve();
      }
    }, speed);
  });
}

/* =========================================================
   CLAUDE AI SUMMARY — generates on load, cached in sessionStorage
   ========================================================= */
async function loadAISummary() {
  const block  = document.getElementById('ai-summary');
  const bodyEl = document.getElementById('ai-summary-body');
  const CACHE_KEY = 'ai_summary_v1';

  // Serve from cache — still run typewriter so it feels consistent
  const cached = sessionStorage.getItem(CACHE_KEY);
  if (cached) {
    await typewriter(bodyEl, cached);
    return;
  }

  const prompt = `Write a concise 2-3 sentence professional summary for a software portfolio website.
Person: Liu Chee Wei (Jacky), R&D Software Architect, Penang, Malaysia.
Tech stack: C#, WPF, C++, OpenTAP, PTEM, Python, SECS/GEM, Test Automation, Software Architecture, Agile, Scrum, LiDAR/ADAS, EV Manufacturing Testing.
Rules: third person, specific about tech and domain, under 65 words, no filler phrases.`;

  try {
    const res = await fetch(CLAUDE_PROXY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 150,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) throw new Error(`Claude API ${res.status}`);
    const data = await res.json();
    const summary = data.content[0].text.trim();

    sessionStorage.setItem(CACHE_KEY, summary);
    await typewriter(bodyEl, summary);

  } catch (err) {
    // Silently hide on any failure — don't surface errors to visitors
    block.style.display = 'none';
  }
}

/* =========================================================
   RECRUITER AI TOOL
   ========================================================= */
const RESUME_TEXT = `Liu Chee Wei (Jacky) | R&D Software Lead Engineer | Penang, Malaysia
linkedin.com/in/jacky-liu-chee-wei | github.com/cheewliu | cheewei.1988@gmail.com

SUMMARY
Software architect and lead engineer with 13+ years across automotive test automation, semiconductor equipment, and entrepreneurship. At Keysight Technologies, led the architecture of PTEM on OpenTAP for global EV/ADAS programs and co-invented two US-patented LiDAR simulation systems.

SKILLS
Languages: C#, WPF, C++, Python, JavaScript, PowerShell
Frameworks & Tools: OpenTAP, PTEM, .NET, Docker, Jenkins, Azure DevOps, Git
Domain: EV/ADAS, LiDAR, HIL Testing, SECS/GEM, Automotive SPICE, EV Manufacturing Testing
Leadership: Scrum Master, Software Architecture, CI/CD, Agile

EXPERIENCE
R&D Software Lead Engineer | Keysight Technologies Malaysia | Oct 2019 – Present
- Led architecture and development of PTEM built on OpenTAP for EV/ADAS test automation
- Served as Scrum Master and established SQ release process for global automotive projects
- Started as main developer for LiDAR Target Simulator (E8717A) — resulted in 2 US patents

Motion Control & Software Dev Senior Engineer | WAFTECH | Apr 2016 – Sep 2019
- Built next-gen machine control software using C# and WPF
- Implemented SECS/GEM integration for semiconductor equipment communication
- Led on-site deployments and mentored junior engineers

Co-Founder | Makerzone Sdn Bhd | Apr 2011 – Mar 2016
- Founded a 3D printing service business from the ground up
- Built and managed the company marketing website

Machine Automation Software Engineer | WAFTECH | Oct 2014 – Apr 2015
- Developed motion control and wafer handling software in C# and WPF

R&D System Engineer | Keysight Technologies Malaysia | Jun 2011 – Oct 2014
- Developed automotive test systems using C++
- Supported TS-5000 hardware handler library

EDUCATION
Bachelor of Engineering (Hons), Electrical & Electronic Engineering
Universiti Tunku Abdul Rahman (UTAR), 2007 – 2011

CERTIFICATIONS
Agile SCRUM for Practitioners — DreamCatcher Consulting, Feb 2026
Practical AI with Machine and Deep Learning — DreamCatcher Consulting, Mar 2021

PATENTS
US20220260714A1 — Automated LiDAR Target Simulation Scanning Systems & Methods
US20230132855A1 — Automated LiDAR Target Simulation Scanning Systems and Methods`;

const MAX_ANALYSES = 3;
const RATE_KEY     = 'recruiter_uses';

// Character counter wired up in INIT block below

function updateRateDisplay() {
  const uses      = parseInt(sessionStorage.getItem(RATE_KEY) || '0');
  const remaining = Math.max(0, MAX_ANALYSES - uses);
  const el        = document.getElementById('jd-rate-display');
  const btn       = document.getElementById('analyze-btn');
  if (el) {
    el.textContent = remaining > 0
      ? `${remaining} analys${remaining === 1 ? 'is' : 'es'} remaining this session`
      : 'Session limit reached';
    el.classList.toggle('depleted', remaining === 0);
  }
  if (btn && uses >= MAX_ANALYSES) {
    btn.disabled = true;
    document.getElementById('recruiter-rate-msg').classList.remove('hidden');
  }
}

async function analyzeJobFit() {
  const jdInput = document.getElementById('jd-input');
  const jd      = jdInput ? jdInput.value.trim() : '';
  if (!jd) { jdInput && jdInput.focus(); return; }

  const uses = parseInt(sessionStorage.getItem(RATE_KEY) || '0');
  if (uses >= MAX_ANALYSES) {
    document.getElementById('recruiter-rate-msg').classList.remove('hidden');
    return;
  }

  const loadingEl = document.getElementById('recruiter-loading');
  const resultsEl = document.getElementById('recruiter-results');
  const errorEl   = document.getElementById('recruiter-error');
  const btn       = document.getElementById('analyze-btn');

  loadingEl.classList.remove('hidden');
  resultsEl.classList.add('hidden');
  errorEl.classList.add('hidden');
  document.getElementById('recruiter-rate-msg').classList.add('hidden');
  btn.disabled = true;

  const prompt = `You are an expert technical recruiter and career coach. Analyze the job description against the candidate's resume, then write a tailored cover letter.

CANDIDATE RESUME:
${RESUME_TEXT}

JOB DESCRIPTION:
${jd}

Return ONLY a valid JSON object — no markdown fences, no extra text — with this exact structure:
{
  "match": {
    "score": <integer 0-100, be honest and calibrated>,
    "strengths": ["<specific strength 1>", "<specific strength 2>", "<specific strength 3>"],
    "gaps": ["<gap 1>", "<optional gap 2>"]
  },
  "coverLetter": "<full cover letter, use \\n\\n to separate paragraphs. Confident, specific tone. Do not open with 'I am writing to apply'. Sign off as Liu Chee Wei (Jacky).>"
}

Score guide: 70+ = strong fit, 50-69 = moderate fit, below 50 = weak fit.
Strengths: reference specific skills or experiences from the resume that match the JD.
Gaps: be honest but constructive, max 2 items.
Cover letter: address a specific role requirement in the opening, reference exact tech from both JD and resume.`;

  try {
    const res = await fetch(CLAUDE_PROXY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) throw new Error(`API ${res.status}`);
    const data    = await res.json();
    const rawText = data.content[0].text.trim();

    // Strip code fences if Claude wraps in them
    const jsonStr = rawText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    const result  = JSON.parse(jsonStr);

    sessionStorage.setItem(RATE_KEY, String(uses + 1));
    updateRateDisplay();

    renderMatchPanel(result.match);
    renderCoverLetter(result.coverLetter);

    loadingEl.classList.add('hidden');
    resultsEl.classList.remove('hidden');
    resultsEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  } catch (err) {
    console.error('Recruiter tool error:', err);
    loadingEl.classList.add('hidden');
    errorEl.classList.remove('hidden');
    btn.disabled = false;
  }
}

function renderMatchPanel(match) {
  const CIRCUMFERENCE = 263.9; // 2π × r42
  const score  = Math.min(100, Math.max(0, match.score));
  const fill   = document.getElementById('score-ring-fill');
  const numEl  = document.getElementById('score-number');

  // Ring color
  const color = score >= 70 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444';
  fill.style.stroke = color;

  // Animate ring and counter
  const start     = performance.now();
  const duration  = 1200;
  function tick(now) {
    const p       = Math.min((now - start) / duration, 1);
    const eased   = 1 - Math.pow(1 - p, 3);
    numEl.textContent           = Math.round(eased * score);
    fill.style.strokeDashoffset = CIRCUMFERENCE * (1 - eased * score / 100);
    if (p < 1) requestAnimationFrame(tick);
  }
  fill.style.strokeDasharray  = CIRCUMFERENCE;
  fill.style.strokeDashoffset = CIRCUMFERENCE;
  requestAnimationFrame(tick);

  // Strengths
  const strengthsEl = document.getElementById('match-strengths');
  strengthsEl.innerHTML =
    `<div class="score-group-label strength">Strengths</div>` +
    (match.strengths || []).map(s =>
      `<div class="score-item strength"><span class="bullet">✓</span><span>${escHtml(s)}</span></div>`
    ).join('');

  // Gaps
  const gapsEl = document.getElementById('match-gaps');
  gapsEl.innerHTML =
    `<div class="score-group-label gap">Gaps</div>` +
    (match.gaps || []).map(g =>
      `<div class="score-item gap"><span class="bullet">△</span><span>${escHtml(g)}</span></div>`
    ).join('');
}

function renderCoverLetter(text) {
  const el = document.getElementById('cover-letter-body');
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim());
  el.innerHTML = paragraphs
    .map(p => `<p>${escHtml(p.trim()).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function copyCoverLetter() {
  const text = document.getElementById('cover-letter-body').innerText.trim();
  const btn  = document.getElementById('copy-btn');
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
  }).catch(() => {
    btn.textContent = 'Failed';
    setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
  });
}

/* =========================================================
   RESUME — section highlight active for AI Match
   ========================================================= */

/* =========================================================
   INIT
   ========================================================= */
document.addEventListener('DOMContentLoaded', () => {
  fetchGitHubProjects();
  loadAISummary();
  highlightActiveSection();
  updateRateDisplay();
  updateFab();

  const ta      = document.getElementById('jd-input');
  const counter = document.getElementById('jd-counter');
  if (ta && counter) {
    ta.addEventListener('input', () => {
      const len = ta.value.length;
      counter.textContent = `${len} / 3000`;
      counter.classList.toggle('warn', len > 2500);
    });
  }
});
