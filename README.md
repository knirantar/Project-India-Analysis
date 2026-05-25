# Project India Analysis

Grounded intelligence presentation layer for the Project India global geopolitics monitor.

This repository does **not** collect internet data and does **not** normalize
evidence into invented schemas. It reads the data repository directly and builds
a Next.js intelligence application from gathered metadata, clean text, raw source
links, copied visual assets, copied PDFs, and grounded summaries.

Default input path:

```text
../Project-India-Data/data
```

## Run Locally

```bash
npm install
npm run dev
```

The builder creates:

```text
public/intelligence-data.json
public/evidence/<sha>.json
public/evidence-assets/*
public/evidence-files/*
```

Each evidence detail file contains the gathered clean text, extractive digest,
source metadata, and related evidence for one source. The React app provides
routing at:

```text
/
/evidence/<sha>
/api/grounded-brief
```

## Grounded AI

The builder and app can use `OPENAI_API_KEY` on the server. The build step uses it
for a grounded executive briefing when the secret is configured. The runtime API
uses it for evidence-specific Q&A. The key is never exposed to the browser, and
both prompts are constrained to selected gathered source text with source
citations. If `OPENAI_API_KEY` is not configured, the site falls back to
deterministic extractive summaries and gathered extracts.

## Hourly Sync

`.github/workflows/sync-analysis.yml` runs every hour and:

```text
checks out knirantar/Project-India-Data
builds raw-evidence app data
builds the Next.js app
commits refreshed public evidence artifacts
```

Because `Project-India-Data` is separate, add one of these secrets to
`knirantar/Project-India-Analysis`:

```text
PROJECT_INDIA_DATA_SSH_KEY   deploy key/private key with read access to Project-India-Data
PROJECT_INDIA_DATA_TOKEN     fine-grained PAT with read access to Project-India-Data
```

Deploy as a Next.js app:

```text
Repository: knirantar/Project-India-Analysis
Branch: main
Build command: npm run build
Start command: npm run start
```
