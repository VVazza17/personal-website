import os, json, io, math, boto3, hashlib
from typing import List, Dict, Any
from tqdm import tqdm
from dotenv import load_dotenv, find_dotenv

import numpy as np
import psycopg
from psycopg.rows import dict_row
from sentence_transformers import SentenceTransformer

if os.path.exists(".env.local"):
    load_dotenv(".env.local", override=False)
else:
    load_dotenv(find_dotenv(usecwd=True), override=False)

S3_BUCKET   = os.getenv("S3_BUCKET")
PG_CONN     = os.getenv("PG_CONN")
PG_SCHEMA   = os.getenv("PG_SCHEMA", "public")
CHUNKED_KEY = os.getenv("CHUNKED_KEY", "chunked/chunks.jsonl")
MODEL_NAME  = os.getenv("EMBED_MODEL", "intfloat/e5-small-v2")
BATCH       = int(os.getenv("EMBED_BATCH", "32"))

def s3_read_text(bucket: str, key: str) -> str:
    s3 = boto3.client("s3")
    obj = s3.get_object(Bucket=bucket, Key=key)
    return obj["Body"].read().decode("utf-8")

def l2_normalize(mat: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(mat, axis=1, keepdims=True) + 1e-12
    return mat / norms

def vec_to_pg(v: np.ndarray) -> str:
    return "[" + ",".join(f"{x:.6f}" for x in v.tolist()) + "]"

def upsert_chunks(conn, rows: List[Dict[str, Any]]):
    with conn.cursor() as cur:
        for r in rows:
            cur.execute(
                f"""
                INSERT INTO {PG_SCHEMA}.chunks (title, url, chunk_id, content, metadata, embedding)
                VALUES (%s, %s, %s, %s, %s, %s::vector)
                ON CONFLICT (chunk_id) DO UPDATE
                SET title = EXCLUDED.title,
                    url = EXCLUDED.url,
                    content = EXCLUDED.content,
                    metadata = EXCLUDED.metadata,
                    embedding = EXCLUDED.embedding,
                    updated_at = now();
                """,
                (
                    r["title"], r.get("url"), r["chunk_id"],
                    r["content"], json.dumps(r["metadata"]),
                    vec_to_pg(r["embedding"])
                )
            )
        conn.commit()

def main():
    if not S3_BUCKET or not PG_CONN:
        raise SystemExit("Set S3_BUCKET and PG_CONN in .env")

    print(f"Loading chunks JSONL from s3://{S3_BUCKET}/{CHUNKED_KEY}")
    txt = s3_read_text(S3_BUCKET, CHUNKED_KEY)
    docs = [json.loads(line) for line in txt.splitlines() if line.strip()]
    print(f"Found {len(docs)} chunks")

    texts = [f"query: {d['content']}" for d in docs]
    model = SentenceTransformer(MODEL_NAME)
    print(f"Loaded model: {MODEL_NAME}")

    embs: List[np.ndarray] = []
    for i in tqdm(range(0, len(texts), BATCH), desc="Embedding"):
        batch_texts = texts[i:i+BATCH]
        batch_vecs = model.encode(
            batch_texts,
            batch_size=len(batch_texts),
            show_progress_bar=False,
            convert_to_numpy=True,
            normalize_embeddings=False
        )
        embs.append(batch_vecs)
    mat = np.vstack(embs)
    mat = l2_normalize(mat)

    for d, v in zip(docs, mat):
        d["embedding"] = v

    print("Connecting to Postgres…")
    with psycopg.connect(PG_CONN, row_factory=dict_row) as conn:
        upsert_chunks(conn, docs)

    print("Done. Upserted embeddings for", len(docs), "chunks.")

if __name__ == "__main__":
    main()
