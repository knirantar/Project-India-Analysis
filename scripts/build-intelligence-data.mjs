import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dataDir = path.resolve(process.env.PROJECT_INDIA_DATA_DIR || process.env.DATA_DIR || "../Project-India-Data/data");
const outDir = path.join(root, "public");
const outPath = path.join(outDir, "intelligence-data.json");
const evidenceDir = path.join(outDir, "evidence");
const assetDir = path.join(outDir, "evidence-assets");
const fileDir = path.join(outDir, "evidence-files");

const SIGNALS = [
  { name: "War and Escalation", terms: ["war", "strike", "attack", "missile", "drone", "military", "troops", "ceasefire", "escalation", "blockade", "air defense"] },
  { name: "Diplomacy and Negotiations", terms: ["diplomacy", "talks", "minister", "summit", "statement", "agreement", "negotiation", "envoy", "deal", "dialogue"] },
  { name: "Sanctions and Finance", terms: ["sanction", "ofac", "treasury", "asset", "designation", "export control", "bank", "finance", "evasion"] },
  { name: "Nuclear and Strategic Risk", terms: ["nuclear", "iaea", "enrichment", "reactor", "missile defense", "deterrence", "strategic"] },
  { name: "Institutions and Law", terms: ["court", "tribunal", "united nations", "security council", "resolution", "international law", "icc", "icj", "charter"] },
  { name: "Humanitarian Pressure", terms: ["humanitarian", "refugee", "displacement", "civilian", "aid", "casualties", "relief", "food insecurity", "ipc phase"] },
  { name: "Territory and Chokepoints", terms: ["border", "territory", "map", "maritime", "disputed", "strait", "sea", "boundary", "red sea", "hormuz"] },
  { name: "Energy and Supply Chains", terms: ["energy", "oil", "gas", "shipping", "pipeline", "supply chain", "lng", "market"] }
];

const REGIONS = [
  { name: "Middle East", terms: ["iran", "israel", "gaza", "syria", "iraq", "yemen", "red sea", "hormuz", "saudi", "lebanon", "palestinian"] },
  { name: "Europe and Russia", terms: ["ukraine", "russia", "nato", "moscow", "kyiv", "black sea", "european union", "poland"] },
  { name: "Indo-Pacific", terms: ["china", "taiwan", "south china sea", "india", "pakistan", "korea", "indo-pacific", "japan"] },
  { name: "Africa", terms: ["sudan", "sahel", "africa", "ethiopia", "congo", "niger", "mali", "chad", "nigeria", "mozambique"] },
  { name: "Americas", terms: ["united states", "washington", "venezuela", "mexico", "canada", "brazil", "haiti"] },
  { name: "Global Institutions", terms: ["united nations", "security council", "world bank", "icj", "icc", "nato", "iaea", "icrc"] }
];

const STOPWORDS = new Set([
  "about", "after", "again", "against", "also", "amid", "among", "because", "before", "being", "between", "could", "during",
  "from", "have", "into", "more", "over", "said", "says", "than", "that", "their", "there", "these", "this", "through",
  "under", "were", "what", "when", "where", "which", "while", "with", "would", "will", "news", "latest", "global",
  "page", "print", "read", "share", "source", "title", "content", "report", "update"
]);

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function readText(filePath, max = Infinity) {
  try {
    const text = fs.readFileSync(filePath, "utf8").replace(/\r/g, "").replace(/[ \t]+/g, " ").trim();
    return Number.isFinite(max) ? text.slice(0, max) : text;
  } catch {
    return "";
  }
}

function walk(dir, matcher, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const itemPath = path.join(dir, item.name);
    if (item.isDirectory()) walk(itemPath, matcher, files);
    else if (matcher(itemPath, item.name)) files.push(itemPath);
  }
  return files;
}

function sourceHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "local evidence";
  }
}

function countBy(items, getter) {
  const counts = new Map();
  for (const item of items) {
    const key = getter(item) || "unknown";
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, value]) => ({ name, value }));
}

