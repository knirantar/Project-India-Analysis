import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dataDir = path.resolve(process.env.PROJECT_INDIA_DATA_DIR || process.env.DATA_DIR || "../Project-India-Data/data");
const outDir = path.join(root, "public");
const outPath = path.join(outDir, "intelligence-data.json");
const evidenceDir = path.join(outDir, "evidence");
const assetDir = path.join(outDir, "evidence-assets");

const SIGNALS = [
  { name: "War and escalation", terms: ["war", "strike", "attack", "missile", "drone", "military", "troops", "ceasefire", "escalation"] },
  { name: "Diplomacy and negotiations", terms: ["diplomacy", "talks", "minister", "summit", "statement", "agreement", "negotiation", "envoy"] },
  { name: "Sanctions and finance", terms: ["sanction", "ofac", "treasury", "asset", "designation", "export control", "oil price", "bank"] },
  { name: "Nuclear and strategic risk", terms: ["nuclear", "iaea", "enrichment", "reactor", "missile defense", "deterrence"] },
  { name: "Legal and institutional order", terms: ["court", "tribunal", "united nations", "security council", "resolution", "international law", "icc", "icj"] },
  { name: "Humanitarian pressure", terms: ["humanitarian", "refugee", "displacement", "civilian", "aid", "casualties", "relief"] },
  { name: "Geospatial and territorial control", terms: ["border", "territory", "map", "maritime", "disputed", "strait", "sea", "boundary"] },
  { name: "Energy and chokepoints", terms: ["energy", "oil", "gas", "shipping", "red sea", "hormuz", "pipeline", "chokepoint"] }
];

const REGIONS = [
  { name: "Middle East", terms: ["iran", "israel", "gaza", "syria", "iraq", "yemen", "red sea", "hormuz", "saudi", "lebanon"] },
  { name: "Europe and Russia", terms: ["ukraine", "russia", "nato", "moscow", "kyiv", "black sea", "european union"] },
  { name: "Indo-Pacific", terms: ["china", "taiwan", "south china sea", "india", "pakistan", "korea", "indo-pacific"] },
  { name: "Africa", terms: ["sudan", "sahel", "africa", "ethiopia", "congo", "niger", "mali"] },
  { name: "Americas", terms: ["united states", "washington", "venezuela", "mexico", "canada", "brazil"] },
  { name: "Global institutions", terms: ["united nations", "security council", "world bank", "icj", "icc", "nato", "iaea"] }
];

