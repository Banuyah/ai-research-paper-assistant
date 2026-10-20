from app.pdf_processor import chunk_pages


def test_chunk_pages_preserves_page_numbers():
    pages = [(2, "A" * 2500), (5, "B" * 100)]
    chunks = chunk_pages(pages, chunk_size=1000, overlap=100)
    assert chunks
    assert all(chunk.page == 2 for chunk in chunks if chunk.text.startswith("A"))
    assert any(chunk.page == 5 for chunk in chunks)
    assert chunks[0].page == 2


def test_chunk_pages_rejects_invalid_overlap():
    try:
        chunk_pages([(1, "hello")], chunk_size=100, overlap=100)
    except ValueError:
        return
    assert False, "Expected ValueError for overlap >= chunk_size"


def test_empty_pages_return_empty_chunks():
    assert chunk_pages([]) == []
