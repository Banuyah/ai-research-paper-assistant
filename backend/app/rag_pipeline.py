from dataclasses import dataclass
import re
import requests
import numpy as np
import faiss
from sentence_transformers import SentenceTransformer

from .config import (
    EMBEDDING_MODEL, OLLAMA_BASE_URL, OLLAMA_MODEL, TOP_K, MIN_SIMILARITY
)
from .pdf_processor import TextChunk


@dataclass
class StoredChunk:
    document_id: str
    filename: str
    text: str
    page: int
    chunk_index: int


class RAGEngine:
    def __init__(self):
        self.embedder: SentenceTransformer | None = None
        self.chunks: list[StoredChunk] = []
        self.index = None

    def _get_embedder(self) -> SentenceTransformer:
        if self.embedder is None:
            self.embedder = SentenceTransformer(EMBEDDING_MODEL)
        return self.embedder

    def add_document(self, document_id: str, filename: str, chunks: list[TextChunk]):
        self.chunks.extend(
            StoredChunk(
                document_id=document_id,
                filename=filename,
                text=chunk.text,
                page=chunk.page,
                chunk_index=chunk.chunk_index,
            )
            for chunk in chunks
        )
        self._rebuild_index()

    def remove_document(self, document_id: str):
        self.chunks = [c for c in self.chunks if c.document_id != document_id]
        self._rebuild_index()

    def _rebuild_index(self):
        if not self.chunks:
            self.index = None
            return
        vectors = self._get_embedder().encode(
            [c.text for c in self.chunks],
            convert_to_numpy=True,
            normalize_embeddings=True,
            show_progress_bar=False,
        ).astype("float32")
        self.index = faiss.IndexFlatIP(vectors.shape[1])
        self.index.add(vectors)

    def retrieve(self, question: str, top_k: int | None = None):
        if self.index is None or not self.chunks:
            return []
        query_vector = self._get_embedder().encode(
            [question],
            convert_to_numpy=True,
            normalize_embeddings=True,
            show_progress_bar=False,
        ).astype("float32")
        count = min(top_k or TOP_K, len(self.chunks))
        scores, indices = self.index.search(query_vector, count)
        found = []
        for score, index in zip(scores[0], indices[0]):
            if index < 0:
                continue
            score = float(score)
            if score < MIN_SIMILARITY:
                continue
            found.append((self.chunks[int(index)], score))
        return found

    def answer(self, question: str):
        matches = self.retrieve(question)
        if not matches:
            return {
                "answer": (
                    "I could not find sufficiently relevant evidence in the uploaded "
                    "papers to answer this question. Try rephrasing it or upload a "
                    "paper that discusses the topic."
                ),
                "sources": [],
                "used_ollama": False,
            }

        source_blocks = []
        sources = []
        for i, (chunk, score) in enumerate(matches, start=1):
            source_id = f"S{i}"
            source_blocks.append(
                f"[{source_id}] File: {chunk.filename} | Page: {chunk.page}\n"
                f"Passage: {chunk.text}"
            )
            sources.append({
                "source_id": source_id,
                "filename": chunk.filename,
                "page": chunk.page,
                "similarity": round(score, 4),
                "excerpt": chunk.text[:420] + ("…" if len(chunk.text) > 420 else ""),
            })

        prompt = f"""You are a careful research-paper assistant.
Answer the question using ONLY the evidence passages below.
Do not use outside knowledge. If the passages do not contain the answer, say
that the papers do not provide enough evidence. Do not invent facts, results,
authors, or page numbers.
Every factual claim must include one or more source tags exactly like [S1].
Keep the answer clear and concise. Source tags refer to the evidence below.

EVIDENCE:
{chr(10).join(source_blocks)}

QUESTION:
{question}

ANSWER (include source tags such as [S1]):"""

        try:
            response = requests.post(
                f"{OLLAMA_BASE_URL}/api/chat",
                json={
                    "model": OLLAMA_MODEL,
                    "messages": [{"role": "user", "content": prompt}],
                    "stream": False,
                    "options": {"temperature": 0.1},
                },
                timeout=180,
            )
            if response.status_code == 404:
                raise RuntimeError(
                    f"Ollama model '{OLLAMA_MODEL}' was not found. Run "
                    f"'ollama pull {OLLAMA_MODEL}' or update OLLAMA_MODEL."
                )
            response.raise_for_status()
            answer = response.json().get("message", {}).get("content", "").strip()
            if not answer:
                raise RuntimeError("Ollama returned an empty answer.")
            # Replace model tags with explicit, page-level citations.
            for source in sources:
                citation = f"[{source['filename']}, p. {source['page']}]"
                answer = re.sub(
                    rf"\[{re.escape(source['source_id'])}\]",
                    citation,
                    answer,
                )
            # Any unknown tags should not be presented as valid citations.
            answer = re.sub(r"\[S\d+\]", "", answer).strip()
            return {"answer": answer, "sources": sources, "used_ollama": True}
        except requests.ConnectionError:
            raise RuntimeError(
                "Cannot connect to Ollama. Start the Ollama app and make sure "
                f"the model '{OLLAMA_MODEL}' is installed."
            )
        except requests.Timeout:
            raise RuntimeError(
                "Ollama took too long to respond. Try a smaller model or a shorter question."
            )
        except requests.HTTPError as exc:
            raise RuntimeError(f"Ollama API error: {exc}") from exc


engine = RAGEngine()
