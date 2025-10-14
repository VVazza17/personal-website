import { getEngine } from "./llm";

const SYSTEM = `You are "Kyle", a friendly, concise assistant.
- Speak naturally in full sentences.
- Use provided context only if it clearly helps answer the user's question.
- If you use a fact from a source, cite it inline like (S1). Otherwise, don't cite.
- Never output just IDs like [1], [2]. Never echo the context or copy contact info.
- If the user is just greeting you, greet them back and offer help.`;

function buildContext(snips: {id:string; title:string; text:string}[]) {
  if (!snips?.length) return "";
  const lines = snips.map(s => `[${s.id}] ${s.title} — ${s.text}`);
  return `Context (cite as S1..):\n${lines.join("\n")}`;
}

export async function streamAnswer(prompt: string, snippets: {id:string;title:string;text:string}[], onToken: (t: string)=>void) {
  const engine = await getEngine();

  const contextBlock = buildContext(snippets);
  const messages = [
    { role: "system", content: SYSTEM },
    { role: "assistant", content: "Example:\nUser: hi kyle\nAssistant: Hey! I’m Kyle. I can help with questions about my internships and projects." },
    ...(contextBlock ? [{ role: "assistant", content: contextBlock }] : []),
    { role: "user", content: `${prompt}
Respond conversationally in 3–6 sentences. Do not list source IDs. Include at most one short citation like (S1) only if using a fact from the context.` }
  ];

  await engine.chat.completions.create({
    messages,
    stream: true,
    temperature: 0.7,
    top_p: 0.9,
    max_tokens: 320,
    onToken: (t: string) => onToken(t),
  });
}

