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
  excerpt: string;
  preview_asset?: string;
  detail_path: string;
  signals: string[];
  regions: string[];
  keywords: Count[];
};
type Signal = {
  name: string;
  count: number;
  formats: Count[];
  latest: Pick<Evidence, "id" | "title" | "url" | "host" | "format" | "summary" | "collected_at">[];
};
type Timeline = { date: string; evidence_id: string; title: string; url: string; excerpt: string };
type Intelligence = {
  generated_at: string;
  mode: string;
  summary: Record<string, number>;
  format_counts: Count[];
  source_counts: Count[];
  keyword_counts: Count[];
  signals: Signal[];
  regions: { name: string; count: number; evidence_ids: string[] }[];
  timeline: Timeline[];
  latest_evidence: Evidence[];
  deep_reads: Evidence[];
  visual_evidence: Evidence[];
  evidence: Evidence[];
};

function loadData(): Intelligence {
  const dataPath = path.join(process.cwd(), "public", "intelligence-data.json");
  return JSON.parse(fs.readFileSync(dataPath, "utf8"));
}

function compactNumber(value: number) {
  return Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value || 0);
}

function shortDate(value: string) {
  if (!value) return "undated";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value.replace(/\s\+0000$/, "");
  return new Intl.DateTimeFormat("en", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(parsed);
}

function sourceLabel(url: string, host: string) {
  if (host) return host;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "evidence";
  }
}

function Meter({ value, max }: { value: number; max: number }) {
  const width = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
  return (
    <span className="meter">
      <span style={{ width: `${width}%` }} />
    </span>
  );
}

function EvidenceCard({ item, index, dense = false }: { item: Evidence; index: number; dense?: boolean }) {
  return (
    <article className={`evidence-card ${dense ? "dense-card" : ""}`}>
      <div className="evidence-topline">
        <span className={`format-pill format-${item.format.toLowerCase()}`}>{item.format}</span>
        <span>{shortDate(item.collected_at || item.published)}</span>
      </div>
      <Link href={`/evidence/${item.id}`} className="card-link">
        <h3>{item.title}</h3>
      </Link>
      <p>{item.summary}</p>
      <div className="chip-row">
        {item.signals.slice(0, 2).map((signal) => (
          <span key={signal}>{signal}</span>
        ))}
      </div>
      <div className="evidence-footer">
        <a href={item.url} target="_blank" rel="noreferrer">{sourceLabel(item.url, item.host)}</a>
        <span>{compactNumber(item.text_chars)} chars</span>
        <span>#{String(index + 1).padStart(2, "0")}</span>
      </div>
    </article>
  );
}