function dateValue(item) {
  return item.published || item.collected_at || "";
}

function sortDateDesc(a, b) {
  return String(dateValue(b)).localeCompare(String(dateValue(a)));
}

function classifyFormat(dataType = "", contentType = "", url = "") {
  const haystack = `${dataType} ${contentType} ${url}`.toLowerCase();
  if (haystack.includes("pdf")) return "PDF";
  if (haystack.includes("book") || haystack.includes("factbook")) return "Book";
  if (haystack.includes("image")) return "Image";
  if (haystack.includes("video")) return "Video";
  if (haystack.includes("audio") || haystack.includes("podcast")) return "Audio";
  if (haystack.includes("sanctions")) return "Sanctions";
  if (haystack.includes("dataset") || haystack.includes("json") || haystack.includes("xml") || haystack.includes("zip")) return "Dataset";
  return "Article";
}

function sentences(text, limit = 8) {
  return text
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 55 && item.length < 360)
    .slice(0, limit);
}

function meaningfulSentences(text, limit = 4) {
  const selected = sentences(text, 18)
    .filter((line) => !/^(print this page|share|copyright|all rights reserved)/i.test(line))
    .sort((a, b) => scoreSentence(b) - scoreSentence(a));
  return selected.slice(0, limit);
}

function scoreSentence(sentence) {
  const lower = sentence.toLowerCase();
  let score = 0;
  for (const signal of SIGNALS) {
    if (signal.terms.some((term) => lower.includes(term))) score += 3;
  }
  for (const region of REGIONS) {
    if (region.terms.some((term) => lower.includes(term))) score += 2;
  }
  if (/\d/.test(sentence)) score += 1;
  if (sentence.length > 100) score += 1;
  return score;
}

function groundedSummary(text, title) {
  const selected = meaningfulSentences(text, 3);
  if (selected.length) return selected.join(" ");
  return text ? text.replace(/\s+/g, " ").slice(0, 420) : title;
}

function analyticalBullets(text, title) {
  const selected = meaningfulSentences(text, 5);
  if (selected.length) return selected.map((line) => line.replace(/\s+/g, " "));
  return [groundedSummary(text, title)];
}

