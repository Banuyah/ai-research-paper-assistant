async function parseResponse(response) {
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = data.detail || data.message || `Request failed (${response.status})`
    throw new Error(typeof message === 'string' ? message : JSON.stringify(message))
  }
  return data
}

export async function getHealth() {
  return parseResponse(await fetch('/api/health'))
}

export async function getDocuments() {
  return parseResponse(await fetch('/api/documents'))
}

export async function uploadPdfs(files) {
  const form = new FormData()
  for (const file of files) form.append('files', file)
  return parseResponse(await fetch('/api/documents', { method: 'POST', body: form }))
}

export async function deleteDocument(id) {
  return parseResponse(await fetch(`/api/documents/${id}`, { method: 'DELETE' }))
}

export async function askQuestion(question) {
  return parseResponse(await fetch('/api/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  }))
}