export default function Home() {
  const data = loadData();
  const maxFormat = Math.max(...data.format_counts.map((item) => item.value), 1);
  const maxSource = Math.max(...data.source_counts.map((item) => item.value), 1);
  const primarySignal = data.signals[0];
  const latest = data.latest_evidence.slice(0, 12);
  const deepReads = data.deep_reads.slice(0, 8);
  const visuals = data.visual_evidence.slice(0, 10);
  const timeline = [...data.timeline].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 14);

  return (
    <main>
      <nav className="topbar">
        <Link href="/" className="brand">Project India</Link>
        <div>
          <a href="#signals">Signals</a>
          <a href="#evidence">Evidence</a>
          <a href="#timeline">Timeline</a>
          <a href="#sources">Sources</a>
        </div>
      </nav>

      <section className="hero-shell">
        <div className="hero-grid">
          <div className="command-panel">
            <div className="eyebrow">Raw evidence intelligence surface</div>
            <h1>Global Geopolitics Monitor</h1>
            <p>
              A live consumption desk for gathered articles, official records, datasets, maps, images,
              books, PDFs, and media references. The app reads collected evidence directly; AI is only a
              grounded assistant over selected source text.
            </p>
            <div className="hero-actions">
              <a href="#evidence">Read latest evidence</a>
              {primarySignal?.latest[0] && <Link href={`/evidence/${primarySignal.latest[0].id}`}>Open strongest signal</Link>}
            </div>
            <div className="hero-stats">
              <div><span>Raw documents</span><strong>{compactNumber(data.summary.raw_documents)}</strong></div>
              <div><span>Full text</span><strong>{compactNumber(data.summary.total_text_chars)}</strong></div>
              <div><span>Sources</span><strong>{compactNumber(data.summary.sources)}</strong></div>
              <div><span>Signals</span><strong>{String(data.summary.signals)}</strong></div>
            </div>
          </div>

          <div className="situation-panel">
            <div className="panel-kicker">Situation Map</div>
            <div className="signal-orbit">
              {data.signals.slice(0, 8).map((signal, index) => (
                <Link
                  href={`#signal-${signal.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                  key={signal.name}
                  className="orbit-node"
                  style={{
                    "--angle": `${index * 44}deg`,
                    "--radius": `${86 + (index % 3) * 30}px`,
                    "--size": `${12 + Math.min(24, signal.count / 2)}px`
                  } as React.CSSProperties}
                  title={`${signal.name}: ${signal.count}`}
                />
              ))}
              <div className="orbit-core">
                <strong>{primarySignal?.name || "Monitoring"}</strong>
                <span>{primarySignal ? `${primarySignal.count} gathered records` : "awaiting evidence"}</span>
              </div>
            </div>
            <div className="region-strip">
              {data.regions.slice(0, 6).map((region) => (
                <span key={region.name}>{region.name}<strong>{region.count}</strong></span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="desk-layout">
        <aside className="rail" id="sources">
          <div className="rail-card">
            <h2>Formats</h2>
            {data.format_counts.map((item) => (
              <div className="rank-row" key={item.name}>
                <span>{item.name}</span>
                <Meter value={item.value} max={maxFormat} />
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
          <div className="rail-card">
            <h2>Source Mesh</h2>
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
            <span>Comprehension Layer</span>
            <h2>Signal Board</h2>
          </div>
          <div className="signal-grid">
            {data.signals.slice(0, 8).map((signal) => (
              <article className="signal-card" id={`signal-${signal.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} key={signal.name}>
                <div>
                  <span>{signal.count} records</span>
                  <h3>{signal.name}</h3>
                </div>
                <p>{signal.latest[0]?.summary || "No gathered text available yet."}</p>
                <div className="signal-links">
                  {signal.latest.slice(0, 3).map((item) => (
                    <Link href={`/evidence/${item.id}`} key={item.id}>{item.title}</Link>
                  ))}
                </div>
              </article>
            ))}
          </div>

          {visuals.length > 0 && (
            <>
              <div className="section-heading compact-heading">
                <span>Visual Intake</span>
                <h2>Image Evidence</h2>
              </div>
              <div className="visual-grid">
                {visuals.map((item) => (
                  <Link href={`/evidence/${item.id}`} className="visual-card" key={`${item.id}-visual`}>
                    <img src={item.preview_asset} alt={item.title} />
                    <div>
                      <span>{item.host}</span>
                      <strong>{item.title}</strong>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}

          <div className="section-heading" id="evidence">
            <span>Readable Evidence</span>
            <h2>Latest Queue</h2>
          </div>
          <div className="evidence-grid">
            {latest.map((item, index) => (
              <EvidenceCard key={`${item.id}-${item.url}`} item={item} index={index} />
            ))}
          </div>
        </section>

        <aside className="rail">
          <div className="brief-card">
            <h2>Observer Guide</h2>
            <p>The fastest path is signal to source to full text. Every card links to its evidence page and every source URL opens externally.</p>
            <p>No normalized claims are invented here. Summaries are extracts from gathered clean text, and AI answers must cite selected evidence.</p>
          </div>
          <div className="brief-card">
            <h2>Keywords</h2>
            <div className="entity-cloud">
              {data.keyword_counts.slice(0, 24).map((keyword) => (
                <span key={keyword.name}>{keyword.name}</span>
              ))}
            </div>
          </div>
        </aside>
      </section>

      <section className="deep-section">
        <div className="section-heading">
          <span>High Bandwidth Sources</span>
          <h2>Long-Form and Primary Evidence</h2>
        </div>
        <div className="premium-grid">
          {deepReads.map((item, index) => (
            <EvidenceCard key={`${item.id}-${item.url}-premium`} item={item} index={index} dense />
          ))}
        </div>
      </section>

      <section className="timeline-section" id="timeline">
        <div className="section-heading">
          <span>Chronology extracted from gathered text</span>
          <h2>Timeline</h2>
        </div>
        <div className="timeline-list">
          {timeline.map((event, index) => (
            <article key={`${event.evidence_id}-${event.date}-${index}`}>
              <span>{event.date}</span>
              <p>{event.excerpt}</p>
              <Link href={`/evidence/${event.evidence_id}`}>{event.title}</Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
