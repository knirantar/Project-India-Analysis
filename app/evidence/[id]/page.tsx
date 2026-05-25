import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GroundedAsk } from "../../components/GroundedAsk";

type Count = { name: string; value: number };
type Evidence = {
  id: string;
  title: string;
  url: string;
  host: string;
  source: string;
  format: string;
  data_type: string;
  content_type: string;
  collected_at: string;
  published: string;
  text_chars: number;
  raw_path: string;
  text_path: string;
  summary: string;
  excerpt: string;
  preview_asset?: string;
  keywords: Count[];
  signals: string[];
  regions: string[];
  full_text: string;
  related: Array<Pick<Evidence, "id" | "title" | "host" | "format" | "summary">>;
};

function evidenceDir() {
  return path.join(process.cwd(), "public", "evidence");
}

function loadEvidence(id: string): Evidence | null {
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, "");
  const filePath = path.join(evidenceDir(), `${safeId}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function shortDate(value: string) {
  if (!value) return "undated";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en", { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(parsed);
}

export function generateStaticParams() {
  if (!fs.existsSync(evidenceDir())) return [];
  return fs.readdirSync(evidenceDir())
    .filter((name) => name.endsWith(".json"))
    .map((name) => ({ id: name.replace(/\.json$/, "") }));
}

export default async function EvidencePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const evidence = loadEvidence(id);
  if (!evidence) notFound();

  const paragraphs = evidence.full_text
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 80);

  return (
    <main>
      <nav className="topbar">
        <Link href="/" className="brand">Project India</Link>
        <div>
          <Link href="/#signals">Signals</Link>
          <Link href="/#evidence">Evidence</Link>
          <a href={evidence.url} target="_blank" rel="noreferrer">Original</a>
        </div>
      </nav>

      <section className="evidence-detail-hero">
        <div>
          <div className="evidence-topline">
            <span className={`format-pill format-${evidence.format.toLowerCase()}`}>{evidence.format}</span>
            <span>{shortDate(evidence.collected_at || evidence.published)}</span>
          </div>
          <h1>{evidence.title}</h1>
          <p>{evidence.summary}</p>
          <div className="detail-actions">
            <a href={evidence.url} target="_blank" rel="noreferrer">Open original source</a>
            <a href={`/evidence/${evidence.id}.json`} target="_blank" rel="noreferrer">Raw app JSON</a>
          </div>
        </div>
        <aside>
          <div><span>Source</span><strong>{evidence.host}</strong></div>
          <div><span>Data type</span><strong>{evidence.data_type}</strong></div>
          <div><span>Text length</span><strong>{Intl.NumberFormat("en").format(evidence.text_chars)} chars</strong></div>
          <div><span>Content type</span><strong>{evidence.content_type || "unknown"}</strong></div>
        </aside>
      </section>

      <section className="detail-layout">
        <article className="reader-panel">
          <div className="section-heading">
            <span>Gathered Clean Text</span>
            <h2>Full Source Text</h2>
          </div>
          {paragraphs.length ? paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>) : <p>No extracted text was available for this item.</p>}
        </article>

        <aside className="detail-rail">
          {evidence.preview_asset && (
            <div className="detail-image">
              <img src={evidence.preview_asset} alt={evidence.title} />
            </div>
          )}
          <div className="brief-card">
            <h2>Signals</h2>
            <div className="entity-cloud">
              {evidence.signals.map((signal) => <span key={signal}>{signal}</span>)}
              {evidence.regions.map((region) => <span key={region}>{region}</span>)}
            </div>
          </div>
          <div className="brief-card">
            <h2>Keywords</h2>
            <div className="entity-cloud">
              {evidence.keywords.map((keyword) => <span key={keyword.name}>{keyword.name}</span>)}
            </div>
          </div>
          <GroundedAsk evidenceId={evidence.id} />
          <div className="brief-card">
            <h2>Related Evidence</h2>
            <div className="related-list">
              {evidence.related.map((item) => (
                <Link href={`/evidence/${item.id}`} key={item.id}>
                  <span>{item.format} / {item.host}</span>
                  <strong>{item.title}</strong>
                </Link>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