function keywordsFor(text, limit = 12) {
  const counts = new Map();
  for (const token of text.toLowerCase().match(/[a-z][a-z-]{3,}/g) || []) {
    const normalized = token.replace(/^-|-$/g, "");
    if (STOPWORDS.has(normalized)) continue;
    counts.set(normalized, (counts.get(normalized) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([name, value]) => ({ name, value }));
}

function matchingNames(text, rules) {
  const haystack = text.toLowerCase();
  return rules.filter((rule) => rule.terms.some((term) => haystack.includes(term))).map((rule) => rule.name);
}

function extractTimeline(text, evidence) {
  const matches = [];
  const seen = new Set();
  const normalized = text.replace(/\s+/g, " ");
  const pattern = /\b(?:19|20)\d{2}(?:[-/](?:0?[1-9]|1[0-2])(?:[-/](?:0?[1-9]|[12]\d|3[01]))?)?\b/g;
  let match;
  while ((match = pattern.exec(normalized)) && matches.length < 5) {
    const date = match[0];
    if (seen.has(date)) continue;
    seen.add(date);
    const start = Math.max(0, match.index - 120);
    const end = Math.min(normalized.length, match.index + 260);
    matches.push({
      date,
      evidence_id: evidence.id,
      title: evidence.title,
      url: evidence.url,
      excerpt: normalized.slice(start, end).trim()
    });
  }
  return matches;
}

function safeFileName(value) {
  return String(value).replace(/[^a-zA-Z0-9_-]/g, "_");
}

function resolveDataPath(value) {
  if (!value) return "";
  const raw = String(value);
  if (path.isAbsolute(raw)) return raw;
  return path.resolve(dataDir, raw.replace(/^data\//, ""));
}

function copyRenderableFile(item) {
  if (!item.raw_file_path || !fs.existsSync(item.raw_file_path)) return;
  const ext = path.extname(item.raw_file_path).toLowerCase();
  if (item.format === "Image" && [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext)) {
    const assetName = `${item.id}${ext || ".jpg"}`;
    fs.copyFileSync(item.raw_file_path, path.join(assetDir, assetName));
    item.preview_asset = `/evidence-assets/${assetName}`;
    return;
  }
  if (item.format === "PDF" && ext === ".pdf") {
    const fileName = `${item.id}.pdf`;
    fs.copyFileSync(item.raw_file_path, path.join(fileDir, fileName));
    item.file_asset = `/evidence-files/${fileName}`;
  }
}

function buildFallbackBrief(evidence, signalCards, regionCards) {
  const leadDocs = evidence
    .filter((item) => item.text_chars > 1200)
    .slice(0, 10);
  const strongest = signalCards.slice(0, 4).map((signal) => {
    const first = signal.latest[0];
    return {
      title: signal.name,
      finding: first ? `${signal.count} gathered records currently cluster around ${signal.name.toLowerCase()}. Leading source: ${first.title}.` : `${signal.count} gathered records currently cluster here.`,
      citations: signal.evidence_ids.slice(0, 3)
    };
  });
  return {
    method: "extractive-fallback",
    headline: "Current gathered evidence is concentrated in escalation, humanitarian pressure, sanctions, and institutional risk.",
    executive_summary: leadDocs.slice(0, 4).map((item) => `${item.title}: ${item.summary}`),
    key_judgments: strongest,
    regional_read: regionCards.slice(0, 5).map((region) => ({
      region: region.name,
      assessment: `${region.count} gathered records mention this region or institution cluster.`,
      citations: region.evidence_ids.slice(0, 4)
    })),
    watchlist: signalCards.slice(0, 5).map((signal) => ({
      label: signal.name,
      why_it_matters: signal.latest[0]?.summary || "Evidence exists, but clean text is limited.",
      citations: signal.evidence_ids.slice(0, 3)
    })),
    caveats: [
      "This briefing is generated only from collected text and metadata.",
      "Where source text is thin, the app shows the raw record rather than inventing missing analysis."
    ]
  };
}

async function buildAiBrief(evidence, signalCards, regionCards) {
  if (!process.env.OPENAI_API_KEY || process.env.DISABLE_AI_BRIEF === "1") {
    return buildFallbackBrief(evidence, signalCards, regionCards);
  }

  const selected = evidence
    .filter((item) => item.text_chars > 900 && item.format !== "Image")
    .slice(0, Number(process.env.AI_BRIEF_SOURCE_LIMIT || 28))
    .map((item, index) => ({
      source_no: index + 1,
      id: item.id,
      title: item.title,
      host: item.host,
      format: item.format,
      signals: item.signals,
      regions: item.regions,
      excerpt: item.full_text.replace(/\s+/g, " ").slice(0, 2200)
    }));

  const prompt = {
    task: "Create a polished intelligence briefing for a geopolitics monitoring website. Use only the supplied gathered evidence excerpts. Do not use outside facts. Do not invent dates, casualties, actors, conclusions, or causal claims. Every key judgment and watchlist item must cite evidence ids from the provided sources.",
    required_json_shape: {
      headline: "one sentence",
      executive_summary: ["4 concise grounded paragraphs"],
      key_judgments: [{ title: "judgment title", finding: "grounded finding", citations: ["evidence id"] }],
      regional_read: [{ region: "region", assessment: "grounded assessment", citations: ["evidence id"] }],
      watchlist: [{ label: "watch item", why_it_matters: "grounded reason", citations: ["evidence id"] }],
      caveats: ["limitations from source coverage"]
    },
    available_signal_counts: signalCards.map((signal) => ({ name: signal.name, count: signal.count })),
    available_region_counts: regionCards.map((region) => ({ name: region.name, count: region.count })),
    sources: selected
  };

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You are a careful geopolitical intelligence editor. You must be grounded only in supplied evidence. Return strict JSON only."
          },
          { role: "user", content: JSON.stringify(prompt) }
        ]
      })
    });
    if (!response.ok) throw new Error(await response.text());
    const payload = await response.json();
    const content = payload.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);
    return {
      method: `openai:${process.env.OPENAI_MODEL || "gpt-4o-mini"}`,
      headline: String(parsed.headline || ""),
      executive_summary: Array.isArray(parsed.executive_summary) ? parsed.executive_summary.slice(0, 5) : [],
      key_judgments: Array.isArray(parsed.key_judgments) ? parsed.key_judgments.slice(0, 8) : [],
      regional_read: Array.isArray(parsed.regional_read) ? parsed.regional_read.slice(0, 8) : [],
      watchlist: Array.isArray(parsed.watchlist) ? parsed.watchlist.slice(0, 8) : [],
      caveats: Array.isArray(parsed.caveats) ? parsed.caveats.slice(0, 5) : []
    };
  } catch (error) {
    console.warn(`AI briefing unavailable, using extractive fallback: ${String(error).slice(0, 220)}`);
    return buildFallbackBrief(evidence, signalCards, regionCards);
  }
}

