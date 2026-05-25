"use client";

import { FormEvent, useState } from "react";

export function GroundedAsk({ evidenceId }: { evidenceId: string }) {
  const [question, setQuestion] = useState("What should a third-party observer understand from this source?");
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setAnswer("");
    try {
      const response = await fetch("/api/grounded-brief", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ evidence_ids: [evidenceId], question })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Request failed");
      setAnswer(payload.answer || "");
      setStatus("idle");
    } catch (error) {
      setAnswer(error instanceof Error ? error.message : "Unable to produce grounded answer.");
      setStatus("error");
    }
  }

  return (
    <form className="ask-panel" onSubmit={submit}>
      <label htmlFor="grounded-question">Grounded AI brief</label>
      <textarea
        id="grounded-question"
        value={question}
        onChange={(event) => setQuestion(event.target.value)}
        rows={3}
      />
      <button type="submit" disabled={status === "loading"}>
        {status === "loading" ? "Reading gathered text..." : "Ask from this source"}
      </button>
      {answer && <pre className={status === "error" ? "answer error-answer" : "answer"}>{answer}</pre>}
    </form>
  );
}
