from contextlib import asynccontextmanager
from uuid import uuid4
from pathlib import Path
import requests
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .config import MAX_UPLOAD_MB, OLLAMA_BASE_URL, OLLAMA_MODEL
from .models import AskRequest
from .pdf_processor import extract_pages, chunk_pages
from .rag_pipeline import engine

documents: dict[str, dict] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(
    title="AI Research Paper Assistant API",
    description="Citation-grounded RAG for uploaded research-paper PDFs using local Ollama.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    ollama_ok = False
    ollama_error = None
    try:
        response = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=2)
        ollama_ok = response.ok
    except requests.RequestException as exc:
        ollama_error = str(exc)
    return {
        "status": "ok",
        "ollama_available": ollama_ok,
        "ollama_model": OLLAMA_MODEL,
        "ollama_error": ollama_error,
        "documents_loaded": len(documents),
    }


@app.get("/api/documents")
def list_documents():
    return {"documents": list(documents.values())}


@app.post("/api/documents")
async def upload_documents(files: list[UploadFile] = File(...)):
    if not files:
        raise HTTPException(status_code=400, detail="Choose at least one PDF.")

    results = []
    for upload in files:
        filename = Path(upload.filename or "paper.pdf").name
        if not filename.lower().endswith(".pdf"):
            results.append({"filename": filename, "status": "error", "message": "Only PDF files are accepted."})
            continue

        content = await upload.read()
        if not content:
            results.append({"filename": filename, "status": "error", "message": "The uploaded file is empty."})
            continue
        if len(content) > MAX_UPLOAD_MB * 1024 * 1024:
            results.append({"filename": filename, "status": "error", "message": f"File exceeds {MAX_UPLOAD_MB} MB."})
            continue

        try:
            pages = extract_pages(content)
        except Exception:
            results.append({"filename": filename, "status": "error", "message": "Could not read this PDF. Check that it is a valid, unencrypted PDF."})
            continue

        if not pages:
            results.append({
                "filename": filename,
                "status": "error",
                "message": "No selectable text was found. This may be a scanned PDF; OCR is not included yet.",
            })
            continue

        chunks = chunk_pages(pages)
        document_id = str(uuid4())
        # Store a display name safely; allow same filename by appending a short ID.
        existing_names = {item["filename"] for item in documents.values()}
        display_name = filename
        if display_name in existing_names:
            display_name = f"{Path(filename).stem}_{document_id[:6]}{Path(filename).suffix}"
        try:
            engine.add_document(document_id, display_name, chunks)
        except Exception as exc:
            results.append({"filename": filename, "status": "error", "message": f"Could not create embeddings: {exc}"})
            continue

        document = {
            "id": document_id,
            "filename": display_name,
            "pages_with_text": len(pages),
            "chunks": len(chunks),
            "status": "ready",
        }
        documents[document_id] = document
        results.append(document)

    return {"results": results}


@app.delete("/api/documents/{document_id}")
def delete_document(document_id: str):
    if document_id not in documents:
        raise HTTPException(status_code=404, detail="Document not found.")
    del documents[document_id]
    engine.remove_document(document_id)
    return {"status": "deleted", "document_id": document_id}


@app.post("/api/ask")
def ask_question(request: AskRequest):
    if not documents:
        raise HTTPException(status_code=400, detail="Upload at least one research paper first.")
    question = request.question.strip()
    if len(question) < 3:
        raise HTTPException(status_code=422, detail="Please enter a longer question.")
    try:
        return engine.answer(question)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
