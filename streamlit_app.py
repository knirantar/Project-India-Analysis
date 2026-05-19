from __future__ import annotations

import json
import re
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


def date_sort_key(value: str) -> tuple[int, str]:
    if not value or value.lower() in {"none", "unknown", "undated"}:
        return (99999999, "")
    match = re.search(r"(\d{4})(?:[-/](\d{1,2}))?(?:[-/](\d{1,2}))?", value)
    if not match:
        return (99999999, value.lower())
    year = int(match.group(1))
    month = int(match.group(2) or 1)
    day = int(match.group(3) or 1)
    return (year * 10000 + month * 100 + day, value.lower())


def row_date(row: dict[str, Any]) -> str:
    return text_from(row, "date", "published", "collected_at", "timestamp", "time")


def page_style() -> None:
    st.markdown(
        """
        <style>
        .stApp { background: #f5f7fb; color: #172033; }
        [data-testid="stSidebar"] { background: #ffffff; border-right: 1px solid #dde3ee; }
        h1, h2, h3 { letter-spacing: 0; }
        div[data-testid="stMetric"] {
            background: #ffffff;
            border: 1px solid #dde3ee;
            border-radius: 8px;
            padding: 12px 14px;
        }
        .hero {
            padding: 24px 0 18px 0;
            border-bottom: 1px solid #dde3ee;
            margin-bottom: 18px;
        }
        .kicker { color: #596579; font-size: 0.9rem; font-weight: 600; }
        .subtitle { color: #596579; font-size: 1rem; max-width: 920px; }
        .panel {
            border: 1px solid #dde3ee;
            border-radius: 8px;
            background: #ffffff;
            padding: 14px 16px;
            margin-bottom: 12px;
        }
        .source-row {
            border: 1px solid #dde3ee;
            border-radius: 8px;
            background: #ffffff;
            padding: 12px 14px;
            margin-bottom: 10px;
        }
        .timeline-row {
            border-left: 3px solid #2f6fed;
            background: #ffffff;
            padding: 10px 14px;
            margin-bottom: 10px;
            border-radius: 0 8px 8px 0;
        }
        .pill {
            display: inline-block;
            border: 1px solid #cfd7e6;
            border-radius: 999px;
            padding: 2px 8px;
            margin-right: 6px;
            color: #46546a;
            font-size: 0.78rem;
            background: #f8fafc;
        }
        </style>
        """,
        unsafe_allow_html=True,
    )


def source_card(row: dict[str, Any]) -> None:
    title = text_from(row, "source_title", "title", "source_url") or "Untitled source"
    url = text_from(row, "source_url")
    summary = text_from(row, "summary", "why_it_matters")
    data_type = text_from(row, "data_type") or "source"
    text_chars = row.get("text_chars") or ""
    collected_at = text_from(row, "collected_at")
    publisher = text_from(row, "publisher", "author")

    st.markdown('<div class="source-row">', unsafe_allow_html=True)
    if url:
        st.markdown(f"**[{title}]({url})**")
    else:
        st.markdown(f"**{title}**")
    chips = [data_type, f"{text_chars} chars" if text_chars else "", collected_at[:10], publisher]
    st.markdown("".join(f'<span class="pill">{chip}</span>' for chip in chips if chip), unsafe_allow_html=True)
    if summary:
        st.caption(summary)
    st.markdown("</div>", unsafe_allow_html=True)


def claim_table(rows: list[dict[str, Any]]) -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "claim": text_from(row, "claim_text", "claim", "text", "summary", "description"),
                "confidence": text_from(row, "confidence"),
                "evidence": text_from(row, "evidence_text"),
                "source": text_from(row, "source_url", "analysis_file"),
            }
            for row in rows
            if text_from(row, "claim_text", "claim", "text", "summary", "description")
        ]
    )


