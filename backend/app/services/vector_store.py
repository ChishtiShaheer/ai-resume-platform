"""
Lightweight vector index (ChromaDB) over job + candidate text, powering
the recruiter AI assistant's retrieval step. Falls back to a simple
in-memory keyword search if ChromaDB isn't available, so the assistant
endpoint never hard-fails.
"""
import logging
from typing import List, Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

_client = None
_collection = None
_memory_store: List[dict] = []  # fallback: [{"id":..., "text":..., "job_id":...}]


def _get_collection():
    global _client, _collection
    if _collection is not None:
        return _collection
    try:
        import chromadb
        _client = chromadb.PersistentClient(path=settings.VECTOR_STORE_DIR)
        _collection = _client.get_or_create_collection("candidates_and_jobs")
        return _collection
    except Exception as e:
        logger.warning("ChromaDB unavailable (%s) — using in-memory fallback search.", e)
        return None


def index_document(doc_id: str, text: str, job_id: Optional[str] = None, metadata: Optional[dict] = None):
    collection = _get_collection()
    meta = {"job_id": str(job_id) if job_id else "", **(metadata or {})}
    if collection is not None:
        try:
            collection.upsert(ids=[doc_id], documents=[text[:8000]], metadatas=[meta])
            return
        except Exception as e:
            logger.warning("Chroma upsert failed, falling back to memory: %s", e)
    _memory_store.append({"id": doc_id, "text": text, **meta})


def search(query: str, job_id: Optional[str] = None, top_k: int = 5) -> List[str]:
    collection = _get_collection()
    if collection is not None:
        try:
            where = {"job_id": str(job_id)} if job_id else None
            results = collection.query(query_texts=[query], n_results=top_k, where=where)
            docs = results.get("documents", [[]])[0]
            return docs
        except Exception as e:
            logger.warning("Chroma query failed, falling back to memory: %s", e)

    # naive keyword fallback
    scored = []
    q_terms = set(query.lower().split())
    for item in _memory_store:
        if job_id and item.get("job_id") != str(job_id):
            continue
        overlap = len(q_terms & set(item["text"].lower().split()))
        if overlap:
            scored.append((overlap, item["text"]))
    scored.sort(key=lambda x: -x[0])
    return [t for _, t in scored[:top_k]]
