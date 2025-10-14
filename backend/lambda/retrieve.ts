import { APIGatewayProxyEvent } from "aws-lambda";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { Client as PgClient } from "pg";

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

const PG_CONN   = process.env.PG_CONN!;
const PG_SCHEMA = process.env.PG_SCHEMA || "public";
const EMBED_FN  = process.env.EMBED_FN_NAME!;

const lambda = new LambdaClient({});

const INTENT_EXPERIENCE = /\b(intern(ship)?|experience|work|job|co-?op|placement)\b/i;

function cleanSnippet(t: string, max = 600) {
  return (t || "")
    .replace(/\s+/g, " ")
    .replace(/https?\s*:\s*\/\s*\/\s*/g, "https://")
    .slice(0, max);
}

function vecToPg(v: number[]) {
  return "[" + v.map((x) => x.toFixed(6)).join(",") + "]";
}

async function embed(text: string): Promise<number[]> {
  const payload = { text };
  const cmd = new InvokeCommand({
    FunctionName: EMBED_FN,
    Payload: Buffer.from(JSON.stringify({ body: JSON.stringify(payload) })),
  });
  const res = await lambda.send(cmd);
  const outer = JSON.parse(Buffer.from(res.Payload as Uint8Array).toString() || "{}");
  if (outer.statusCode !== 200) throw new Error(`embed failed: ${outer.body}`);
  const inner = JSON.parse(outer.body);
  return inner.embeddings[0] as number[];
}

export const handler = async (event: APIGatewayProxyEvent) => {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const q = (body.q || body.query || "").toString().trim();
    if (!q) {
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ snippets: [] }) };
    }

    const t0 = Date.now();
    const qvec = await embed(q);

    const client = new PgClient({ connectionString: PG_CONN, ssl: { rejectUnauthorized: false } });
    await client.connect();

    const k = 6;
    const bias = INTENT_EXPERIENCE.test(q);

    const sql = bias
      ? `
        WITH base AS (
          SELECT id, title, url, content, section,
                 1 - (embedding <=> $1::vector) AS score
          FROM ${PG_SCHEMA}.chunks
          ORDER BY embedding <=> $1::vector
          LIMIT ${k * 3}
        )
        SELECT *, score + CASE WHEN section = 'experience' THEN 0.15 ELSE 0 END AS bscore
        FROM base
        ORDER BY bscore DESC
        LIMIT ${k};
      `
      : `
        SELECT id, title, url, content, section,
               1 - (embedding <=> $1::vector) AS score
        FROM ${PG_SCHEMA}.chunks
        ORDER BY embedding <=> $1::vector
        LIMIT ${k};
      `;

    const { rows } = await client.query(sql, [vecToPg(qvec)]);
    await client.end();

    const snippets = rows.slice(0, 5).map((r: any, i: number) => ({
      id: `S${i + 1}`,
      title: r.title || r.section || "Snippet",
      section: r.section || null,
      url: r.url || null,
      text: cleanSnippet(r.content),
      score: Number((r.score ?? 0).toFixed(3)),
    }));

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ snippets, latency_ms: Date.now() - t0 }),
    };
  } catch (e) {
    console.error(e);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "retrieve failed" }) };
  }
};