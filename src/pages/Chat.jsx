import { useEffect, useRef, useState } from "react";
import { sendChatMessage, retrieveSnippets } from "../lib/api";
import { getSessionId } from "../lib/session";
import { hasWebGPU } from "../lib/llm";
import { streamAnswer } from "../lib/useChatLLM";
import { isChitChat } from "../lib/intent";

export default function Chat() {
  useEffect(() => { document.title = "Chat | Kyle Deng"; }, []);

  useEffect(() => {
    if (hasWebGPU()) {
      import("../lib/llm").then(m => m.getEngine().catch(console.error));
    }
  }, []);

  const sessionId = getSessionId();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [useLocalLLM, setUseLocalLLM] = useState(hasWebGPU());
  const listRef = useRef(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function handleSend(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    setMessages(m => [...m, { role: "user", text }]);
    setInput("");

    try {
      if (useLocalLLM) {
        let snippets = [];
        let retrievalMs = 0;
        if (!isChitChat(text)) {
          const r = await retrieveSnippets(text);
          snippets = r?.snippets ?? [];
          retrievalMs = r?.latency_ms ?? 0;
        }

        let botIndex = -1;
        setMessages(m => {
          botIndex = m.length;
          return [
            ...m,
            { role: "bot", text: "", sources: snippets, meta: { retrieval_ms: retrievalMs, mode: "local" } },
          ];
        });

        let acc = "";
        await streamAnswer(text, snippets, (tok) => {
          acc += tok;
          setMessages(m => {
            const copy = m.slice();
            const i = botIndex >= 0 ? botIndex : copy.length - 1;
            copy[i] = { ...copy[i], text: acc };
            return copy;
          });
        });

        return;
      }

      const res = await sendChatMessage({ sessionId, message: text });
      setMessages(m => [
        ...m,
        { role: "bot", text: res.answer, sources: res.sources, meta: { latency: res.latency_ms, cached: res.cached, mode: "server" } },
      ]);
    } catch (err) {
      console.error(err);
      setMessages(m => [...m, { role: "bot", text: "Sorry, temporary error. Try again." }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-2xl font-semibold">Chat</h1>
        <label className="text-xs opacity-70 flex items-center gap-2">
          <input
            type="checkbox"
            checked={useLocalLLM}
            onChange={e => setUseLocalLLM(e.target.checked && hasWebGPU())}
          />
          Use local model (WebGPU){!hasWebGPU() ? " — not supported in this browser" : ""}
        </label>
      </div>

      <div ref={listRef} className="max-h-[60vh] overflow-auto space-y-3">
        {messages.length === 0 && <p className="text-white/60">Start a conversation.</p>}
        {messages.map((m, i) => (
          <div key={i} className={`rounded-lg px-3 py-2 ${m.role === "user" ? "bg-white/10" : "bg-black/30"}`}>
            <p className="text-sm">
              <span className="font-semibold">{m.role === "user" ? "You" : "Kyle"}:</span>{" "}
              {m.text}
            </p>

            {m.role === "bot" && Array.isArray(m.sources) && m.sources.length > 0 && (
              <div className="mt-2 text-xs space-y-1">
                <p className="opacity-70">Context:</p>
                <ul className="list-disc pl-5 space-y-1">
                  {m.sources.map((s, idx) => (
                    <li key={s.id || idx} className="opacity-80">
                      <span className="underline" title={s.title}>[{s.id}] {s.title || "Source"}</span>
                      {s.url ? (
                        <a href={s.url} target="_blank" rel="noreferrer" className="ml-2 underline hover:no-underline">open</a>
                      ) : null}
                      {s.text && <div className="opacity-60 mt-1">{s.text}…</div>}
                    </li>
                  ))}
                </ul>

                {m.meta && (
                  <p className="opacity-50 mt-1">
                    {(m.meta.mode === "local" && typeof m.meta.retrieval_ms === "number") ? `retrieval ${m.meta.retrieval_ms} ms • local` : ""}
                    {(m.meta.mode === "server" && typeof m.meta.latency === "number") ? `server ${m.meta.latency} ms` : ""}
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
        {sending && <p className="text-white/60">Kyle is typing...</p>}
      </div>

      <form onSubmit={handleSend} className="mt-4 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) handleSend(e); }}
        />
        <button disabled={sending || !input.trim()} className={`px-4 py-2 rounded-lg ${sending || !input.trim() ? "opacity-50 cursor-not-allowed" : "bg-white/10 hover:bg-white/20"}`}>
          {sending ? "Sending..." : "Send"}
        </button>
      </form>
    </main>
  );
}
