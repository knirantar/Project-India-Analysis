import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dataDir = path.resolve(process.env.PROJECT_INDIA_DATA_DIR || process.env.DATA_DIR || "../Project-India-Data/data");
const analysisDir = path.resolve(process.env.PROJECT_INDIA_ANALYSIS_DIR || "analysis_output");
const outDir = path.join(root, "public");
const outPath = path.join(outDir, "intelligence-data.json");
const assetDir = path.join(outDir, "evidence-assets");

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function readText(filePath, max = 1400) {
  try {
    return fs.readFileSync(filePath, "utf8").replace(/\s+/g, " ").trim().slice(0, max);
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

function readJsonl(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function dateValue(item) {
  return item.collected_at || item.published || item.date || item.timestamp || "";
}

function sortDateDesc(a, b) {
  return String(dateValue(b)).localeCompare(String(dateValue(a)));
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

function pickTitle(meta) {
  return meta.title || meta.source_title || meta.url || "Untitled evidence";
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

const rawMetadataFiles = walk(dataDir, (filePath, name) => {
  return name.endsWith(".json") && !name.endsWith(".analysis.json") && !name.startsWith("_");
});

const rawEvidence = rawMetadataFiles.map((filePath) => {
  const meta = readJson(filePath, {});
  const topic = path.basename(path.dirname(path.dirname(filePath)));
  const localTextPath = meta.text_path
    ? path.resolve(dataDir, String(meta.text_path).replace(/^data\//, ""))
    : filePath.replace(/\.json$/, ".txt");
  const snippet = readText(localTextPath);
  const rawPath = meta.raw_path
    ? path.resolve(dataDir, String(meta.raw_path).replace(/^data\//, ""))
    : "";
  return {
    id: meta.sha256 || path.basename(filePath, ".json"),
    topic,
    title: pickTitle(meta),
    url: meta.url || "",
    host: sourceHost(meta.url || ""),
    source: meta.source || "",
    data_type: meta.data_type || "unknown",
    format: classifyFormat(meta.data_type, meta.content_type, meta.url),
    content_type: meta.content_type || "",
    collected_at: meta.collected_at || "",
    published: meta.published || "",
    text_chars: Number(meta.text_chars || snippet.length || 0),
    raw_path: meta.raw_path || "",
    raw_file_path: rawPath,
    text_path: meta.text_path || "",
    snippet
  };
}).sort(sortDateDesc);

fs.mkdirSync(assetDir, { recursive: true });
for (const asset of fs.readdirSync(assetDir)) {
  fs.rmSync(path.join(assetDir, asset), { force: true });
}

let copiedImages = 0;
for (const item of rawEvidence) {
  if (item.format !== "Image" || !item.raw_file_path || copiedImages >= 18) continue;
  if (!fs.existsSync(item.raw_file_path)) continue;
  const ext = path.extname(item.raw_file_path) || ".jpg";
  const assetName = `${item.id}${ext}`;
  fs.copyFileSync(item.raw_file_path, path.join(assetDir, assetName));
  item.preview_asset = `/evidence-assets/${assetName}`;
  copiedImages += 1;
}

const documents = readJsonl(path.join(analysisDir, "documents.jsonl"));
const claims = readJsonl(path.join(analysisDir, "claims.jsonl"));
const entities = readJsonl(path.join(analysisDir, "entities.jsonl"));
const events = readJsonl(path.join(analysisDir, "events.jsonl"));
const metrics = readJsonl(path.join(analysisDir, "metrics.jsonl"));
const relationships = readJsonl(path.join(analysisDir, "relationships.jsonl"));
const topicCards = readJson(path.join(analysisDir, "topic_cards.json"), []);
const summary = readJson(path.join(analysisDir, "summary.json"), {});

const analyzedByUrl = new Map(documents.map((doc) => [doc.source_url || doc.url, doc]));
const enrichedEvidence = rawEvidence.map((item) => {
  const analysis = analyzedByUrl.get(item.url);
  return {
    ...item,
    raw_file_path: undefined,
    summary: analysis?.summary || item.snippet.slice(0, 280),
    why_it_matters: analysis?.why_it_matters || "",
    key_takeaways: Array.isArray(analysis?.key_takeaways) ? analysis.key_takeaways.slice(0, 4) : []
  };
});

const signalRules = [
  ["Iran War Corridor", ["iran", "israel", "hormuz", "gulf", "tehran", "uae"]],
  ["Ukraine and NATO", ["ukraine", "russia", "nato", "putin", "moscow"]],
  ["Sanctions Architecture", ["sanction", "ofac", "sdn", "treasury", "security council"]],
  ["Nuclear Risk", ["nuclear", "iaea", "reactor", "enrichment"]],
  ["Legal Order", ["court", "rome statute", "geneva", "charter", "tribunal", "icrc"]],
  ["Military Capability", ["missile", "defense", "military", "drone", "armed", "air war"]],
  ["Humanitarian Strain", ["refugee", "humanitarian", "displacement", "children", "gaza"]],
  ["Geospatial Evidence", ["boundary", "disputed", "map", "naturalearth", "geospatial"]]
];

const signals = signalRules.map(([name, terms]) => {
  const matches = enrichedEvidence.filter((item) => {
    const text = `${item.title} ${item.summary} ${item.url} ${item.snippet}`.toLowerCase();
    return terms.some((term) => text.includes(term));
  });
  return {
    name,
    count: matches.length,
    formats: countBy(matches, (item) => item.format).slice(0, 5),
    latest: matches.slice(0, 5).map((item) => ({
      title: item.title,
      url: item.url,
      format: item.format,
      collected_at: item.collected_at,
      summary: item.summary
    }))
  };
}).filter((signal) => signal.count > 0).sort((a, b) => b.count - a.count);

const entityCounts = countBy(entities, (item) => item.name || item.entity || item.text || item.label).slice(0, 24);
const sourceCounts = countBy(enrichedEvidence, (item) => item.host).slice(0, 16);
const formatCounts = countBy(enrichedEvidence, (item) => item.format);
const typeCounts = countBy(enrichedEvidence, (item) => item.data_type);
const latestEvidence = enrichedEvidence.slice(0, 42);
const premiumEvidence = [...enrichedEvidence].sort((a, b) => b.text_chars - a.text_chars).slice(0, 18);
const latestEvidenceTimestamp = enrichedEvidence
  .map((item) => dateValue(item))
  .filter(Boolean)
  .sort((a, b) => String(b).localeCompare(String(a)))[0] || "";

const intelligence = {
  generated_at: latestEvidenceTimestamp,
  data_source: "knirantar/Project-India-Data/data",
  analysis_source: "analysis_output",
  summary: {
    raw_documents: rawEvidence.length,
    analyzed_documents: documents.length,
    claims: claims.length,
    entities: entities.length,
    events: events.length,
    metrics: metrics.length,
    relationships: relationships.length,
    topics: topicCards.length || Object.keys(summary.topics || {}).length,
    total_text_chars: rawEvidence.reduce((sum, item) => sum + item.text_chars, 0)
  },
  topic_cards: topicCards,
  format_counts: formatCounts,
  data_type_counts: typeCounts,
  source_counts: sourceCounts,
  entity_counts: entityCounts,
  signals,
  latest_evidence: latestEvidence,
  premium_evidence: premiumEvidence,
  visual_evidence: enrichedEvidence.filter((item) => item.preview_asset).slice(0, 18),
  claims: claims.slice(0, 36),
  events: events.slice(0, 36),
  metrics: metrics.slice(0, 24)
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(intelligence, null, 2));
console.log(`wrote ${path.relative(root, outPath)} from ${rawEvidence.length} raw documents`);
