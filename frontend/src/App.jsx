import { useCallback, useEffect, useRef, useState } from 'react'
import {
  BookOpen, Bot, CheckCircle2, ChevronRight, CircleHelp, FileText,
  Files, LoaderCircle, MessageCircle, Plus, Send, ShieldCheck,
  Trash2, UploadCloud, Wifi, WifiOff, X
} from 'lucide-react'
import { askQuestion, deleteDocument, getDocuments, getHealth, uploadPdfs } from './api'

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function App() {
  const [documents, setDocuments] = useState([])
  const [health, setHealth] = useState(null)
  const [selectedFiles, setSelectedFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [asking, setAsking] = useState(false)
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState([])
  const [notice, setNotice] = useState(null)
  const [activeTab, setActiveTab] = useState('chat')
  const fileInput = useRef(null)
  const chatEnd = useRef(null)

  const refresh = useCallback(async () => {
    try {
      const [docs, status] = await Promise.all([getDocuments(), getHealth()])
      setDocuments(docs.documents || [])
      setHealth(status)
    } catch {
      setHealth({ status: 'offline', ollama_available: false })
    }
  }, [])

  useEffect(() => {
    refresh()
    const timer = setInterval(refresh, 10000)
    return () => clearInterval(timer)
  }, [refresh])

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, asking])

  function chooseFiles(event) {
    setSelectedFiles(Array.from(event.target.files || []))
    setNotice(null)
  }

  async function handleUpload(event) {
    event.preventDefault()
    if (!selectedFiles.length) return
    setUploading(true)
    setNotice(null)
    try {
      const result = await uploadPdfs(selectedFiles)
      const successful = (result.results || []).filter(item => item.status === 'ready')
      const failed = (result.results || []).filter(item => item.status === 'error')
      setNotice({
        type: failed.length ? 'warning' : 'success',
        text: [
          successful.length ? `Processed ${successful.length} paper(s).` : '',
          ...failed.map(item => `${item.filename}: ${item.message}`),
        ].filter(Boolean).join(' '),
      })
      setSelectedFiles([])
      if (fileInput.current) fileInput.current.value = ''
      await refresh()
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    } finally {
      setUploading(false)
    }
  }

  async function removeDocument(document) {
    try {
      await deleteDocument(document.id)
      setNotice({ type: 'success', text: `Removed ${document.filename}.` })
      await refresh()
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    }
  }

  async function submitQuestion(event) {
    event.preventDefault()
    const cleanQuestion = question.trim()
    if (!cleanQuestion || asking) return
    setMessages(previous => [...previous, { role: 'user', text: cleanQuestion }])
    setQuestion('')
    setAsking(true)
    setNotice(null)
    try {
      const result = await askQuestion(cleanQuestion)
      setMessages(previous => [...previous, {
        role: 'assistant',
        text: result.answer,
        sources: result.sources || [],
        usedOllama: result.used_ollama,
      }])
    } catch (error) {
      setMessages(previous => [...previous, {
        role: 'error',
        text: error.message,
      }])
    } finally {
      setAsking(false)
    }
  }

  const connected = health?.status === 'ok'
  const ollamaReady = Boolean(health?.ollama_available)

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon"><BookOpen size={21} /></div>
          <div><strong>PaperPilot</strong><span>RESEARCH ASSISTANT</span></div>
        </div>

        <button className={`nav-item ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => setActiveTab('chat')}>
          <MessageCircle size={18} /> Ask papers
        </button>
        <button className={`nav-item ${activeTab === 'library' ? 'active' : ''}`} onClick={() => setActiveTab('library')}>
          <Files size={18} /> Paper library <span className="nav-count">{documents.length}</span>
        </button>

        <div className="sidebar-section">
          <div className="section-heading">YOUR LIBRARY <button title="Upload papers" onClick={() => fileInput.current?.click()}><Plus size={15} /></button></div>
          {documents.length ? documents.map(document => (
            <div className="sidebar-document" key={document.id}>
              <FileText size={15} />
              <span title={document.filename}>{document.filename}</span>
            </div>
          )) : <p className="muted tiny">Your uploaded papers will appear here.</p>}
        </div>

        <div className="sidebar-bottom">
          <div className="local-card">
            <ShieldCheck size={18} />
            <div><strong>Local-first AI</strong><span>Your answers are generated by Ollama on your computer.</span></div>
          </div>
          <div className="connection-row">
            <span className={`status-dot ${connected ? 'online' : ''}`} />
            <span>{connected ? 'API connected' : 'API unavailable'}</span>
            {connected ? <Wifi size={14} /> : <WifiOff size={14} />}
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumbs"><span>Workspace</span><ChevronRight size={14} /><strong>{activeTab === 'chat' ? 'Ask your papers' : 'Paper library'}</strong></div>
          <div className={`model-pill ${ollamaReady ? 'ready' : 'not-ready'}`}>
            <span className="status-dot" /> {ollamaReady ? `Ollama · ${health?.ollama_model}` : 'Ollama not connected'}
          </div>
        </header>

        {activeTab === 'library' ? (
          <section className="library-page">
            <div className="page-title-row"><div><p className="eyebrow">KNOWLEDGE BASE</p><h1>Your paper library</h1><p className="subtitle">Upload and manage the papers you want to explore.</p></div></div>
            <UploadPanel {...{selectedFiles, chooseFiles, handleUpload, uploading, fileInput, documents}} />
            <DocumentList documents={documents} onRemove={removeDocument} />
          </section>
        ) : (
          <section className="chat-page">
            {messages.length === 0 ? (
              <div className="welcome">
                <div className="welcome-symbol"><Bot size={31} /></div>
                <p className="eyebrow">YOUR AI RESEARCH COMPANION</p>
                <h1>Research smarter.<br /><span>Stay grounded in evidence.</span></h1>
                <p className="welcome-copy">Upload your papers, ask a question, and get a concise answer with page-level references to the source material.</p>
                <div className="feature-row">
                  <div><span className="feature-icon violet"><Files size={17} /></span><strong>Multiple papers</strong><small>Search across your library</small></div>
                  <div><span className="feature-icon blue"><BookOpen size={17} /></span><strong>Page citations</strong><small>Trace claims to sources</small></div>
                  <div><span className="feature-icon green"><ShieldCheck size={17} /></span><strong>Local AI</strong><small>Powered by Ollama</small></div>
                </div>
                <div className="upload-card">
                  <div className="upload-card-icon"><UploadCloud size={22} /></div>
                  <div className="upload-card-copy"><strong>Start with your research papers</strong><span>PDF files · Up to 20 MB each · Text-based PDFs</span></div>
                  <button className="button button-primary" onClick={() => fileInput.current?.click()}><Plus size={16} /> Add papers</button>
                </div>
                <UploadPanel compact {...{selectedFiles, chooseFiles, handleUpload, uploading, fileInput, documents}} />
                {documents.length > 0 && <div className="ready-note"><CheckCircle2 size={16} /> {documents.length} paper(s) ready. Try asking a question below.</div>}
                <div className="suggestion-area"><span>TRY ASKING</span><div className="suggestions">
                  {['What is the main research question?', 'Summarize the methodology.', 'What limitations do the authors mention?'].map(item => <button key={item} onClick={() => setQuestion(item)}>{item}<ChevronRight size={14} /></button>)}
                </div></div>
              </div>
            ) : (
              <div className="conversation">
                <div className="conversation-heading"><div><p className="eyebrow">RESEARCH SESSION</p><h2>Ask your papers</h2></div><span className="paper-count"><Files size={14} /> {documents.length} papers</span></div>
                {messages.map((message, index) => (
                  <div className={`message-row ${message.role}`} key={`${message.role}-${index}`}>
                    <div className="message-avatar">{message.role === 'user' ? 'You' : message.role === 'error' ? <CircleHelp size={18} /> : <Bot size={18} />}</div>
                    <div className="message-content">
                      <div className="message-author">{message.role === 'user' ? 'You' : message.role === 'error' ? 'Request error' : 'PaperPilot'}</div>
                      <div className="message-text">{message.text}</div>
                      {message.sources?.length > 0 && <div className="source-list"><div className="source-list-title"><BookOpen size={14} /> SOURCES USED</div>{message.sources.map((source, sourceIndex) => <div className="source-card" key={`${source.source_id}-${sourceIndex}`}><div className="source-card-top"><span className="source-badge">{source.source_id}</span><strong>{source.filename}</strong><span className="page-badge">Page {source.page}</span></div><p>{source.excerpt}</p><small>Similarity: {source.similarity.toFixed(3)} · Use this as a retrieval signal, not a confidence score.</small></div>)}</div>}
                    </div>
                  </div>
                ))}
                {asking && <div className="message-row assistant"><div className="message-avatar"><Bot size={18} /></div><div className="message-content"><div className="message-author">PaperPilot</div><div className="thinking"><LoaderCircle size={16} className="spin" /> Searching passages and asking local model…</div></div></div>}
                <div ref={chatEnd} />
              </div>
            )}
            {notice && <div className={`notice ${notice.type}`}><span>{notice.text}</span><button onClick={() => setNotice(null)} aria-label="Dismiss"><X size={15} /></button></div>}
            <div className="composer-wrap">
              {documents.length === 0 && <div className="composer-hint"><CircleHelp size={14} /> Upload at least one PDF before asking a question.</div>}
              <form className="composer" onSubmit={submitQuestion}>
                <textarea value={question} onChange={event => setQuestion(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submitQuestion(event) } }} placeholder="Ask a question about your research papers…" rows={1} disabled={!documents.length || asking} />
                <button className="send-button" type="submit" disabled={!question.trim() || !documents.length || asking} aria-label="Ask question">{asking ? <LoaderCircle size={18} className="spin" /> : <Send size={18} />}</button>
              </form>
              <div className="composer-footer"><span><ShieldCheck size={13} /> Answers grounded in uploaded sources</span><span>Enter to send · Shift + Enter for new line</span></div>
            </div>
          </section>
        )}
      </main>
      <input ref={fileInput} type="file" accept=".pdf,application/pdf" multiple hidden onChange={chooseFiles} />
    </div>
  )
}

function UploadPanel({ selectedFiles, chooseFiles, handleUpload, uploading, fileInput, documents, compact = false }) {
  return (
    <form className={`upload-panel ${compact ? 'compact' : ''}`} onSubmit={handleUpload}>
      {!compact && <div className="upload-dropzone" onClick={() => fileInput.current?.click()} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); chooseFiles({ target: { files: event.dataTransfer.files } }) }} role="button" tabIndex={0} onKeyDown={event => event.key === 'Enter' && fileInput.current?.click()}>
        <UploadCloud size={25} /><strong>Choose PDF files or drop them here</strong><span>Maximum 20 MB per file</span>
      </div>}
      {selectedFiles.length > 0 && <div className="selected-files">{selectedFiles.map(file => <div key={`${file.name}-${file.size}`}><FileText size={15} /><span>{file.name}</span><small>{formatBytes(file.size)}</small></div>)}</div>}
      {compact && selectedFiles.length === 0 && <button type="button" className="button button-secondary full-button" onClick={() => fileInput.current?.click()}><Plus size={15} /> Choose PDF files</button>}
      {selectedFiles.length > 0 && <button className="button button-primary full-button" type="submit" disabled={uploading}>{uploading ? <><LoaderCircle size={16} className="spin" /> Processing papers…</> : <><UploadCloud size={16} /> Upload {selectedFiles.length} file(s)</>}</button>}
      {!compact && <p className="upload-footnote"><ShieldCheck size={13} /> PDFs are processed locally by this application. Uploaded files are held in memory, not saved to disk.</p>}
    </form>
  )
}

function DocumentList({ documents, onRemove }) {
  if (!documents.length) return <div className="empty-library"><Files size={25} /><strong>No papers uploaded yet</strong><span>Upload PDFs to start building your research library.</span></div>
  return <div className="document-grid">{documents.map(document => <article className="document-card" key={document.id}><div className="document-icon"><FileText size={21} /></div><div className="document-info"><strong title={document.filename}>{document.filename}</strong><span>{document.pages_with_text} pages with text · {document.chunks} chunks</span><small><CheckCircle2 size={13} /> Ready for questions</small></div><button className="icon-button danger" title={`Remove ${document.filename}`} onClick={() => onRemove(document)}><Trash2 size={16} /></button></article>)}</div>
}

export default App