const STOPWORDS = new Set([
  "about", "after", "again", "against", "also", "amid", "among", "because", "before", "being", "between", "could", "during",
  "from", "have", "into", "more", "over", "said", "says", "than", "that", "their", "there", "these", "this", "through",
  "under", "were", "what", "when", "where", "which", "while", "with", "would", "will", "news", "latest", "global"
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
  return item.collected_at || item.published || "";
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

function sentences(text, limit = 3) {
  return text
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 45)
    .slice(0, limit);
}

function groundedSummary(text, title) {
  const selected = sentences(text, 3);
  if (selected.length) return selected.join(" ");
  return text ? text.replace(/\s+/g, " ").slice(0, 360) : title;
}

function keywordsFor(text, limit = 10) {
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
  while ((match = pattern.exec(normalized)) && matches.length < 6) {
    const date = match[0];
    if (seen.has(date)) continue;
    seen.add(date);
    const start = Math.max(0, match.index - 120);
    const end = Math.min(normalized.length, match.index + 220);
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

fs.mkdirSync(outDir, { recursive: true });
fs.rmSync(evidenceDir, { recursive: true, force: true });
fs.rmSync(assetDir, { recursive: true, force: true });
fs.mkdirSync(evidenceDir, { recursive: true });
fs.mkdirSync(assetDir, { recursive: true });

const rawMetadataFiles = walk(dataDir, (filePath, name) => {
  return name.endsWith(".json") && !name.endsWith(".analysis.json") && !name.startsWith("_");
});

const evidence = rawMetadataFiles.map((filePath) => {
  const meta = readJson(filePath, {});
  const topic = path.basename(path.dirname(path.dirname(filePath)));
  const localTextPath = meta.text_path
    ? path.resolve(dataDir, String(meta.text_path).replace(/^data\//, ""))
    : filePath.replace(/\.json$/, ".txt");
  const rawPath = meta.raw_path
    ? path.resolve(dataDir, String(meta.raw_path).replace(/^data\//, ""))
    : "";
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
    excerpt: fullText.replace(/\s+/g, " ").slice(0, 900),
    keywords: keywordsFor(searchText, 8),
    signals: matchingNames(searchText, SIGNALS),
    regions: matchingNames(searchText, REGIONS),
    full_text: fullText
  };
}).sort(sortDateDesc);

let copiedImages = 0;
for (const item of evidence) {
  if (item.format !== "Image" || !item.raw_file_path || copiedImages >= 24) continue;
  if (!fs.existsSync(item.raw_file_path)) continue;
  const ext = path.extname(item.raw_file_path) || ".jpg";
  if (![".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext.toLowerCase())) continue;
  const assetName = `${item.id}${ext}`;
  fs.copyFileSync(item.raw_file_path, path.join(assetDir, assetName));
  item.preview_asset = `/evidence-assets/${assetName}`;
  copiedImages += 1;
}

const timeline = evidence.flatMap((item) => extractTimeline(item.full_text, item)).sort((a, b) => a.date.localeCompare(b.date));
const signalCards = SIGNALS.map((signal) => {
  const matches = evidence.filter((item) => item.signals.includes(signal.name));
  return {
    name: signal.name,
    count: matches.length,
    formats: countBy(matches, (item) => item.format).slice(0, 5),
    evidence_ids: matches.slice(0, 8).map((item) => item.id),
    latest: matches.slice(0, 4).map((item) => ({
      id: item.id,
      title: item.title,
      url: item.url,
      host: item.host,
      format: item.format,
      collected_at: item.collected_at,
      summary: item.summary
    }))
  };
}).filter((signal) => signal.count > 0).sort((a, b) => b.count - a.count);

const regionCards = REGIONS.map((region) => {
  const matches = evidence.filter((item) => item.regions.includes(region.name));
  return { name: region.name, count: matches.length, evidence_ids: matches.slice(0, 12).map((item) => item.id) };
}).filter((region) => region.count > 0).sort((a, b) => b.count - a.count);

const allKeywords = evidence.flatMap((item) => item.keywords.map((keyword) => ({ ...keyword, evidence_id: item.id })));
const keywordCounts = countBy(allKeywords, (item) => item.name).slice(0, 40);
const latestEvidenceTimestamp = evidence.map(dateValue).filter(Boolean).sort((a, b) => String(b).localeCompare(String(a)))[0] || "";

const manifestEvidence = evidence.map((item) => {
  const { full_text, raw_file_path, ...rest } = item;
  return {
    ...rest,
    detail_path: `/evidence/${item.id}`,
    evidence_json: `/evidence/${item.id}.json`
  };
});

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
  mode: "raw-evidence-only",
  summary: {
    raw_documents: evidence.length,
    total_text_chars: evidence.reduce((sum, item) => sum + item.text_chars, 0),
    sources: new Set(evidence.map((item) => item.host)).size,
    signals: signalCards.length,
    regions: regionCards.length,
    visual_items: manifestEvidence.filter((item) => item.preview_asset).length
  },
  format_counts: countBy(evidence, (item) => item.format),
  data_type_counts: countBy(evidence, (item) => item.data_type),
  source_counts: countBy(evidence, (item) => item.host).slice(0, 28),
  keyword_counts: keywordCounts,
  signals: signalCards,
  regions: regionCards,
  timeline: timeline.slice(0, 120),
  latest_evidence: manifestEvidence.slice(0, 60),
  deep_reads: [...manifestEvidence].sort((a, b) => b.text_chars - a.text_chars).slice(0, 24),
  visual_evidence: manifestEvidence.filter((item) => item.preview_asset).slice(0, 24),
  evidence: manifestEvidence
};

fs.writeFileSync(outPath, JSON.stringify(intelligence, null, 2));
console.log(`wrote ${path.relative(root, outPath)} and ${evidence.length} evidence detail files`);
