# Project India Analysis

Separate presentation and analysis layer for Project India global geopolitics evidence.

This repository does **not** collect internet data. It reads Project India raw
evidence plus any available analysis artifacts and renders a premium geopolitics
intelligence application.

Default input path:

```text
../Project-India-Data/data
```

Run:

```bash
python -m project_india_analysis.cli \
  --data-dir ../Project-India-Data/data \
  --output-dir analysis_output
```

Outputs:

```text
analysis_output/summary.json
analysis_output/topic_cards.json
analysis_output/topics/<topic-slug>.json
analysis_output/documents.jsonl
analysis_output/claims.jsonl
analysis_output/entities.jsonl
analysis_output/events.jsonl
analysis_output/metrics.jsonl
analysis_output/relationships.jsonl
analysis_output/timelines.jsonl
analysis_output/citations.jsonl
```

## Next.js intelligence app

Run locally:

```bash
npm install
npm run dev
```

The app reads `public/intelligence-data.json`, generated from:

```bash
npm run build:data
```

By default the builder reads:

```text
../Project-India-Data/data
analysis_output/
```

It does not require normalized data. Raw articles, PDFs, books/reference pages,
sanctions XML, structured datasets, geospatial ZIP metadata, audio/video/image
feed items, and existing analysis objects are all turned into one presentation
bundle.

## Hourly sync

`.github/workflows/sync-analysis.yml` runs every hour and:

```text
checks out knirantar/Project-India-Data
builds analysis_output/
builds public/intelligence-data.json
verifies the Next.js app
commits refreshed presentation artifacts
```

Because `Project-India-Data` is a separate repository, add one of these secrets
to `knirantar/Project-India-Analysis` before the workflow can sync data:

```text
PROJECT_INDIA_DATA_SSH_KEY   deploy key/private key with read access to Project-India-Data
PROJECT_INDIA_DATA_TOKEN     fine-grained PAT with read access to Project-India-Data
```

For a public UI, deploy this repository as a Next.js app:

```text
Repository: knirantar/Project-India-Analysis
Branch: main
Build command: npm run build
Start command: npm run start
```
