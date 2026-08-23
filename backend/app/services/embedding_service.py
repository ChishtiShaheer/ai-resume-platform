"""
Semantic similarity between a job description and a resume using
Sentence Transformers. The model is loaded lazily (once) since it's
the slowest import in the app.
"""
import logging
from functools import lru_cache
from typing import List

import numpy as np

from app.core.config import settings

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _get_model():
    from sentence_transformers import SentenceTransformer
    logger.info("Loading embedding model: %s", settings.EMBEDDING_MODEL)
    return SentenceTransformer(settings.EMBEDDING_MODEL)


def embed_texts(texts: List[str]) -> np.ndarray:
    model = _get_model()
    return model.encode(texts, convert_to_numpy=True, normalize_embeddings=True)


def cosine_similarity(vec_a: np.ndarray, vec_b: np.ndarray) -> float:
    # vectors are already normalized, so dot product == cosine similarity
    return float(np.dot(vec_a, vec_b))


def semantic_similarity(job_text: str, resume_text: str) -> float:
    """Returns a 0-100 semantic match score between job description and resume."""
    try:
        embeddings = embed_texts([job_text, resume_text])
        sim = cosine_similarity(embeddings[0], embeddings[1])
        # cosine sim for sentence-transformers is typically in [~0, 1] for related text;
        # clip and rescale to a friendlier 0-100 range.
        score = max(0.0, min(1.0, sim)) * 100
        return round(score, 2)
    except Exception as e:
        logger.error("Semantic similarity failed, defaulting to 0: %s", e)
        return 0.0