def main() -> None:
    st.set_page_config(page_title="Project India Global Monitor", page_icon="PI", layout="wide")
    page_style()

    summary = load_json(OUTPUT_DIR / "summary.json", {})
    cards = load_json(OUTPUT_DIR / "topic_cards.json", summary.get("topic_cards", []))
    docs = load_jsonl(OUTPUT_DIR / "documents.jsonl")
    claims = load_jsonl(OUTPUT_DIR / "claims.jsonl")
    entities = load_jsonl(OUTPUT_DIR / "entities.jsonl")
    events = load_jsonl(OUTPUT_DIR / "events.jsonl")
    metrics = load_jsonl(OUTPUT_DIR / "metrics.jsonl")
    relationships = load_jsonl(OUTPUT_DIR / "relationships.jsonl")
    timelines = load_jsonl(OUTPUT_DIR / "timelines.jsonl")
    citations = load_jsonl(OUTPUT_DIR / "citations.jsonl")

    st.sidebar.title("Project India")
    st.sidebar.caption("Global geopolitics monitor")
    if not cards:
        st.error("No analysis output found. Run `python -m project_india_analysis.cli` first.")
        return

    topic_labels = {card["title"]: card["topic"] for card in sorted(cards, key=lambda item: item.get("title", ""))}
    selected_label = st.sidebar.selectbox("Watchlist", list(topic_labels))
    topic = topic_labels[selected_label]
    profile = load_json(OUTPUT_DIR / "topics" / f"{topic}.json", {})

    topic_docs = topic_rows(topic, docs)
    topic_claims = topic_rows(topic, claims)
    topic_entities = topic_rows(topic, entities)
    topic_events = sorted(topic_rows(topic, events), key=lambda row: date_sort_key(row_date(row)))
    topic_metrics = topic_rows(topic, metrics)
    topic_relationships = topic_rows(topic, relationships)
    topic_timelines = sorted(topic_rows(topic, timelines), key=lambda row: date_sort_key(row_date(row)))
    topic_citations = topic_rows(topic, citations)

    data_types = sorted({text_from(row, "data_type") for row in topic_docs if text_from(row, "data_type")})
    selected_types = st.sidebar.multiselect("Source types", data_types, default=data_types)
    if selected_types:
        topic_docs = [row for row in topic_docs if text_from(row, "data_type") in selected_types]
    min_chars = st.sidebar.slider("Minimum text chars", 0, 10000, 0, step=250)
    if min_chars:
        topic_docs = [row for row in topic_docs if int(row.get("text_chars") or 0) >= min_chars]

    ui = profile.get("ui_profile", {})
    quality = profile.get("source_quality", {})
    st.markdown(
        f"""
        <div class="hero">
          <div class="kicker">Global monitor generated {summary.get("generated_at", "unknown")}</div>
          <h1>{ui.get("title", selected_label)}</h1>
          <div class="subtitle">{len(topic_docs)} filtered geopolitical sources from {len(data_types)} source classes. {ui.get("tone", "Situation intelligence desk")}.</div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    c1, c2, c3, c4, c5 = st.columns(5)
    c1.metric("Sources", len(topic_docs))
    c2.metric("Claims", len(topic_claims))
    c3.metric("Actors", len(topic_entities))
    c4.metric("Timeline", len(topic_events) + len(topic_timelines))
    c5.metric("Avg text chars", quality.get("average_text_chars", 0))

    tabs = st.tabs(["Situation Brief", "Timeline", "Claims", "Actors", "Signals", "Relationships", "Sources"])

    with tabs[0]:
        left, right = st.columns([1.15, 0.85])
        with left:
            st.subheader("Situation Brief")
            brief = profile.get("brief", [])
            if brief:
                for item in brief[:8]:
                    st.markdown(f'<div class="panel">{item}</div>', unsafe_allow_html=True)
            else:
                st.caption("No useful summaries have been extracted yet.")

            st.subheader("Highest Signal Claims")
            for claim in profile.get("top_claims", [])[:8]:
                st.write(f"- {claim}")
        with right:
            st.subheader("Geopolitical Source Mix")
            data_type_counts = profile.get("data_type_counts", {})
            if data_type_counts:
                st.bar_chart(pd.DataFrame.from_dict(data_type_counts, orient="index", columns=["count"]))
            st.subheader("Coverage Quality")
            st.write(f"Total extracted text: **{quality.get('total_text_chars', 0)}** chars")
            st.write(f"Latest collection: **{quality.get('latest_collected_at', '') or 'unknown'}**")
            st.write(f"Citations: **{len(topic_citations)}**")

    with tabs[1]:
        st.subheader("Chronological Timeline")
        combined = [
            {
                "date": row_date(row),
                "label": text_from(row, "event", "milestone", "title", "description", "summary"),
                "evidence": text_from(row, "evidence_text"),
            }
            for row in [*topic_events, *topic_timelines]
        ]
        combined = sorted([row for row in combined if row["label"]], key=lambda row: date_sort_key(row["date"]))
        for row in combined[:120]:
            st.markdown(
                f'<div class="timeline-row"><b>{row["date"] or "undated"}</b><br>{row["label"]}<br><span class="kicker">{row["evidence"]}</span></div>',
                unsafe_allow_html=True,
            )

    with tabs[2]:
        st.subheader("Extracted Claims")
        df = claim_table(topic_claims)
        if not df.empty:
            st.dataframe(df, use_container_width=True, hide_index=True)
        else:
            st.caption("No claims extracted yet.")

    with tabs[3]:
        st.subheader("Entity Map")
        top_entities = profile.get("top_entities", [])
        if top_entities:
            df = pd.DataFrame(top_entities)
            st.bar_chart(df.set_index("name"))
            st.dataframe(df, use_container_width=True, hide_index=True)
        elif topic_entities:
            rows = [{"entity": text_from(row, "name", "entity", "text", "label"), "type": text_from(row, "type")} for row in topic_entities]
            st.dataframe(pd.DataFrame(rows), use_container_width=True, hide_index=True)
        else:
            st.caption("No entities extracted yet.")

    with tabs[4]:
        st.subheader("Metrics And Quantitative Signals")
        rows = [
            {
                "date": row_date(row),
                "metric": text_from(row, "name", "metric"),
                "value": text_from(row, "value"),
                "unit": text_from(row, "unit"),
                "location": text_from(row, "location"),
                "evidence": text_from(row, "evidence_text"),
            }
            for row in topic_metrics
        ]
        rows = [row for row in rows if row["metric"] or row["value"]]
        if rows:
            st.dataframe(pd.DataFrame(rows), use_container_width=True, hide_index=True)
        else:
            st.caption("No metrics extracted yet.")

    with tabs[5]:
        st.subheader("Relationships")
        rows = [
            {
                "subject": text_from(row, "subject"),
                "relationship": text_from(row, "relationship"),
                "object": text_from(row, "object"),
                "evidence": text_from(row, "evidence_text"),
            }
            for row in topic_relationships
        ]
        rows = [row for row in rows if row["subject"] or row["object"]]
        if rows:
            st.dataframe(pd.DataFrame(rows), use_container_width=True, hide_index=True)
        else:
            st.caption("No relationships extracted yet.")

    with tabs[6]:
        st.subheader("Source Drill-Down")
        query = st.text_input("Search sources", "")
        source_rows = topic_docs
        if query:
            needle = query.lower()
            source_rows = [row for row in source_rows if needle in json.dumps(row, ensure_ascii=False).lower()]
        for row in sorted(source_rows, key=lambda item: date_sort_key(row_date(item)))[:120]:
            source_card(row)


if __name__ == "__main__":
    main()
