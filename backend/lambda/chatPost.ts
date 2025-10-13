import { APIGatewayProxyEvent } from "aws-lambda";
import { randomUUID, createHash } from "crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { Client as PgClient } from "pg";

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const lambdaClient = new LambdaClient({});

const TABLE = process.env.TABLE_NAME!;
const CACHE = process.env.DDB_TABLE!;
const PG_CONN = process.env.PG_CONN!;
const PG_SCHEMA = process.env.PG_SCHEMA || "public";
const EMBED_FN_NAME = process.env.EMBED_FN_NAME!;
const CACHE_TTL_HOURS = Number(process.env.CACHE_TTL_HOURS || "48");
const USE_RERANK = (process.env.USE_RERANK || "false").toLowerCase() === "true";
const RERANK_FN_NAME = process.env.RERANK_FN_NAME;
const GEN_FN_NAME = process.env.GEN_FN_NAME;

const CORS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
};

// ---------- helpers ----------
function normalizeQuestion(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, " ");
}

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

async function cacheGet(key: string) {
  const res = await doc.send(new GetCommand({ TableName: CACHE, Key: { pk: key } }));
  return res.Item as any | undefined;
}

async function cachePut(key: string, value: any) {
  const ttl = Math.floor(Date.now() / 1000) + CACHE_TTL_HOURS * 3600;
  await doc.send(new PutCommand({
    TableName: CACHE,
    Item: { pk: key, value, ttl, createdAt: new Date().toISOString() }
  }));
}

async function embedText(text: string): Promise<number[]> {
  const payload = { text };
  const cmd = new InvokeCommand({
    FunctionName: EMBED_FN_NAME,
    Payload: Buffer.from(JSON.stringify({ body: JSON.stringify(payload) })),
  });
  const res = await lambdaClient.send(cmd);
  const outer = JSON.parse(Buffer.from(res.Payload as Uint8Array).toString() || "{}");
  if (outer.statusCode !== 200) throw new Error(`Embed error: ${outer.body}`);
  const inner = JSON.parse(outer.body);
  return inner.embeddings[0] as number[];
}

function vecToPg(v: number[]) {
  return "[" + v.map((x) => x.toFixed(6)).join(",") + "]";
}

async function knn(queryVec: number[]) {
  const client = new PgClient({ connectionString: PG_CONN, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const sql = `
    SELECT title, url, chunk_id, content,
           1 - (embedding <=> $1::vector) AS similarity
    FROM ${PG_SCHEMA}.chunks
    ORDER BY embedding <=> $1::vector
    LIMIT 12;
  `;
  const { rows } = await client.query(sql, [vecToPg(queryVec)]);
  await client.end();
  return rows;
}

async function rerank(query: string, cands: any[]): Promise<any[]> {
  if (!USE_RERANK || !RERANK_FN_NAME) return cands;
  const payload = { query, candidates: cands, top_k: 4 };
  const res = await lambdaClient.send(new InvokeCommand({
    FunctionName: RERANK_FN_NAME,
    Payload: Buffer.from(JSON.stringify({ body: JSON.stringify(payload) })),
  }));
  const outer = JSON.parse(Buffer.from(res.Payload as Uint8Array).toString() || "{}");
  if (outer.statusCode !== 200) return cands;
  const inner = JSON.parse(outer.body);
  return inner.results || cands;
}

async function generateAnswer(question: string, contexts: any[]) {
  if (!GEN_FN_NAME) return null;
  const payload = { question, contexts: contexts.map(c => ({ title: c.title, content: c.content })), max_new_tokens: 120 };
  const res = await lambdaClient.send(new InvokeCommand({
    FunctionName: GEN_FN_NAME,
    Payload: Buffer.from(JSON.stringify({ body: JSON.stringify(payload) })),
  }));
  const outer = JSON.parse(Buffer.from(res.Payload as Uint8Array).toString() || "{}");
  if (outer.statusCode !== 200) return null;
  const inner = JSON.parse(outer.body);
  return inner.answer as string;
}

export const handler = async (event: APIGatewayProxyEvent) => {
    try {
        const body = event.body ? JSON.parse(event.body) : {};
        const { sessionId, message } = body;
        
        if (!sessionId || typeof message !== "string") { 
            return {
                statusCode: 400,
                headers: CORS, 
                body: JSON.stringify({ error: "sessionId and message are required" }), 
            };
        }

        const now = new Date().toISOString();
        const id  = randomUUID();

        // 1) log user to main table
        await doc.send(new PutCommand({
        TableName: TABLE,
        Item: {
            PK: `CHAT#${sessionId}`,
            SK: `${now}#${id}`,
            type: "chat",
            role: "user",
            message,
            createdAt: now
        }
        }));

        // 2) cache lookup (normalized)
        const normalized = normalizeQuestion(message);
        const cacheKey = `q:${sha256(normalized)}`;
        const cached = await cacheGet(cacheKey);
        if (cached?.value) {
            return { statusCode: 200, headers: CORS, body: JSON.stringify({ ...cached.value, cached: true }) };
        }

         // 3) embed question
        const t0 = Date.now();
        const qVec = await embedText(message);

        // 4) kNN in Neon
        const rows = await knn(qVec);

        // 5) Build rough candidates from kNN
        const rough = rows.slice(0, 8).map((r: any) => ({
          id: r.chunk_id, 
          title: r.title, 
          url: r.url,
          content: r.content, 
          preview: (r.content||"").slice(0, 220),
          similarity: Number((r.similarity ?? 0).toFixed(3)),
        }));

        // 6) Rerank
        const top = await rerank(message, rough);

        // 7) Generate final answer
        const llmAnswer = await generateAnswer(message, top.slice(0, 4));
        const answer = llmAnswer ?? (
          `Found ${rows.length} relevant snippets (generator fallback).\n` +
          top.map((t: any, i: number) => `[${i + 1}] ${t.title} — ${t.preview}...`).join("\n")
        );

        const value = { answer, sources: top.slice(0, 6), latency_ms: Date.now() - t0 };

        // 8) cache it
        await cachePut(cacheKey, value);

        // 9) return built value
        return {
            statusCode: 200,
            headers: CORS,
            body: JSON.stringify({ ...value, id, createdAt: now, cached: false })
        };

    }   catch (e) {
        console.error(e);
        return { 
            statusCode: 500, 
            headers: CORS, 
            body: JSON.stringify({ error:"Internal" }),
        };
    }
};
