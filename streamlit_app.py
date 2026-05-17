from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pandas as pd
import streamlit as st


ROOT = Path(__file__).resolve().parent
OUTPUT_DIR = ROOT / "analysis_output"


def load_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def load_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        try:
            rows.append(json.loads(line))
        except Exception:
            continue
    return rows


def topic_rows(name: str, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [row for row in rows if row.get("topic") == name]


def text_from(row: dict[str, Any], *keys: str) -> str:
    for key in keys:
        value = row.get(key)
        if value is None:
            continue
        if isinstance(value, (dict, list)):
            value = json.dumps(value, ensure_ascii=False)
        value = str(value).strip()
        if value and value.lower() != "none":
            return value
    return ""


def page_style() -> None:
    st.markdown(
        """
        <style>
        .stApp {
            background: #f7f8fb;
            color: #18202f;
        }
        [data-testid="stSidebar"] {
            background: #ffffff;
            border-right: 1px solid #e6e9ef;
        }
        h1, h2, h3 {
            letter-spacing: 0;
        }
        .hero {
            padding: 28px 0 16px 0;
            border-bottom: 1px solid #e5e8ee;
            margin-bottom: 18px;
        }
        .muted {
            color: #667085;
            font-size: 0.95rem;
        }
        .metric-band {
            border: 1px solid #e3e7ef;
            border-radius: 8px;
            background: #ffffff;
            padding: 14px 16px;
            min-height: 94px;
        }
        .metric-value {
            font-size: 1.8rem;
            font-weight: 700;
            color: #172033;
        }
        .metric-label {
            color: #667085;
            font-size: 0.85rem;
        }
        .source-row {
            border: 1px solid #e3e7ef;
            border-radius: 8px;
            background: #ffffff;
            padding: 12px 14px;
            margin-bottom: 10px;
        }
        .pill {
            display: inline-block;
            border: 1px solid #d4dbe8;
            border-radius: 999px;
            padding: 2px 8px;
            margin-right: 6px;
            color: #46546a;
            font-size: 0.78rem;
            background: #f9fafc;
        }
        </style>
        """,
        unsafe_allow_html=True,
    )


def metric_box(label: str, value: Any) -> None:
    st.markdown(
        f"""
        <div class="metric-band">
          <div class="metric-value">{value}</div>
          <div class="metric-label">{label}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def source_card(row: dict[str, Any]) -> None:
    title = text_from(row, "source_title", "title", "source_url") or "Untitled source"
    url = text_from(row, "source_url")
    summary = text_from(row, "summary")
    data_type = text_from(row, "data_type") or "source"
    text_chars = row.get("text_chars") or ""
    collected_at = text_from(row, "collected_at")

    st.markdown('<div class="source-row">', unsafe_allow_html=True)
    if url:
        st.markdown(f"**[{title}]({url})**")
    else:
        st.markdown(f"**{title}**")
    st.markdown(
        f'<span class="pill">{data_type}</span><span class="pill">{text_chars} chars</span><span class="pill">{collected_at[:10]}</span>',
        unsafe_allow_html=True,
    )
    if summary:
        st.caption(summary)
    st.markdown("</div>", unsafe_allow_html=True)


def main() -> None:
    st.set_page_config(page_title="Project India Analysis", page_icon="PI", layout="wide")
    page_style()

    summary = load_json(OUTPUT_DIR / "summary.json", {})
    cards = load_json(OUTPUT_DIR / "topic_cards.json", summary.get("topic_cards", []))
    docs = load_jsonl(OUTPUT_DIR / "documents.jsonl")
    claims = load_jsonl(OUTPUT_DIR / "claims.jsonl")
    entities = load_jsonl(OUTPUT_DIR / "entities.jsonl")
    events = load_jsonl(OUTPUT_DIR / "events.jsonl")
    metrics = load_jsonl(OUTPUT_DIR / "metrics.jsonl")
    citations = load_jsonl(OUTPUT_DIR / "citations.jsonl")

    st.sidebar.title("Project India")
    st.sidebar.caption("Topic-wise evidence intelligence")
    if not cards:
        st.error("No analysis output found. Run `python -m project_india_analysis.cli` first.")
        return

    topic_labels = {card["title"]: card["topic"] for card in cards}
    selected_label = st.sidebar.selectbox("Topic", list(topic_labels))
    topic = topic_labels[selected_label]
    profile = load_json(OUTPUT_DIR / "topics" / f"{topic}.json", {})

    topic_docs = topic_rows(topic, docs)
    topic_claims = topic_rows(topic, claims)
    topic_entities = topic_rows(topic, entities)
    topic_events = topic_rows(topic, events)
    topic_metrics = topic_rows(topic, metrics)
    topic_citations = topic_rows(topic, citations)

    ui = profile.get("ui_profile", {})
    st.markdown(
        f"""
        <div class="hero">
          <div class="muted">Generated {summary.get("generated_at", "unknown")}</div>
          <h1>{ui.get("title", selected_label)}</h1>
          <div class="muted">{ui.get("tone", "research intelligence desk")}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    c1, c2, c3, c4 = st.columns(4)
    with c1:
        metric_box("Analyzed sources", len(topic_docs))
    with c2:
        metric_box("Claims", len(topic_claims))
    with c3:
        metric_box("Entities", len(topic_entities))
    with c4:
        metric_box("Events / metrics", f"{len(topic_events)} / {len(topic_metrics)}")

    tabs = st.tabs(["Evidence", "Claims", "Entities", "Timeline", "Sources"])

    with tabs[0]:
        left, right = st.columns([1.2, 1])
        with left:
            st.subheader("Current Brief")
            brief = profile.get("brief", [])
            if brief:
                for item in brief:
                    st.write(f"- {item}")
            else:
                st.caption("No useful summaries have been extracted yet.")
        with right:
            st.subheader("Source Mix")
            data_type_counts = profile.get("data_type_counts", {})
            if data_type_counts:
                st.bar_chart(pd.DataFrame({"count": data_type_counts}).T)
            else:
                st.caption("No source mix available.")

    with tabs[1]:
        st.subheader("Extracted Claims")
        if topic_claims:
            for row in topic_claims[:40]:
                claim = text_from(row, "claim_text", "claim", "text", "summary", "description")
                if claim:
                    st.write(f"- {claim}")
        else:
            st.caption("No claims extracted yet.")

    with tabs[2]:
        st.subheader("Entities")
        top_entities = profile.get("top_entities", [])
        if top_entities:
            df = pd.DataFrame(top_entities)
            st.dataframe(df, use_container_width=True, hide_index=True)
        elif topic_entities:
            rows = [{"entity": text_from(row, "name", "entity", "text", "label")} for row in topic_entities]
            st.dataframe(pd.DataFrame(rows), use_container_width=True, hide_index=True)
        else:
            st.caption("No entities extracted yet.")

    with tabs[3]:
        st.subheader("Timeline Signals")
        if topic_events:
            for row in topic_events:
                label = text_from(row, "event", "title", "description", "summary")
                date = text_from(row, "date", "timestamp", "time")
                st.write(f"**{date or 'undated'}** - {label}")
        else:
            st.caption("No event timeline extracted yet.")

    with tabs[4]:
        st.subheader("Sources")
        for row in topic_docs[:60]:
            source_card(row)
        if topic_citations:
            st.subheader("Citations")
            st.dataframe(pd.DataFrame(topic_citations), use_container_width=True, hide_index=True)


if __name__ == "__main__":
    main()
