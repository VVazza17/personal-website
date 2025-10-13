import json, os, torch
from transformers import T5ForConditionalGeneration, T5TokenizerFast

MODEL_NAME = os.getenv("GEN_MODEL", "google/flan-t5-base")  # small->base are fine on CPU
DEVICE = "cpu"

tokenizer = T5TokenizerFast.from_pretrained(MODEL_NAME)
model = T5ForConditionalGeneration.from_pretrained(MODEL_NAME).to(DEVICE)

def _resp(code, obj):
    return {"statusCode": code, "headers":{"Content-Type":"application/json"}, "body": json.dumps(obj)}

PROMPT_TMPL = """You are a helpful assistant. Answer the question using ONLY the given context.
- If the context is insufficient, say you don't know.
- Quote or paraphrase briefly. Add bracketed source numbers like [1], [2] matching the context list.
- Be concise.

Question: {question}

Context:
{contexts}

Answer:"""

def make_context_block(contexts):
    # contexts: list of {"content": "...", "title": "..."} already reranked
    lines = []
    for i, c in enumerate(contexts, start=1):
        snippet = c.get("content","").strip().replace("\n", " ")
        title = c.get("title") or ""
        lines.append(f"[{i}] ({title}) {snippet}")
    return "\n".join(lines)

def handler(event, _ctx):
    try:
        body = event.get("body")
        if isinstance(body, (bytes, bytearray)): body = body.decode("utf-8")
        payload = json.loads(body) if isinstance(body, str) else (body or {})

        question = payload.get("question")
        contexts = payload.get("contexts", [])  # list of dicts with 'content' and (optionally) 'title'
        max_new = int(payload.get("max_new_tokens", 256))

        if not question or not isinstance(contexts, list):
            return _resp(400, {"error": "Provide 'question' and 'contexts' (list)"})

        prompt = PROMPT_TMPL.format(
            question=question.strip(),
            contexts=make_context_block(contexts[:6])  # cap to ~6 passages
        )

        inputs = tokenizer(prompt, return_tensors="pt", truncation=True, max_length=1024)
        outputs = model.generate(
            **inputs,
            max_new_tokens=max_new,
            temperature=float(payload.get("temperature", 0.2)),
            do_sample=False,
        )
        text = tokenizer.decode(outputs[0], skip_special_tokens=True)
        return _resp(200, {"answer": text, "model": MODEL_NAME})
    except Exception as e:
        return _resp(500, {"error": str(e)})
