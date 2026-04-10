# cheewliu.github.io

Personal portfolio site for Liu Chee Wei (Jacky) — R&D Software Lead Engineer specialising in EV/ADAS test automation, OpenTAP/PTEM, and LiDAR systems.

**Live site → [cheewliu.github.io](https://cheewliu.github.io)**

---

## Features

- **AI Skills Summary** — Claude generates a concise professional bio on page load, cached in `sessionStorage`
- **AI Recruiter Tool** — paste any job description to get an instant resume match score (animated ring meter) + tailored cover letter, generated in a single API call
- **GitHub Projects** — live repo grid fetched from the GitHub API
- **Inline Resume** — styled HTML resume with PDF download via browser print
- **Dark developer aesthetic** — monospace accents, grid background, typewriter animations

## Tech

| Layer | Stack |
|---|---|
| Frontend | Plain HTML, CSS, JS — no frameworks |
| AI | Claude API (`claude-sonnet-4-20250514`) |
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
