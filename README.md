# Project India Analysis

Raw-evidence presentation layer for the Project India global geopolitics monitor.

This repository does **not** collect internet data and does **not** normalize
evidence into invented schemas. It reads the data repository directly and builds
a Next.js intelligence application from gathered metadata, clean text, raw source
links, and copied visual assets.

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
```

Each evidence detail file contains the gathered clean text for one source. The
React app provides routing at:

```text
/
/evidence/<sha>
/api/grounded-brief
```

## Grounded AI

The app can use `OPENAI_API_KEY` on the server for evidence-specific Q&A, but the
key is never exposed to the browser. The API prompt is constrained to selected
gathered source text and must cite the provided source. If `OPENAI_API_KEY` is not
configured, the app returns gathered extracts instead of an AI answer.

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
