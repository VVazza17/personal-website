import json, os, numpy as np
from sentence_transformers import SentenceTransformer

MODEL_NAME = os.getenv("EMBED_MODEL", "intfloat/e5-small-v2")
model = SentenceTransformer(MODEL_NAME)

CACHE_DIR = os.getenv("TRANSFORMERS_CACHE", "/tmp/hf")
os.makedirs(CACHE_DIR, exist_ok=True)

model = SentenceTransformer(MODEL_NAME, cache_folder=CACHE_DIR)

def _l2(x: np.ndarray) -> np.ndarray:
    n = np.linalg.norm(x, axis=-1, keepdims=True) + 1e-12
    return x / n

def handler(event, _ctx):
    try:
        body = event.get("body")
        if isinstance(body, (bytes, bytearray)): body = body.decode("utf-8")
        payload = json.loads(body) if isinstance(body, str) else (body or {})
        texts = payload.get("texts") or ([payload["text"]] if payload.get("text") else None)
        if not texts: return _resp(400, {"error":"Provide 'text' or 'texts' (list)"})

        prefixed = ["query: " + t for t in texts]
        vecs = model.encode(prefixed, convert_to_numpy=True, normalize_embeddings=False)
        vecs = _l2(vecs)
        return _resp(200, {"embeddings": vecs.tolist(), "dim": int(vecs.shape[-1]), "model": MODEL_NAME})
    except Exception as e:
        return _resp(500, {"error": str(e)})

def _resp(code, obj):
    return {"statusCode": code, "headers":{"Content-Type":"application/json"}, "body": json.dumps(obj)}
