from dataclasses import dataclass
import re
import fitz  # PyMuPDF


@dataclass
class TextChunk:
    text: str
    page: int
    chunk_index: int


def extract_pages(pdf_bytes: bytes) -> list[tuple[int, str]]:
    """Return (1-based page number, extracted text) for every page with text."""
    pages: list[tuple[int, str]] = []
    with fitz.open(stream=pdf_bytes, filetype="pdf") as document:
        for index, page in enumerate(document, start=1):
            text = page.get_text("text").strip()
            text = re.sub(r"[ \t]+", " ", text)
            text = re.sub(r"\n{3,}", "\n\n", text)
            if text:
                pages.append((index, text))
    return pages


def chunk_pages(
    pages: list[tuple[int, str]],
    chunk_size: int = 1100,
    overlap: int = 180,
) -> list[TextChunk]:
    """Chunk each page separately so citations never lose their page number."""
    if chunk_size <= 0:
        raise ValueError("chunk_size must be greater than zero")
    if overlap < 0 or overlap >= chunk_size:
        raise ValueError("overlap must be >= 0 and smaller than chunk_size")

    chunks: list[TextChunk] = []
    chunk_index = 0
    step = chunk_size - overlap
    for page_number, text in pages:
        text = text.strip()
        start = 0
        while start < len(text):
            piece = text[start:start + chunk_size].strip()
            if piece:
                chunks.append(TextChunk(piece, page_number, chunk_index))
                chunk_index += 1
            if start + chunk_size >= len(text):
                break
            start += step
    return chunks
