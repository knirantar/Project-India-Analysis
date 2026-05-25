import fs from "node:fs";
import path from "node:path";
import Link from "next/link";

type Count = { name: string; value: number };
type Evidence = {
  id: string;
  title: string;
  url: string;
  host: string;
  format: string;
  data_type: string;
  collected_at: string;
  published: string;
  text_chars: number;
  summary: string;
  bullets?: string[];
  preview_asset?: string;
  file_asset?: string;
  detail_path: string;
  signals: string[];
  regions: string[];
  keywords: Count[];
};
type Judgment = { title: string; finding: string; citations?: string[] };
type WatchItem = { label: string; why_it_matters: string; citations?: string[] };
type RegionRead = { region: string; assessment: string; citations?: string[] };
type Signal = {
  name: string;
  count: number;
  formats: Count[];
  latest: Pick<Evidence, "id" | "title" | "url" | "host" | "format" | "summary" | "collected_at" | "published">[];
};
type Timeline = { date: string; evidence_id: string; title: string; url: string; excerpt: string };
type Intelligence = {
  generated_at: string;
  mode: string;
  briefing: {
    method: string;
    headline: string;
    executive_summary: string[];
    key_judgments: Judgment[];
    regional_read: RegionRead[];
    watchlist: WatchItem[];
    caveats: string[];
  };
  summary: Record<string, number>;
  format_counts: Count[];
  source_counts: Count[];
  keyword_counts: Count[];
  signals: Signal[];
  regions: { name: string; count: number; evidence_ids: string[]; top_sources?: Count[] }[];
  timeline: Timeline[];
  latest_evidence: Evidence[];
  deep_reads: Evidence[];
  documents: Evidence[];
  visual_evidence: Evidence[];
  cited_evidence: Evidence[];
  evidence: Evidence[];
};

function loadData(): Intelligence {
  const dataPath = path.join(process.cwd(), "public", "intelligence-data.json");
  return JSON.parse(fs.readFileSync(dataPath, "utf8"));
}

function compactNumber(value: number) {
  return Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value || 0);
}

function longNumber(value: number) {
  return Intl.NumberFormat("en").format(value || 0);
}

