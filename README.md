# cheewliu.github.io

Personal portfolio site for Liu Chee Wei (Jacky) — R&D Software Manager specialising in EV/ADAS test automation, OpenTAP/PTEM, and LiDAR systems.

**Live site → [cheewliu.github.io](https://cheewliu.github.io)**

---

## Features

- **AI Summary** — Claude writes a short professional bio when the About section comes into view, cached in `sessionStorage`
- **AI Match** — paste any job description (or try a sample) to get a match score, strengths, gaps and a tailored cover letter in one structured API call
- **GitHub Projects** — live repo grid fetched from the GitHub API
- **Inline Resume** — styled HTML resume with PDF download via browser print
- **Editorial design** — Fraunces + Geist type, warm paper palette, light/dark themes that follow the OS, fully responsive

## Tech

| Layer | Stack |
|---|---|
| Frontend | Plain HTML, CSS, JS — no frameworks |
| AI | Claude API (`claude-opus-5-5`) |
| Proxy | Cloudflare Worker (rate-limited, CORS-scoped) |
| Hosting | GitHub Pages |

## Security

The Anthropic API key is **never exposed to the browser**. All Claude API calls are proxied through a Cloudflare Worker that injects the key from a Cloudflare secret at the edge. The worker enforces CORS (locked to `cheewliu.github.io`) and rate-limits requests per IP.

## Local development

```bash
# Serve the site locally
npx serve .

# Deploy / update the Cloudflare Worker
cd worker
wrangler deploy
```

Copy `config.example.js` → `config.js` if you need a local key for testing (gitignored).

Copy `worker/wrangler.example.toml` → `worker/wrangler.toml` and fill in your Cloudflare `account_id` and KV namespace `id` before deploying the worker. `worker/wrangler.toml` is gitignored to keep credentials out of the repo.
