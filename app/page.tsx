import fs from "node:fs";
import path from "node:path";

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
  preview_asset?: string;
  why_it_matters?: string;
  key_takeaways?: string[];
};
type Signal = {
  name: string;
  count: number;
  formats: Count[];
  latest: Pick<Evidence, "title" | "url" | "format" | "summary" | "collected_at">[];
};
type Intelligence = {
  generated_at: string;
  summary: Record<string, number>;
  format_counts: Count[];
  data_type_counts: Count[];
  source_counts: Count[];
  entity_counts: Count[];
  signals: Signal[];
  latest_evidence: Evidence[];
  premium_evidence: Evidence[];
  visual_evidence: Evidence[];
  claims: Record<string, unknown>[];
  events: Record<string, unknown>[];
  metrics: Record<string, unknown>[];
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

function textFrom(item: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

function Meter({ value, max }: { value: number; max: number }) {
  const width = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
  return (
    <span className="meter">
      <span style={{ width: `${width}%` }} />
    </span>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong style={accent ? { color: accent } : undefined}>{value}</strong>
    </div>
  );
}

function EvidenceCard({ item, index }: { item: Evidence; index: number }) {
  return (
    <article className="evidence-card">
      <div className="evidence-topline">
        <span className={`format-pill format-${item.format.toLowerCase()}`}>{item.format}</span>
        <span>{shortDate(item.collected_at || item.published)}</span>
      </div>
      <h3>{item.title}</h3>
      <p>{item.summary}</p>
      <div className="evidence-footer">
        <span>{sourceLabel(item.url, item.host)}</span>
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
  const premium = data.premium_evidence.slice(0, 9);
  const visuals = data.visual_evidence.slice(0, 9);
  const claims = data.claims.slice(0, 8);
  const events = data.events.slice(0, 8);

  return (
    <main>
      <section className="hero-shell">
        <div className="hero-grid">
          <div className="command-panel">
            <div className="eyebrow">Project India Intelligence</div>
            <h1>Global Geopolitics Monitor</h1>
            <p>
              Evidence-first operational surface for articles, PDFs, books, sanctions records, datasets,
              maps, audio, video, and image-bearing sources.
            </p>
            <div className="hero-stats">
              <Stat label="Raw evidence" value={compactNumber(data.summary.raw_documents)} accent="#9ee7ff" />
              <Stat label="Analyzed docs" value={compactNumber(data.summary.analyzed_documents)} accent="#d8ff7a" />
              <Stat label="Evidence text" value={compactNumber(data.summary.total_text_chars)} accent="#ffcc66" />
              <Stat label="Signals" value={String(data.signals.length)} accent="#f7a8ff" />
            </div>
          </div>
          <div className="radar-panel" aria-label="Signal radar">
            <div className="orbital-map">
              {data.signals.slice(0, 8).map((signal, index) => (
                <span
                  key={signal.name}
                  className="orbit-dot"
                  style={{
                    "--angle": `${index * 43}deg`,
                    "--radius": `${82 + (index % 3) * 27}px`,
                    "--size": `${10 + Math.min(18, signal.count / 2)}px`
                  } as React.CSSProperties}
                  title={`${signal.name}: ${signal.count}`}
                />
              ))}
              <div className="radar-core">
                <strong>{primarySignal?.name || "Monitoring"}</strong>
                <span>{primarySignal ? `${primarySignal.count} linked records` : "waiting for signal"}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="workbench">
        <aside className="left-rail">
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
            {data.source_counts.slice(0, 10).map((item) => (
              <div className="rank-row source-row" key={item.name}>
                <span>{item.name}</span>
                <Meter value={item.value} max={maxSource} />
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </aside>

        <section className="center-stack">
          <div className="section-heading">
            <span>Live Intelligence</span>
            <h2>Signal Board</h2>
          </div>
          <div className="signal-grid">
            {data.signals.slice(0, 8).map((signal) => (
              <article className="signal-card" key={signal.name}>
                <div>
                  <span>{signal.count} records</span>
                  <h3>{signal.name}</h3>
                </div>
                <div className="signal-formats">
                  {signal.formats.slice(0, 3).map((format) => (
                    <em key={format.name}>{format.name}</em>
                  ))}
                </div>
                <p>{signal.latest[0]?.title || "No recent source title"}</p>
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
                  <article className="visual-card" key={`${item.id}-visual`}>
                    <img src={item.preview_asset} alt={item.title} />
                    <div>
                      <span>{item.host}</span>
                      <strong>{item.title}</strong>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}

          <div className="section-heading">
            <span>Consumption Queue</span>
            <h2>Latest Evidence</h2>
          </div>
          <div className="evidence-grid">
            {latest.map((item, index) => (
              <EvidenceCard key={`${item.id}-${item.url}`} item={item} index={index} />
            ))}
          </div>
        </section>

        <aside className="right-rail">
          <div className="brief-card">
            <h2>Analyst Brief</h2>
            {claims.map((claim, index) => (
              <p key={index}>{textFrom(claim, ["claim_text", "claim", "text", "summary", "description"])}</p>
            ))}
          </div>
          <div className="brief-card">
            <h2>Actors</h2>
            <div className="entity-cloud">
              {data.entity_counts.slice(0, 18).map((entity) => (
                <span key={entity.name}>{entity.name}</span>
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
          {premium.map((item, index) => (
            <EvidenceCard key={`${item.id}-${item.url}-premium`} item={item} index={index} />
          ))}
        </div>
      </section>

      <section className="timeline-section">
        <div className="section-heading">
          <span>Sequenced Context</span>
          <h2>Events and Movement</h2>
        </div>
        <div className="timeline-list">
          {events.map((event, index) => (
            <article key={index}>
              <span>{textFrom(event, ["date", "timestamp", "published"]) || `event ${index + 1}`}</span>
              <p>{textFrom(event, ["event", "milestone", "title", "description", "summary"])}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