fs.mkdirSync(outDir, { recursive: true });
fs.rmSync(evidenceDir, { recursive: true, force: true });
fs.rmSync(assetDir, { recursive: true, force: true });
fs.rmSync(fileDir, { recursive: true, force: true });
fs.mkdirSync(evidenceDir, { recursive: true });
fs.mkdirSync(assetDir, { recursive: true });
fs.mkdirSync(fileDir, { recursive: true });

const rawMetadataFiles = walk(dataDir, (filePath, name) => {
  return name.endsWith(".json") && !name.endsWith(".analysis.json") && !name.startsWith("_");
});

const evidence = rawMetadataFiles.map((filePath) => {
  const meta = readJson(filePath, {});
  const topic = path.basename(path.dirname(path.dirname(filePath)));
  const localTextPath = meta.text_path ? resolveDataPath(meta.text_path) : filePath.replace(/\.json$/, ".txt");
  const rawPath = meta.raw_path ? resolveDataPath(meta.raw_path) : "";
  const fullText = readText(localTextPath);
  const title = meta.title || meta.source_title || meta.url || "Untitled evidence";
  const format = classifyFormat(meta.data_type, meta.content_type, meta.url);
  const searchText = `${title}\n${meta.url || ""}\n${fullText}`;
  const id = safeFileName(meta.sha256 || path.basename(filePath, ".json"));
  return {
    id,
    topic,
    title,
    url: meta.url || "",
    host: sourceHost(meta.url || ""),
    source: meta.source || "",
    data_type: meta.data_type || "unknown",
    format,
    content_type: meta.content_type || "",
    collected_at: meta.collected_at || "",
    published: meta.published || "",
    text_chars: Number(meta.text_chars || fullText.length || 0),
    raw_path: meta.raw_path || "",
    text_path: meta.text_path || "",
    raw_file_path: rawPath,
    summary: groundedSummary(fullText, title),
    bullets: analyticalBullets(fullText, title),
    excerpt: fullText.replace(/\s+/g, " ").slice(0, 1200),
    keywords: keywordsFor(searchText, 10),
    signals: matchingNames(searchText, SIGNALS),
    regions: matchingNames(searchText, REGIONS),
    full_text: fullText
  };
}).sort(sortDateDesc);

for (const item of evidence) copyRenderableFile(item);

const timeline = evidence.flatMap((item) => extractTimeline(item.full_text, item)).sort((a, b) => a.date.localeCompare(b.date));
const signalCards = SIGNALS.map((signal) => {
  const matches = evidence.filter((item) => item.signals.includes(signal.name));
  return {
    name: signal.name,
    count: matches.length,
    formats: countBy(matches, (item) => item.format).slice(0, 5),
    evidence_ids: matches.slice(0, 10).map((item) => item.id),
    summary: matches.slice(0, 4).map((item) => item.summary).join(" "),
    latest: matches.slice(0, 5).map((item) => ({
      id: item.id,
      title: item.title,
      url: item.url,
      host: item.host,
      format: item.format,
      collected_at: item.collected_at,
      published: item.published,
      summary: item.summary
    }))
  };
}).filter((signal) => signal.count > 0).sort((a, b) => b.count - a.count);

