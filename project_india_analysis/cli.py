from __future__ import annotations

import argparse
import json
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

OBJECT_KEYS = [
    "documents",
    "claims",
    "entities",
    "events",
    "metrics",
    "relationships",
    "timelines",
    "citations",
]


def parse_date_sort_key(value: Any) -> tuple[int, str]:
    text = text_value(value).strip()
    if not text or text.lower() in {"none", "unknown", "undated"}:
        return (99999999, "")
    match = re.search(r"(\d{4})(?:[-/](\d{1,2}))?(?:[-/](\d{1,2}))?", text)
    if not match:
        return (99999999, text.lower())
    year = int(match.group(1))
    month = int(match.group(2) or 1)
    day = int(match.group(3) or 1)
    return (year * 10000 + month * 100 + day, text.lower())


def iter_analysis_files(data_dir: Path) -> Iterable[Path]:
    yield from sorted(data_dir.glob("*/raw/*.analysis.json"))


def topic_from_path(path: Path) -> str:
    try:
        return path.parents[1].name
    except IndexError:
        return "unknown"


def as_list(value: Any) -> list[Any]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, dict):
        return [value]
    return []


def write_jsonl(path: Path, rows: Iterable[dict[str, Any]]) -> int:
    count = 0
    with path.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
            count += 1
    return count


def load_analysis(path: Path) -> dict[str, Any] | None:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"skipping invalid analysis file {path}: {exc}")
        return None


