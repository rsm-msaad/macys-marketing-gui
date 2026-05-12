"""
Chunker for the Macys M3 RAG knowledge base.

Reads a markdown document, separates the metadata block from the body, and
splits the body into chunks by section heading. Sections longer than the
target word count are further split by paragraph so no single chunk is
much longer than what fits in a reasonable embedding context.

CLI usage:
    python -m rag.chunker 01_brand_guidelines.md
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

MAX_WORDS_PER_CHUNK = 500
METADATA_KEYS = ("Document ID", "Owner", "Last updated", "Audience")


def parse_metadata(text: str) -> dict[str, str]:
    """Extract the metadata block from the top of a knowledge base doc.

    The metadata block is expected to be a list of bold lines, for example:

        **Document ID:** BRAND-GL-2026-001
        **Owner:** Brand Marketing Council
        **Last updated:** January 22, 2026
        **Audience:** Marketing, Creative

    Returns a dict keyed by the metadata field names. Missing fields are
    omitted. The function only looks at the section before the first
    level 2 heading.
    """
    head = text.split("\n## ", 1)[0]
    pattern = re.compile(r"\*\*(?P<key>[^:*]+):\*\*\s*(?P<value>[^\n]+)")
    out: dict[str, str] = {}
    for match in pattern.finditer(head):
        key = match.group("key").strip()
        value = match.group("value").strip()
        out[key] = value
    return out


def split_into_sections(text: str) -> list[tuple[str, str]]:
    """Split the body of a doc into (section_title, section_text) tuples.

    Sections are delimited by Markdown level 2 headings (lines starting
    with '## '). Content above the first '## ' is grouped under the
    name 'Preamble' if it contains any non metadata prose. Title and
    metadata lines are stripped before the preamble check, so docs that
    only contain a title and metadata above the first section produce no
    preamble chunk.
    """
    parts = re.split(r"(?m)^##\s+", text)
    sections: list[tuple[str, str]] = []
    if not parts:
        return sections
    preamble = parts[0]
    body_parts = parts[1:]
    if preamble.strip():
        cleaned = _strip_metadata_lines(preamble)
        if cleaned.strip():
            sections.append(("Preamble", cleaned.strip()))
    for part in body_parts:
        if not part.strip():
            continue
        title, _, body = part.partition("\n")
        sections.append((title.strip(), body.strip()))
    return sections


def _strip_metadata_lines(text: str) -> str:
    """Remove the bold metadata lines and the top level title from a block."""
    out_lines: list[str] = []
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("# "):
            continue
        if any(stripped.startswith(f"**{key}:") for key in METADATA_KEYS):
            continue
        out_lines.append(line)
    return "\n".join(out_lines)


def _split_long_section(body: str, max_words: int) -> list[str]:
    """Split a long section into paragraph aggregates under max_words each.

    Paragraphs are delimited by blank lines. The function accumulates whole
    paragraphs until adding the next one would push the running word count
    above max_words. Single paragraphs longer than max_words are kept as
    their own chunk (we do not split mid paragraph).
    """
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", body) if p.strip()]
    chunks: list[str] = []
    buffer: list[str] = []
    buffer_words = 0
    for paragraph in paragraphs:
        words = len(paragraph.split())
        if buffer and buffer_words + words > max_words:
            chunks.append("\n\n".join(buffer))
            buffer = [paragraph]
            buffer_words = words
        else:
            buffer.append(paragraph)
            buffer_words += words
    if buffer:
        chunks.append("\n\n".join(buffer))
    return chunks


def chunk_document(path: Path, max_words: int = MAX_WORDS_PER_CHUNK) -> list[dict]:
    """Chunk a single markdown doc into retrieval ready pieces.

    Args:
        path: path to a markdown file in rag/knowledge_base/.
        max_words: maximum words per chunk before the paragraph splitter
            kicks in for long sections.

    Returns:
        A list of chunk dicts in document order. Each chunk has:
            doc_id      Document ID from the metadata block, falls back to
                        the filename stem if no metadata is present.
            filename    Basename of the source file.
            section     Section heading the chunk came from.
            text        The chunk text, prefixed with the section title so
                        the embedding captures what the chunk is about.
            chunk_index Zero based index within the document.
    """
    text = path.read_text(encoding="utf-8")
    metadata = parse_metadata(text)
    doc_id = metadata.get("Document ID", path.stem)
    sections = split_into_sections(text)
    chunks: list[dict] = []
    index = 0
    for title, body in sections:
        word_count = len(body.split())
        pieces = [body] if word_count <= max_words else _split_long_section(body, max_words)
        for piece in pieces:
            chunks.append(
                {
                    "doc_id": doc_id,
                    "filename": path.name,
                    "section": title,
                    "text": f"{title}\n\n{piece}",
                    "chunk_index": index,
                }
            )
            index += 1
    return chunks


def _cli(argv: list[str]) -> int:
    """CLI entry: preview the chunks produced for one knowledge base file."""
    if len(argv) != 2:
        print("Usage: python -m rag.chunker <filename.md>", file=sys.stderr)
        return 2
    arg = argv[1]
    repo_root = Path(__file__).resolve().parent.parent
    candidate = Path(arg)
    if not candidate.is_absolute():
        candidate = repo_root / "rag" / "knowledge_base" / arg
    if not candidate.exists():
        print(f"File not found: {candidate}", file=sys.stderr)
        return 1
    chunks = chunk_document(candidate)
    print(f"{candidate.name}: {len(chunks)} chunks")
    for chunk in chunks:
        preview = chunk["text"].replace("\n", " ")[:120]
        print(f"  [{chunk['chunk_index']:02d}] section={chunk['section']!r}")
        print(f"       {preview!r}")
    return 0


if __name__ == "__main__":
    raise SystemExit(_cli(sys.argv))
