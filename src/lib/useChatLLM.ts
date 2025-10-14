import { getEngine } from "./llm";

const SYSTEM = `You are a friendly, concise assistant.
Use the provided context when relevant and cite like (S1).
If unsure, say so briefly.`;

function buildContext(snippets: {id:string; title:string; text:string}[]) {
  return [
    "Context (cite as S1..):",
    ...snippets.map(s => `[${s.id}] ${s.title} — ${s.text}`)
  ].join("\n");
}

export async function streamAnswer(
  prompt: string,
  snippets: { id: string; title: string; text: string }[],
  onToken: (t: string) => void
) {
  const engine = await getEngine();

  const messages = [
    { role: "system", content: SYSTEM },
    { role: "assistant", content: "Example:\nContext:\n[S1] Resume — \"Software Engineering student at Carleton\"\nUser: hi kyle\nAssistant: Hey! I’m Kyle. I can help with internships, projects, or interview prep—what should we start with? (S1)" },
    { role: "assistant", content: buildContext(snippets) },
    { role: "user", content: prompt + "\n\nRespond conversationally in 3–6 sentences. If asked about internships, list company and role. Include at most one short citation like (S1). Never output only IDs." },
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