const regionCards = REGIONS.map((region) => {
  const matches = evidence.filter((item) => item.regions.includes(region.name));
  return {
    name: region.name,
    count: matches.length,
    evidence_ids: matches.slice(0, 12).map((item) => item.id),
    top_sources: countBy(matches, (item) => item.host).slice(0, 5)
  };
}).filter((region) => region.count > 0).sort((a, b) => b.count - a.count);

const allKeywords = evidence.flatMap((item) => item.keywords.map((keyword) => ({ ...keyword, evidence_id: item.id })));
const keywordCounts = countBy(allKeywords, (item) => item.name).slice(0, 45);
const latestEvidenceTimestamp = evidence.map(dateValue).filter(Boolean).sort((a, b) => String(b).localeCompare(String(a)))[0] || "";

const manifestEvidence = evidence.map((item) => {
  const { full_text, raw_file_path, ...rest } = item;
  return {
    ...rest,
    detail_path: `/evidence/${item.id}`,
    evidence_json: `/evidence/${item.id}.json`
  };
});

const briefing = await buildAiBrief(evidence, signalCards, regionCards);
const evidenceById = new Map(manifestEvidence.map((item) => [item.id, item]));

for (const item of evidence) {
  const detail = {
    ...item,
    raw_file_path: undefined,
    full_text: item.full_text,
    related: manifestEvidence
      .filter((candidate) => candidate.id !== item.id && candidate.signals.some((signal) => item.signals.includes(signal)))
      .slice(0, 8)
  };
  fs.writeFileSync(path.join(evidenceDir, `${item.id}.json`), JSON.stringify(detail, null, 2));
}

const intelligence = {
  generated_at: latestEvidenceTimestamp,
  data_source: "knirantar/Project-India-Data/data",
  mode: briefing.method.startsWith("openai:") ? "ai-grounded-presentation" : "extractive-grounded-presentation",
  briefing,
  summary: {
    raw_documents: evidence.length,
    total_text_chars: evidence.reduce((sum, item) => sum + item.text_chars, 0),
    sources: new Set(evidence.map((item) => item.host)).size,
    signals: signalCards.length,
    regions: regionCards.length,
    visual_items: manifestEvidence.filter((item) => item.preview_asset).length,
    pdf_items: manifestEvidence.filter((item) => item.format === "PDF").length,
    renderable_files: manifestEvidence.filter((item) => item.file_asset).length
  },
  format_counts: countBy(evidence, (item) => item.format),
  data_type_counts: countBy(evidence, (item) => item.data_type),
  source_counts: countBy(evidence, (item) => item.host).slice(0, 28),
  keyword_counts: keywordCounts,
  signals: signalCards,
  regions: regionCards,
  timeline: timeline.slice(0, 140),
  latest_evidence: manifestEvidence.slice(0, 80),
  deep_reads: [...manifestEvidence].sort((a, b) => b.text_chars - a.text_chars).slice(0, 28),
  documents: manifestEvidence.filter((item) => ["PDF", "Book", "Dataset", "Sanctions"].includes(item.format)).slice(0, 36),
  visual_evidence: manifestEvidence.filter((item) => item.preview_asset).slice(0, 24),
  cited_evidence: [...new Set([
    ...(briefing.key_judgments || []).flatMap((item) => item.citations || []),
    ...(briefing.watchlist || []).flatMap((item) => item.citations || [])
  ])].map((id) => evidenceById.get(id)).filter(Boolean).slice(0, 18),
  evidence: manifestEvidence
};

fs.writeFileSync(outPath, JSON.stringify(intelligence, null, 2));
console.log(`wrote ${path.relative(root, outPath)}, ${evidence.length} evidence pages, ${intelligence.summary.renderable_files} renderable files`);
