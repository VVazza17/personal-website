import json, os
from sentence_transformers import CrossEncoder

MODEL_NAME = os.getenv("RERANK_MODEL", "cross-encoder/ms-marco-MiniLM-L-6-v2")
BATCH = int(os.getenv("RERANK_BATCH", "16"))
model = CrossEncoder(MODEL_NAME)

def _resp(code, obj):
    return {"statusCode": code, "headers": {"Content-Type":"application/json"}, "body": json.dumps(obj)}

def handler(event, _ctx):
    try:
        body = event.get("body")
        if isinstance(body, (bytes, bytearray)): body = body.decode("utf-8")
        payload = json.loads(body) if isinstance(body, str) else (body or {})

        query = payload.get("query")
        cands = payload.get("candidates", [])
        top_k = int(payload.get("top_k", 4))

        if not query or not isinstance(cands, list):
            return _resp(400, {"error": "Provide 'query' and 'candidates' (list)"})

        pairs = [(query, c.get("content","")) for c in cands]
        scores = model.predict(pairs, batch_size=BATCH, show_progress_bar=False)
        for c, s in zip(cands, scores.tolist()):
            c["rerank_score"] = float(s)

        cands.sort(key=lambda x: x["rerank_score"], reverse=True)
        return _resp(200, {"results": cands[:top_k], "model": MODEL_NAME})
    except Exception as e:
        return _resp(500, {"error": str(e)})
