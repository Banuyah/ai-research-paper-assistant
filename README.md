# AI Research Paper Assistant (Citation-Grounded RAG)

A beginner-friendly full-stack application that lets you upload research-paper PDFs, ask questions, and receive answers grounded in retrieved passages. Each answer includes source references with the PDF filename and page number.

**Stack**
- Frontend: React + Vite
- Backend: Python + FastAPI
- PDF extraction: PyMuPDF
- Embeddings: Sentence Transformers (`all-MiniLM-L6-v2`)
- Semantic retrieval: FAISS
- Local answer generation: Ollama

> This is a learning/portfolio project, not a replacement for reading the original papers. Always verify important claims in the cited pages. Scanned PDFs may need OCR; OCR is not included in this first version.

## Features

- Upload one or more text-based PDF papers
- Extract text while preserving PDF page numbers
- Split page text into overlapping chunks
- Build semantic embeddings and retrieve relevant passages
- Ask questions across uploaded papers
- Generate answers with a local Ollama model
- Return citations as `[filename, p. 4]`
- Refuse to guess when retrieved evidence is insufficient
- Basic file size/type checks and duplicate filename handling
- Simple, responsive React interface
- Health endpoint and backend tests

## Requirements

- Windows 10/11
- Python 3.10–3.12 recommended
- Node.js 20 or newer
- Ollama installed locally
- Enough disk space/RAM for the embedding model and chosen local LLM

## 1. Install Ollama and download a model

Install Ollama from <https://ollama.com/download/windows>, then open PowerShell and run:

```powershell
ollama pull llama3.2:3b
ollama list
```

Keep Ollama running. Its local API normally listens at `http://localhost:11434`.

You can choose another model you have pulled by setting `OLLAMA_MODEL` in the backend `.env` file. Smaller models use fewer resources but may produce weaker answers.

## 2. Start the backend (Windows PowerShell)

Open this project folder in VS Code. In a terminal:

```powershell
cd backend
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload
```

If PowerShell blocks activation, run this for the current terminal only, then activate again:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

The API runs at <http://127.0.0.1:8000>. Interactive API documentation is at <http://127.0.0.1:8000/docs>.

**First startup note:** Sentence Transformers downloads the embedding model the first time it runs. The first launch may take a few minutes and requires internet access. After the model is cached, embeddings can run locally.

## 3. Start the frontend

Open a **second** VS Code terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open the URL printed by Vite, usually <http://localhost:5173>.

## 4. Use the app

1. Click **Choose PDF files** and select one or more research papers.
2. Wait for each upload to finish processing.
3. Enter a specific question, for example:
   - “What is the main research question?”
   - “Which dataset did the authors use?”
   - “What limitations do the authors mention?”
4. Click **Ask question**.
5. Read the answer and inspect the returned source cards. Open the original PDF and verify the cited page.

Ask questions that can be answered by the uploaded papers. If no relevant passages are found, the app should tell you it cannot answer from the available evidence.

## Configuration

Edit `backend/.env`:

```env
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
MAX_UPLOAD_MB=20
TOP_K=5
MIN_SIMILARITY=0.20
```

- `TOP_K`: maximum number of passages retrieved for a question.
- `MIN_SIMILARITY`: retrieval similarity threshold. This is a practical filter, not a calibrated confidence score. Adjust it using your own test questions.
- The app sends only retrieved paper passages and your question to Ollama. It does not use a cloud LLM API.

## API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Check backend and Ollama availability |
| GET | `/api/documents` | List uploaded documents |
| POST | `/api/documents` | Upload one or more PDFs |
| DELETE | `/api/documents/{document_id}` | Remove a document and rebuild the search index |
| POST | `/api/ask` | Retrieve passages and answer a question |

FastAPI's interactive docs at `/docs` let you try these endpoints without the React UI.

## Run tests

From the `backend` folder, with the virtual environment active:

```powershell
pytest -q
```

Tests cover page-aware chunking and basic API health behavior. An end-to-end question test requires Ollama to be running and a model to be downloaded.

## Troubleshooting

### “Ollama is not available”
Run `ollama list`, then start Ollama from the Start menu. Verify <http://localhost:11434/api/tags> opens locally.

### “Model not found”
Run `ollama pull llama3.2:3b`, or change `OLLAMA_MODEL` to a model shown by `ollama list`.

### First upload is slow
The embedding model is downloaded and loaded on first use. Later requests should be faster.

### No text found in PDF
The PDF may be a scan/image. This version extracts selectable text and does not include OCR. Use a text-based PDF or add an OCR step in a future version.

### Answer says there is not enough evidence
Try a more specific question or upload the paper that contains the answer. You can tune `MIN_SIMILARITY`, but do not lower it just to make every question produce an answer.

### Frontend cannot reach the API
Make sure the backend is running on port 8000 and the frontend on port 5173. The Vite development server proxies `/api` to FastAPI.

## Architecture

```text
PDF upload
   |
   v
FastAPI -> PyMuPDF extracts text page by page
   |
   v
Page-aware chunks -> Sentence Transformers embeddings
   |
   v
FAISS similarity search <--- user question embedding
   |
   v
Top relevant passages + page metadata
   |
   v
Ollama local model (answer constrained to evidence)
   |
   v
Answer + filename/page citations -> React UI
```

## Screenshot guidance for GitHub

After running the app, add genuine screenshots to `screenshots/`:
1. `01-home.png` — empty app / upload area
2. `02-documents.png` — uploaded paper list
3. `03-answer-citations.png` — a question, answer, and page source cards
4. `04-api-docs.png` — FastAPI `/docs` page

On Windows, use **Win + Shift + S** to capture the app. Save the images in the `screenshots` folder, then add them to this README if desired:

```markdown
![Answer with citations](screenshots/03-answer-citations.png)
```

Do not add fake or illustrative screenshots as if they came from a working app.

## Suggested GitHub description

**AI Research Paper Assistant using citation-grounded RAG, semantic search, page-aware PDF extraction, React, FastAPI, FAISS, Sentence Transformers, and Ollama.**

## CV description (use after you have run and tested the project)

**AI Research Paper Assistant with Citation-Grounded RAG** | React, FastAPI, Python, FAISS, Sentence Transformers, Ollama
- Built a full-stack application to query uploaded research papers using retrieval-augmented generation (RAG).
- Implemented page-aware PDF extraction, overlapping text chunking, embeddings, and FAISS semantic retrieval.
- Generated local LLM answers grounded in retrieved passages and returned filename/page-level citations.
- Added insufficient-evidence handling, document management, API documentation, and automated backend tests.

Only list features you have personally run and verified. Do not claim accuracy improvements or benchmark results without measuring them.

## Limitations and next improvements

- Text extraction only; scanned PDFs need OCR.
- Uploaded documents and the FAISS index are kept in memory and are cleared when the backend restarts.
- This demo is intended for local use; it does not include user accounts or production-grade access controls.
- Similarity is not a guarantee of factual correctness.
- Useful future work: persistent storage, OCR, citation-quality evaluation, document-level filters, streaming answers, and Docker deployment.

## License

Choose a license before making the repository public (for example, MIT). Check the licenses of all models and dependencies you use.
