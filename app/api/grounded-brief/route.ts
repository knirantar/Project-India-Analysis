import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

type Evidence = {
  id: string;
  title: string;
  url: string;
  host: string;
  summary: string;
  full_text: string;
};

function loadEvidence(id: string): Evidence | null {
  const safeId = String(id || "").replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safeId) return null;
  const filePath = path.join(process.cwd(), "public", "evidence", `${safeId}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function fallbackAnswer(question: string, evidence: Evidence[]) {
  const lines = evidence.map((item, index) => {
    const text = item.full_text.replace(/\s+/g, " ").slice(0, 900);
    return `${index + 1}. ${item.title}\nSource: ${item.url}\nGrounded extract: ${text}`;
  });
  return [
    "OPENAI_API_KEY is not configured for this deployment, so no AI answer was generated.",
    "Below are gathered-source extracts you can inspect directly.",
    `Question: ${question}`,
    ...lines
  ].join("\n\n");
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const ids = Array.isArray(body.evidence_ids) ? body.evidence_ids.slice(0, 5) : [];
  const question = typeof body.question === "string" && body.question.trim()
    ? body.question.trim().slice(0, 800)
    : "Explain what this gathered evidence supports.";
  const evidence = ids.map(loadEvidence).filter(Boolean) as Evidence[];

  if (!evidence.length) {
    return NextResponse.json({ error: "No gathered evidence was found for the selected ids." }, { status: 400 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ answer: fallbackAnswer(question, evidence), grounded: true, model: "none" });
  }

  const context = evidence.map((item, index) => {
    return [
      `SOURCE ${index + 1}`,
      `id: ${item.id}`,
      `title: ${item.title}`,
      `url: ${item.url}`,
      `host: ${item.host}`,
      `summary/extract: ${item.summary}`,
      `full_text_excerpt: ${item.full_text.replace(/\s+/g, " ").slice(0, 12000)}`
    ].join("\n");
  }).join("\n\n---\n\n");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0,
      messages: [
        {
          role: "system",
          content: "You are a grounded analyst. Answer only from the provided gathered source text. If the text does not support an answer, say what is missing. Cite sources by SOURCE number and title. Do not add outside facts."
        },
        {
          role: "user",
          content: `Question: ${question}\n\nGathered source text:\n${context}`
        }
      ]
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    return NextResponse.json({ error: `OpenAI request failed: ${detail.slice(0, 500)}` }, { status: 502 });
  }

  const payload = await response.json();
  const answer = payload.choices?.[0]?.message?.content || "No grounded answer returned.";
  return NextResponse.json({ answer, grounded: true, model: process.env.OPENAI_MODEL || "gpt-4o-mini" });
}
