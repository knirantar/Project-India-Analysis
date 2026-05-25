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
  file_asset?: string;
  summary: string;
  bullets?: string[];
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

function compactNumber(value: number) {
  return Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value || 0);
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

  const bullets = evidence.bullets?.length ? evidence.bullets : [evidence.summary];

  return (
    <main>
      <nav className="topbar">
        <Link href="/" className="brand">Project India</Link>
        <div>
          <Link href="/#briefing">Briefing</Link>
          <Link href="/#library">Library</Link>
          <a href={evidence.url} target="_blank" rel="noreferrer">Original</a>
        </div>
      </nav>

      <section className="source-hero">
        <div className="source-title">
          <div className="evidence-topline">
            <span className={`format-pill format-${evidence.format.toLowerCase()}`}>{evidence.format}</span>
            <span>{shortDate(evidence.published || evidence.collected_at)}</span>
          </div>
          <h1>{evidence.title}</h1>
          <p>{evidence.summary}</p>
          <div className="detail-actions">
            <a href={evidence.url} target="_blank" rel="noreferrer">Open original</a>
            {evidence.file_asset && <a href={evidence.file_asset} target="_blank" rel="noreferrer">Open local PDF</a>}
            <a href={`/evidence/${evidence.id}.json`} target="_blank" rel="noreferrer">Source JSON</a>
          </div>
        </div>
        <aside className="source-dossier">
          <div><span>Source</span><strong>{evidence.host}</strong></div>
          <div><span>Format</span><strong>{evidence.format}</strong></div>
          <div><span>Extracted Text</span><strong>{compactNumber(evidence.text_chars)} chars</strong></div>
          <div><span>Content Type</span><strong>{evidence.content_type || "unknown"}</strong></div>
        </aside>
      </section>

      <section className="source-layout">
        <article className="reader-panel">
          <div className="section-heading">
            <span>Grounded Source Digest</span>
            <h2>Useful Read</h2>
          </div>
          <div className="digest-list">
            {bullets.map((bullet, index) => (
              <p key={index}><strong>{String(index + 1).padStart(2, "0")}</strong>{bullet}</p>
            ))}
          </div>

          {evidence.file_asset && (
            <div className="pdf-frame">
              <div>
                <span>PDF Preview</span>
                <a href={evidence.file_asset} target="_blank" rel="noreferrer">Open in new tab</a>
              </div>
              <object data={evidence.file_asset} type="application/pdf">
                <p>PDF preview is unavailable in this browser. Use the open link above.</p>
              </object>
            </div>
          )}

          <details className="raw-text-block">
            <summary>Gathered clean text</summary>
            {paragraphs.length ? paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>) : <p>No extracted text was available for this item.</p>}
          </details>
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
