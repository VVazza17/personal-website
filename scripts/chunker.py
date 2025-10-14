import argparse, hashlib, io, json, os, re, sys, unicodedata
from datetime import datetime, UTC
from typing import List, Dict, Any
import boto3
from bs4 import BeautifulSoup
import markdown as md
from pypdf import PdfReader

# S3 helpers
def read_s3_bytes(bucket: str, key: str) -> bytes:
    s3 = boto3.client("s3")
    obj = s3.get_object(Bucket=bucket, Key=key)
    return obj["Body"].read()

def load_text_from_s3(bucket: str, key: str) -> str:
    ext = os.path.splitext(key)[1].lower()
    raw = read_s3_bytes(bucket, key)
    if ext == ".pdf":
        return pdf_to_text(raw)
    else:
        return raw.decode("utf-8", errors="ignore")

def write_s3_text(bucket: str, key: str, text: str):
    s3 = boto3.client("s3")
    s3.put_object(Bucket=bucket, Key=key, Body=text.encode("utf-8"), ContentType="application/json")

def list_s3_keys(bucket: str, prefix: str) -> List[str]:
    s3 = boto3.client("s3")
    keys, token = [], None
    while True:
        kwargs = {"Bucket": bucket, "Prefix": prefix}
        if token:
            kwargs["ContinuationToken"] = token
        resp = s3.list_objects_v2(**kwargs)
        for it in resp.get("Contents", []):
            k = it["Key"]
            if k.lower().endswith((".md", ".markdown", ".html", ".htm", ".txt", ".pdf")):
                keys.append(k)
        if resp.get("IsTruncated"):
            token = resp.get("NextContinuationToken")
        else:
            break
    return keys

# Extraction/normalization
def md_or_html_to_text(content: str, ext: str) -> str:
    if ext.lower() in [".md", ".markdown"]:
        html = md.markdown(content)
        text = BeautifulSoup(html, "html.parser").get_text(separator="\n")
    elif ext.lower() in [".html", ".htm"]:
        text = BeautifulSoup(content, "html.parser").get_text(separator="\n")
    else:
        text = content
    # light whitespace tidy first
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    # then full normalization
    return normalize_text(text.strip())

def pdf_to_text(content_bytes: bytes) -> str:
    reader = PdfReader(io.BytesIO(content_bytes))
    pages = []
    for p in reader.pages:
        try:
            pages.append(p.extract_text() or "")
        except Exception:
            pages.append("")
    text = "\n\n".join(pages)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return normalize_text(text.strip())

_BULLETS = ["•", "●", "▪", "◦", "‣"]
_SOFT = "\u00ad"
_SENT_SPLIT = re.compile(r"(?<=[\.!?])\s+(?=[A-Z(\"\']))")

def normalize_text(s: str) -> str:
    if not s:
        return s
    s = unicodedata.normalize("NFKC", s)

    s = s.replace(_SOFT, "")
    s = re.sub(r"-\s*\n\s*", "-", s)

    for b in _BULLETS:
        s = s.replace(b, "- ")

    s = s.replace("\r", "")
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r"\n{3,}", "\n\n", s)

    s = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", s)
    s = re.sub(r"(?<=[0-9])(?=[A-Za-z])", " ", s)
    s = re.sub(r"(?<=[A-Za-z])(?=[0-9])", " ", s)

    s = re.sub(r"\s+([,.;:!?])", r"\1", s)
    s = re.sub(r"([,.;:!?])([A-Za-z])", r"\1 \2", s)

    s = re.sub(r"\s+", " ", s)
    s = re.sub(r"(\n\s*)+", "\n", s)
    return s.strip()

def split_sentences(s: str) -> List[str]:
    parts = []
    for para in s.split("\n"):
        para = para.strip()
        if not para:
            continue
        parts.extend(_SENT_SPLIT.split(para))
    return [p.strip() for p in parts if p.strip()]

