from pydantic import BaseModel, Field


class AskRequest(BaseModel):
    question: str = Field(min_length=3, max_length=2000)


class Source(BaseModel):
    source_id: str
    filename: str
    page: int
    similarity: float
    excerpt: str


class AskResponse(BaseModel):
    answer: str
    sources: list[Source]
    used_ollama: bool
