import argparse, hashlib, io, json, os, re, sys
from datetime import datetime, UTC
from typing import List, Dict, Any, Tuple
import boto3
from bs4 import BeautifulSoup
import markdown as md
from pypdf import PdfReader

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
    keys = []
    token = None
    while True:
        kwargs = {"Bucket": bucket, "Prefix": prefix}
        if token: kwargs["ContinuationToken"] = token
        resp = s3.list_objects_v2(**kwargs)
        for it in resp.get("Contents", []):
            key = it["Key"]
            if key.lower().endswith((".md", ".markdown", ".html", ".htm", ".txt", ".pdf")):
                keys.append(key)
        if resp.get("IsTruncated"):
            token = resp.get("NextContinuationToken")
        else:
            break
    return keys

def md_or_html_to_text(content: str, ext: str) -> str:
    if ext.lower() in [".md", ".markdown"]:
        html = md.markdown(content)
        text = BeautifulSoup(html, "html.parser").get_text(separator="\n")
    elif ext.lower() in [".html", ".htm"]:
        text = BeautifulSoup(content, "html.parser").get_text(separator="\n")
    else:
        text = content
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()

def pdf_to_text(content_bytes: bytes) -> str:
    from io import BytesIO
    reader = PdfReader(BytesIO(content_bytes))
    pages = []
    for p in reader.pages:
        try:
            pages.append(p.extract_text() or "")
        except Exception:
            pages.append("")
    text = "\n\n".join(pages)
    return re.sub(r"\n{3,}", "\n\n", text).strip()

def rough_tokenize(s: str) -> List[str]:
    return re.findall(r"[A-Za-z0-9]+|[^\sA-Za-z0-9]", s)

def chunk_text(text: str, max_tokens: int = 600, overlap: int = 50) -> List[str]:
    toks = rough_tokenize(text)
    chunks = []
    start = 0
    n = len(toks)
    if n == 0:
        return []
    while start < n:
        end = min(n, start + max_tokens)
        chunk = "".join(toks[start:end]).replace("##", "")
        chunk = " ".join(re.findall(r"[A-Za-z0-9]+|[^\sA-Za-z0-9]", chunk))
        chunks.append(chunk.strip())
        if end == n:
            break
        start = max(0, end - overlap)
    return [c for c in chunks if c]

def stable_chunk_id(doc_key: str, idx: int) -> str:
    h = hashlib.sha256(f"{doc_key}::{idx}".encode("utf-8")).hexdigest()[:16]
    return f"{h}-{idx:04d}"


def process_doc(bucket: str, key: str, title_hint: str, base_url: str, max_tokens: int, overlap: int) -> List[Dict[str, Any]]:
    raw = load_text_from_s3(bucket, key)
    ext = os.path.splitext(key)[1]
    text = md_or_html_to_text(raw, ext)
    parts = chunk_text(text, max_tokens=max_tokens, overlap=overlap)
    items = []
    for i, content in enumerate(parts):
        items.append({
            "id": None,
            "title": title_hint or os.path.basename(key),
            "url": f"{base_url}/{os.path.basename(key)}" if base_url else None,
            "chunk_id": stable_chunk_id(key, i),
            "content": content,
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

def guess_doc_type(key: str) -> str:
    name = key.lower()
    if "resume" in name or "cv" in name: return "resume"
    if "project" in name or "portfolio" in name: return "projects"
    if "bio" in name or "about" in name: return "bio"
    if "faq" in name or "qna" in name: return "faq"
    return "doc"

def main():
    ap = argparse.ArgumentParser(description="Chunk Markdown/HTML/TXT from S3 into JSONL.")
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

    all_items = []
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