def est_tokens(s: str) -> int:
    return max(1, len(s) // 4)

# Chunking
def chunk_text(text: str, max_tokens: int = 600, overlap: int = 50) -> List[str]:
    """
    Sentence-aware packer: fills chunks up to ~max_tokens (rough estimate),
    with sentence overlap for recall.
    """
    sents = split_sentences(text)
    if not sents:
        return []

    chunks, cur, cur_tok = [], [], 0
    for sent in sents:
        t = est_tokens(sent)
        if cur and (cur_tok + t > max_tokens):
            chunks.append(" ".join(cur).strip())
            back, btok = [], 0
            for s in reversed(cur):
                st = est_tokens(s)
                if btok + st > overlap:
                    break
                back.append(s)
                btok += st
            cur = list(reversed(back))
            cur_tok = sum(est_tokens(s) for s in cur)

        cur.append(sent)
        cur_tok += t

    if cur:
        chunks.append(" ".join(cur).strip())

    return chunks

def stable_chunk_id(doc_key: str, idx: int) -> str:
    h = hashlib.sha256(f"{doc_key}::{idx}".encode("utf-8")).hexdigest()[:16]
    return f"{h}-{idx:04d}"

# Pipeline
def guess_doc_type(key: str) -> str:
    name = key.lower()
    if "resume" in name or "cv" in name: return "resume"
    if "project" in name or "portfolio" in name: return "projects"
    if "bio" in name or "about" in name: return "bio"
    if "faq" in name or "qna" in name: return "faq"
    return "doc"

def process_doc(bucket: str, key: str, title_hint: str, base_url: str, max_tokens: int, overlap: int) -> List[Dict[str, Any]]:
    raw = load_text_from_s3(bucket, key)
    ext = os.path.splitext(key)[1]
    text = md_or_html_to_text(raw, ext)
    parts = chunk_text(text, max_tokens=max_tokens, overlap=overlap)

    items: List[Dict[str, Any]] = []
    for i, content in enumerate(parts):
        items.append({
            "id": None,
            "title": title_hint or os.path.basename(key),
            "url": f"{base_url}/{os.path.basename(key)}" if base_url else None,
            "chunk_id": stable_chunk_id(key, i),
            "content": content,
            "section": guess_doc_type(key),
            "metadata": {
                "src_key": key,
                "lang": "en",
                "docType": guess_doc_type(key),
                "chunk_index": i,
                "n_chunks": len(parts),
                "updated_at": datetime.now(UTC).isoformat()
            }
        })
    return items

# CLI
def main():
    ap = argparse.ArgumentParser(description="Chunk Markdown/HTML/TXT/PDF from S3 into JSONL.")
    ap.add_argument("--bucket", required=True, help="S3 bucket name")
    ap.add_argument("--prefix-raw", default="raw/", help="S3 prefix of input docs")
    ap.add_argument("--prefix-out", default="chunked/", help="S3 prefix for output JSONL")
    ap.add_argument("--base-url", default="", help="Optional base URL to store as 'url' field")
    ap.add_argument("--max-tokens", type=int, default=600)
    ap.add_argument("--overlap", type=int, default=50)
    ap.add_argument("--dry-run", action="store_true", help="Print sample JSONL locally instead of S3 write")
    args = ap.parse_args()

    keys = list_s3_keys(args.bucket, args.prefix_raw)
    if not keys:
        print(f"No input docs found under s3://{args.bucket}/{args.prefix_raw}", file=sys.stderr)
        sys.exit(1)

    all_items: List[Dict[str, Any]] = []
    for k in keys:
        title_hint = os.path.splitext(os.path.basename(k))[0].replace("-", " ").title()
        items = process_doc(args.bucket, k, title_hint, args.base_url, args.max_tokens, args.overlap)
        all_items.extend(items)

    out_key = f"{args.prefix_out.rstrip('/')}/chunks.jsonl"
    buf = io.StringIO()
    for it in all_items:
        buf.write(json.dumps(it, ensure_ascii=False) + "\n")

    if args.dry_run:
        print(buf.getvalue()[:2000])
    else:
        write_s3_text(args.bucket, out_key, buf.getvalue())
        print(f"Wrote {len(all_items)} chunks → s3://{args.bucket}/{out_key}")

if __name__ == "__main__":
    main()