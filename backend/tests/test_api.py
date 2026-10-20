from fastapi.testclient import TestClient
from app.main import app


def test_health_endpoint():
    client = TestClient(app)
    response = client.get("/api/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert "ollama_available" in payload


def test_documents_endpoint_starts_empty_or_returns_list():
    client = TestClient(app)
    response = client.get("/api/documents")
    assert response.status_code == 200
    assert isinstance(response.json()["documents"], list)