function shortDate(value: string) {
  if (!value) return "undated";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value.replace(/\s\+0000$/, "");
  return new Intl.DateTimeFormat("en", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(parsed);
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function citationLinks(ids: string[] | undefined, evidence: Map<string, Evidence>) {
  return (ids || []).map((id) => evidence.get(id)).filter(Boolean) as Evidence[];
}

function Meter({ value, max }: { value: number; max: number }) {
  const width = max > 0 ? Math.max(3, Math.round((value / max) * 100)) : 0;
  return <span className="meter"><span style={{ width: `${width}%` }} /></span>;
}

function EvidenceLink({ item, quiet = false }: { item: Evidence; quiet?: boolean }) {
  return (
    <Link href={`/evidence/${item.id}`} className={quiet ? "source-citation quiet" : "source-citation"}>
      <span>{item.format} / {item.host}</span>
      <strong>{item.title}</strong>
    </Link>
  );
}

function EvidenceCard({ item, index, dense = false }: { item: Evidence; index: number; dense?: boolean }) {
  return (
    <article className={`evidence-card ${dense ? "dense-card" : ""}`}>
      <div className="evidence-topline">
        <span className={`format-pill format-${item.format.toLowerCase()}`}>{item.format}</span>
        <span>{shortDate(item.published || item.collected_at)}</span>
      </div>
      <Link href={`/evidence/${item.id}`} className="card-link">
        <h3>{item.title}</h3>
      </Link>
      <p>{item.summary}</p>
      <div className="chip-row">
        {item.signals.slice(0, 2).map((signal) => <span key={signal}>{signal}</span>)}
        {item.regions.slice(0, 1).map((region) => <span key={region}>{region}</span>)}
      </div>
      <div className="evidence-footer">
        <a href={item.url} target="_blank" rel="noreferrer">{item.host}</a>
        <span>{compactNumber(item.text_chars)} chars</span>
        <span>{String(index + 1).padStart(2, "0")}</span>
      </div>
    </article>
  );
}

function cleanBriefLine(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export default function Home() {
  const data = loadData();
  const evidenceById = new Map(data.evidence.map((item) => [item.id, item]));
  const maxFormat = Math.max(...data.format_counts.map((item) => item.value), 1);
  const maxSource = Math.max(...data.source_counts.map((item) => item.value), 1);
  const maxSignal = Math.max(...data.signals.map((item) => item.count), 1);
  const latest = data.latest_evidence.slice(0, 9);
  const documents = data.documents.slice(0, 10);
  const timeline = data.latest_evidence.slice(0, 16).map((item) => ({
    date: item.published || item.collected_at,
    evidence_id: item.id,
    title: item.title,
    url: item.url,
    excerpt: item.summary
  }));
  const leadImage = data.visual_evidence[0];

  return (
    <main>
      <nav className="topbar">
        <Link href="/" className="brand">Project India</Link>
        <div>
          <a href="#briefing">Briefing</a>
          <a href="#signals">Signals</a>
          <a href="#library">Library</a>
          <a href="#timeline">Timeline</a>
        </div>
      </nav>

      <section className="executive-hero">
        <div className="hero-copy">
          <span className="eyebrow">Global Geopolitics Monitor</span>
          <h1>Project India Geopolitics Desk</h1>
          <p>{data.briefing.headline || "A grounded monitoring desk built from collected geopolitical evidence."}</p>
          <div className="hero-actions">
            <a href="#briefing">Read briefing</a>
            {data.cited_evidence[0] && <Link href={`/evidence/${data.cited_evidence[0].id}`}>Open lead source</Link>}
          </div>
        </div>
        <div className="hero-ledger">
          <div><span>Documents</span><strong>{longNumber(data.summary.raw_documents)}</strong></div>
          <div><span>Extracted text</span><strong>{compactNumber(data.summary.total_text_chars)}</strong></div>
          <div><span>PDFs copied</span><strong>{longNumber(data.summary.renderable_files || 0)}</strong></div>
          <div><span>AI layer</span><strong>{data.briefing.method.startsWith("openai:") ? "On" : "Extractive"}</strong></div>
        </div>
      </section>

      <section className="briefing-section" id="briefing">
        <div className="briefing-main">
          <div className="section-heading">
            <span>Grounded Executive Read</span>
            <h2>Briefing</h2>
          </div>
          <div className="brief-copy">
            {data.briefing.executive_summary.map((paragraph, index) => (
              <p key={index}>
                <strong>{String(index + 1).padStart(2, "0")}</strong>
                {cleanBriefLine(paragraph)}
              </p>
            ))}
          </div>
        </div>
        <aside className="method-card">
          <span>Method</span>
          <strong>{data.briefing.method.startsWith("openai:") ? "OpenAI grounded synthesis" : "Deterministic extractive synthesis"}</strong>
          <p>Every summary is generated from collected text and linked back to local evidence pages. Unsupported claims are not filled in.</p>
        </aside>
      </section>

      <section className="judgment-grid">
        {data.briefing.key_judgments.slice(0, 6).map((judgment, index) => {
          const citations = citationLinks(judgment.citations, evidenceById);
          return (
            <article className="judgment-card" key={`${judgment.title}-${index}`}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{judgment.title}</h3>
              <p>{judgment.finding}</p>
              <div className="citation-strip">
                {citations.slice(0, 3).map((item) => <EvidenceLink item={item} key={item.id} quiet />)}
              </div>
            </article>
          );
        })}
      </section>

      <section className="intelligence-layout">
        <aside className="rail" id="sources">
          <div className="rail-card">
            <h2>Source Mix</h2>
            {data.format_counts.map((item) => (
              <div className="rank-row" key={item.name}>
                <span>{item.name}</span>
                <Meter value={item.value} max={maxFormat} />
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
          <div className="rail-card">
            <h2>Collection Mesh</h2>
            {data.source_counts.slice(0, 12).map((item) => (
              <div className="rank-row source-row" key={item.name}>
                <span>{item.name}</span>
                <Meter value={item.value} max={maxSource} />
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </aside>

        <section className="center-stack">
          <div className="section-heading" id="signals">
            <span>Operational Patterns</span>
            <h2>Signal Board</h2>
          </div>
          <div className="signal-board">
            {data.signals.slice(0, 8).map((signal) => (
              <article className="signal-card" id={slug(signal.name)} key={signal.name}>
                <div className="signal-head">
                  <div>
                    <span>{signal.count} records</span>
                    <h3>{signal.name}</h3>
                  </div>
                  <Meter value={signal.count} max={maxSignal} />
                </div>
                <p>{signal.latest[0]?.summary || "Collected evidence is present, but the clean text is limited."}</p>
                <div className="signal-links">
                  {signal.latest.slice(0, 3).map((item) => (
                    <Link href={`/evidence/${item.id}`} key={item.id}>{item.title}</Link>
                  ))}
                </div>
              </article>
            ))}
          </div>

          <div className="section-heading" id="library">
            <span>Primary Documents and Long Reads</span>
            <h2>Briefing Library</h2>
          </div>
          <div className="document-list">
            {documents.map((item) => (
              <article key={`${item.id}-document`}>
                <div>
                  <span className={`format-pill format-${item.format.toLowerCase()}`}>{item.format}</span>
                  <h3><Link href={`/evidence/${item.id}`}>{item.title}</Link></h3>
                  <p>{item.summary}</p>
                </div>
                <div className="doc-actions">
                  <Link href={`/evidence/${item.id}`}>Read text</Link>
                  {item.file_asset && <a href={item.file_asset} target="_blank" rel="noreferrer">Open PDF</a>}
                  <a href={item.url} target="_blank" rel="noreferrer">Original</a>
                </div>
              </article>
            ))}
          </div>
        </section>

        <aside className="rail">
          <div className="brief-card">
            <h2>Watchlist</h2>
            <div className="watch-list">
              {data.briefing.watchlist.slice(0, 5).map((item, index) => (
                <div key={`${item.label}-${index}`}>
                  <strong>{item.label}</strong>
                  <p>{item.why_it_matters}</p>
                  <div>
                    {citationLinks(item.citations, evidenceById).slice(0, 2).map((evidence) => (
                      <Link href={`/evidence/${evidence.id}`} key={evidence.id}>{evidence.host}</Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="brief-card">
            <h2>Region Read</h2>
            <div className="region-read">
              {data.briefing.regional_read.slice(0, 6).map((item, index) => (
                <div key={`${item.region}-${index}`}>
                  <strong>{item.region}</strong>
                  <p>{item.assessment}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="brief-card">
            <h2>Keywords</h2>
            <div className="entity-cloud">
              {data.keyword_counts.slice(0, 28).map((keyword) => <span key={keyword.name}>{keyword.name}</span>)}
            </div>
          </div>
          <div className="brief-card">
            <h2>Coverage</h2>
            <div className="region-read">
              <div><strong>{longNumber(data.summary.raw_documents)}</strong><p>Evidence records in the current local bundle.</p></div>
              <div><strong>{compactNumber(data.summary.total_text_chars)}</strong><p>Extracted characters available for summaries and source pages.</p></div>
              <div><strong>{longNumber(data.summary.sources)}</strong><p>Distinct hosts represented in the collection.</p></div>
            </div>
          </div>
        </aside>
      </section>

      {leadImage && (
        <section className="visual-section">
          <div className="section-heading">
            <span>Visual Intake</span>
            <h2>Image Evidence</h2>
          </div>
          <div className="visual-story">
            <Link href={`/evidence/${leadImage.id}`} className="lead-visual">
              <img src={leadImage.preview_asset} alt={leadImage.title} />
              <div><span>{leadImage.host}</span><strong>{leadImage.title}</strong></div>
            </Link>
            <div className="visual-stack">
              {data.visual_evidence.slice(1, 5).map((item) => (
                <Link href={`/evidence/${item.id}`} key={item.id}>
                  <img src={item.preview_asset} alt={item.title} />
                  <span>{item.title}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="latest-section">
        <div className="section-heading">
          <span>Fresh Evidence Queue</span>
          <h2>Latest Collected</h2>
        </div>
        <div className="evidence-grid">
          {latest.map((item, index) => <EvidenceCard key={`${item.id}-${item.url}`} item={item} index={index} />)}
        </div>
      </section>

      <section className="timeline-section" id="timeline">
        <div className="section-heading">
          <span>Newest Published or Collected Items</span>
          <h2>Collection Timeline</h2>
        </div>
        <div className="timeline-list">
          {timeline.map((event, index) => (
            <article key={`${event.evidence_id}-${event.date}-${index}`}>
              <span>{shortDate(event.date)}</span>
              <p>{event.excerpt}</p>
              <Link href={`/evidence/${event.evidence_id}`}>{event.title}</Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
