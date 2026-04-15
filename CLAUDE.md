# CLAUDE.md — Project Overview

Personal portfolio site for **Liu Chee Wei (Jacky)**, R&D Software Lead Engineer at Keysight Technologies.  
Live at: https://cheewliu.github.io  
Repo: https://github.com/cheewliu/cheewliu.github.io

---

## Architecture

```
Frontend (GitHub Pages)
  └── HTML / CSS / vanilla JS
        └── Claude AI calls  ──► Cloudflare Worker (proxy)  ──► Anthropic API
        └── GitHub repo data ──► Cloudflare Worker (proxy)  ──► GitHub API
```

No frameworks. No build step. Deployed by pushing to GitHub Pages.

---

## File Map

| File / Path | Purpose |
|---|---|
| `index.html` | Main portfolio page (single-page with anchored sections) |
| `resume.html` | Printable/PDF resume page |
| `style.css` | All styling — dark/light mode, animations, responsive layout |
| `script.js` | All frontend logic — navbar, AI calls, GitHub fetch, animations |
| `config.js` | Local dev only — holds `ANTHROPIC_API_KEY`. **Gitignored.** |
| `config.example.js` | Template for `config.js`. Safe to commit. |
| `robots.txt` | Search engine crawler rules |
| `sitemap.xml` | SEO sitemap |
| `google889a789914c40ad3.html` | Google Search Console verification file |
| `assets/profile.jpg` | Profile photo used in Open Graph and the About section |
| `worker/src/index.js` | Cloudflare Worker — API proxy (Claude + GitHub) |
| `worker/wrangler.toml` | Cloudflare Worker deploy config. **Gitignored.** |
| `worker/wrangler.example.toml` | Template for `wrangler.toml`. Safe to commit. |

---

## Key Features

### AI Skills Summary
On page load, Claude generates a concise professional bio. Result is cached in `sessionStorage` so the API is only called once per browser session.

### AI Recruiter Tool
User pastes a job description; a single API call returns:
- A **match score** (0–100) rendered as an animated ring meter
- A tailored **cover letter**

### GitHub Projects Grid
Live repo grid fetched via the Worker proxy (`GET /github`). Falls back to unauthenticated GitHub API if the Worker is unavailable. Results are cached in `sessionStorage` for 10 minutes.

### Dark / Light Mode
Toggle persisted to `localStorage`. Default is dark.

---

## Security Model

- The Anthropic API key is **never sent to the browser**. It lives as a Cloudflare secret and is injected by the Worker at the edge.
- The Worker enforces **CORS** — only `cheewliu.github.io` and `localhost` are allowed origins.
- **Rate limiting** — 50 Claude calls per IP per hour, tracked via a Cloudflare KV namespace.
- Request body is capped at **16 KB** to prevent abuse.
- `config.js` (local dev key) is gitignored.

---

## Local Development

```bash
# Serve the frontend
npx serve .

# Deploy / update the Worker
cd worker
wrangler deploy
```

**First-time setup:**
1. Copy `config.example.js` → `config.js` and add your Anthropic API key (local dev only).
2. Copy `worker/wrangler.example.toml` → `worker/wrangler.toml` and fill in:
   - `account_id` — Cloudflare account ID
   - KV namespace `id` — for rate limiting

---

## Cloudflare Worker Routes

| Method | Path | Action |
|---|---|---|
| `GET` | `/github` | Proxies GitHub public repos for `cheewliu` |
| `POST` | `/` | Proxies requests to the Anthropic Claude API |
| `OPTIONS` | `*` | CORS preflight |

Worker name: `jacky-portfolio-proxy`  
KV binding: `RATE_LIMIT`  
Secrets required: `ANTHROPIC_API_KEY`, `GITHUB_TOKEN` (optional, increases GitHub rate limit)

---

## Tech Stack

| Layer | Detail |
|---|---|
| Frontend | Plain HTML5, CSS3, vanilla JS (ES2020+) |
| AI model | `claude-sonnet-4-20250514` via Anthropic API |
| API proxy | Cloudflare Worker (module syntax) |
| Hosting | GitHub Pages |
| SEO | Schema.org JSON-LD, Open Graph, Twitter Card, canonical URL |
