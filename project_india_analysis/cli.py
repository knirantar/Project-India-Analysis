from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
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
        source_url = document.get("source_url") or payload.get("source_url") or ""
        topic_counts[topic] += 1
        if source_url:
            source_counts[source_url] += 1

        document_row = {
            "topic": topic,
            "analysis_file": str(path),
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
        output_counts[key] = write_jsonl(output_dir / f"{key}.jsonl", rows.get(key, []))

    summary = {
        "data_dir": str(data_dir),
        "analysis_files": len(files),
        "topics": dict(topic_counts),
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

    summary = flatten(Path(args.data_dir).expanduser().resolve(), Path(args.output_dir).expanduser().resolve())
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