def load_raw_metadata(analysis_path: Path) -> dict[str, Any]:
    metadata_path = analysis_path.with_name(analysis_path.name.replace(".analysis.json", ".json"))
    if not metadata_path.exists():
        return {}
    try:
        return json.loads(metadata_path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def display_path(path: Path, base_dir: Path) -> str:
    try:
        return str(path.relative_to(base_dir))
    except ValueError:
        return str(path)


def text_value(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False)
    return str(value)


def first_text(item: dict[str, Any], keys: tuple[str, ...]) -> str:
    for key in keys:
        value = text_value(item.get(key)).strip()
        if value:
            return value
    return ""


def row_date(row: dict[str, Any]) -> str:
    return first_text(row, ("date", "published", "collected_at", "timestamp", "time"))


def build_topic_profiles(rows: dict[str, list[dict[str, Any]]], output_dir: Path) -> list[dict[str, Any]]:
    topics = sorted({row.get("topic", "unknown") for values in rows.values() for row in values})
    topic_dir = output_dir / "topics"
    topic_dir.mkdir(parents=True, exist_ok=True)
    cards: list[dict[str, Any]] = []

    for topic in topics:
        docs = [row for row in rows.get("documents", []) if row.get("topic") == topic]
        claims = [row for row in rows.get("claims", []) if row.get("topic") == topic]
        entities = [row for row in rows.get("entities", []) if row.get("topic") == topic]
        events = [row for row in rows.get("events", []) if row.get("topic") == topic]
        metrics = [row for row in rows.get("metrics", []) if row.get("topic") == topic]
        citations = [row for row in rows.get("citations", []) if row.get("topic") == topic]

        data_type_counts = Counter(first_text(doc, ("data_type",)) or "unknown" for doc in docs)
        credibility_counts = Counter(first_text(doc, ("credibility", "source_credibility",)) or "unrated" for doc in docs)
        entity_counts = Counter(first_text(entity, ("name", "entity", "text", "label")) for entity in entities)
        entity_counts.pop("", None)

        summaries = [first_text(doc, ("summary", "source_title", "title")) for doc in docs]
        summaries = [item for item in summaries if item and item.lower() != "none"]
        top_claims = [first_text(claim, ("claim_text", "claim", "text", "summary", "description")) for claim in claims]
        top_claims = [item for item in top_claims if item][:8]
        sorted_events = sorted(events, key=lambda row: parse_date_sort_key(row_date(row)))
        sorted_timelines = sorted(
            [*rows.get("timelines", [])],
            key=lambda row: parse_date_sort_key(row_date(row)),
        )
        sorted_timelines = [row for row in sorted_timelines if row.get("topic") == topic]
        dated_items = [
            {
                "date": row_date(row),
                "label": first_text(row, ("event", "milestone", "title", "description", "summary")),
                "evidence_text": first_text(row, ("evidence_text",)),
                "source": first_text(row, ("analysis_file",)),
            }
            for row in [*sorted_events, *sorted_timelines]
            if first_text(row, ("event", "milestone", "title", "description", "summary"))
        ]
        topic_title = next((doc.get("topic_title") for doc in docs if doc.get("topic_title")), None) or topic.replace("-", " ").title()

        profile = {
            "topic": topic,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "ui_profile": {
                "title": topic_title,
                "tone": "clinical evidence desk" if any("clinical" in key for key in data_type_counts) else "research intelligence desk",
                "primary_views": ["Evidence", "Claims", "Entities", "Timeline", "Sources"],
                "hero_metric": f"{len(docs)} analyzed sources",
                "secondary_metric": f"{len(claims)} claims, {len(entities)} entities",
            },
            "counts": {
                "documents": len(docs),
                "claims": len(claims),
                "entities": len(entities),
                "events": len(events),
                "metrics": len(metrics),
                "citations": len(citations),
            },
            "data_type_counts": dict(data_type_counts.most_common()),
            "credibility_counts": dict(credibility_counts.most_common()),
            "top_entities": [{"name": name, "count": count} for name, count in entity_counts.most_common(12)],
            "top_claims": top_claims,
            "source_highlights": docs[:12],
            "brief": summaries[:5],
            "timeline": dated_items[:80],
            "source_quality": {
                "total_text_chars": sum(int(doc.get("text_chars") or 0) for doc in docs),
                "average_text_chars": round(sum(int(doc.get("text_chars") or 0) for doc in docs) / len(docs), 1) if docs else 0,
                "latest_collected_at": max((first_text(doc, ("collected_at",)) for doc in docs if first_text(doc, ("collected_at",))), default=""),
            },
        }
        (topic_dir / f"{topic}.json").write_text(json.dumps(profile, ensure_ascii=False, indent=2), encoding="utf-8")
        cards.append(
            {
                "topic": topic,
                "title": profile["ui_profile"]["title"],
                "documents": len(docs),
                "claims": len(claims),
                "entities": len(entities),
                "events": len(events),
                "updated_at": profile["generated_at"],
            }
        )

    (output_dir / "topic_cards.json").write_text(json.dumps(cards, ensure_ascii=False, indent=2), encoding="utf-8")
    return cards


def flatten(data_dir: Path, output_dir: Path) -> dict[str, Any]:
    output_dir.mkdir(parents=True, exist_ok=True)
    rows: dict[str, list[dict[str, Any]]] = defaultdict(list)
    topic_counts: Counter[str] = Counter()
    source_counts: Counter[str] = Counter()
    files = list(iter_analysis_files(data_dir))

    for path in files:
        topic = topic_from_path(path)
        payload = load_analysis(path)
        if not payload:
            continue

        document = payload.get("document") or {}
        raw_metadata = load_raw_metadata(path)
        source_url = document.get("source_url") or payload.get("source_url") or ""
        topic_counts[topic] += 1
        if source_url:
            source_counts[source_url] += 1

        document_row = {
            "topic": topic,
            "analysis_file": display_path(path, data_dir),
            "metadata_file": display_path(path.with_name(path.name.replace(".analysis.json", ".json")), data_dir),
            "topic_title": raw_metadata.get("topic_title"),
            "raw_text_path": raw_metadata.get("text_path"),
            "collected_at": raw_metadata.get("collected_at"),
            "text_chars": raw_metadata.get("text_chars"),
            "data_type": raw_metadata.get("data_type") or document.get("data_type"),
            **document,
        }
        rows["documents"].append(document_row)

        for key in OBJECT_KEYS:
            if key == "documents":
                continue
            for item in as_list(payload.get(key)):
                if isinstance(item, dict):
                    rows[key].append({"topic": topic, "analysis_file": str(path), **item})

    output_counts = {}
    for key in OBJECT_KEYS:
        if key in {"events", "timelines"}:
            rows[key] = sorted(rows.get(key, []), key=lambda row: parse_date_sort_key(row_date(row)))
        if key == "documents":
            rows[key] = sorted(rows.get(key, []), key=lambda row: parse_date_sort_key(row_date(row)))
        output_counts[key] = write_jsonl(output_dir / f"{key}.jsonl", rows.get(key, []))

    topic_cards = build_topic_profiles(rows, output_dir)

    summary = {
        "data_dir": str(data_dir),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "analysis_files": len(files),
        "topics": dict(topic_counts),
        "topic_cards": topic_cards,
        "unique_sources": len(source_counts),
        "outputs": output_counts,
    }
    (output_dir / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description="Analyze Project India normalized evidence files.")
    parser.add_argument("--data-dir", default="../Project-India-Data/data", help="Path to Project India data folder.")
    parser.add_argument("--output-dir", default="analysis_output", help="Folder for flattened analysis outputs.")
    args = parser.parse_args()

    summary = flatten(Path(args.data_dir).expanduser(), Path(args.output_dir).expanduser())
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
