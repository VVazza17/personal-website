import { useEffect, useRef, useState } from "react";
import { sendChatMessage } from "../lib/api";
import { getSessionId } from "../lib/session";

export default function Chat() {
  useEffect(() => { document.title = "Chat | Kyle Deng"; }, []);

  const sessionId = getSessionId();
  const [messages, setMessages] = useState([]); // {role,text,sources?}
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }); // behavior (not behaviour)
  }, [messages]);

  async function handleSend(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");

    try {
      const res = await sendChatMessage({ sessionId, message: text });
      // res: { answer, sources, latency_ms, cached }
      setMessages((m) => [
        ...m,
        { role: "bot", text: res.answer, sources: res.sources, meta: { latency: res.latency_ms, cached: res.cached } },
      ]);
    } catch (err) {
      setMessages((m) => [...m, { role: "bot", text: "Sorry, temporary error. Try again." }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="text-2xl font-semibold mb-4">Chat</h1>

      <div ref={listRef} className="max-h-[60vh] overflow-auto space-y-3">
        {messages.length === 0 && <p className="text-white/60">Start a conversation.</p>}
        {messages.map((m, i) => (
          <div key={i} className={`rounded-lg px-3 py-2 ${m.role === "user" ? "bg-white/10" : "bg-black/30"}`}>
            <p className="text-sm">
              <span className="font-semibold">{m.role === "user" ? "You" : "Kyle"}:</span>{" "}
              {m.text}
            </p>

            {/* Show sources for bot messages */}
            {m.role === "bot" && Array.isArray(m.sources) && m.sources.length > 0 && (
              <div className="mt-2 text-xs space-y-1">
                <p className="opacity-70">Sources:</p>
                <ul className="list-disc pl-5 space-y-1">
                  {m.sources.map((s, idx) => (
                    <li key={s.id || idx} className="opacity-80">
                      <a
                        href={s.url || "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="underline hover:no-underline"
                        title={s.title}
                      >
                        [{idx + 1}] {s.title || "Source"}
                      </a>
                      {typeof s.similarity === "number" && (
                        <span className="ml-2 opacity-60">(sim {s.similarity})</span>
                      )}
                      {s.preview && <div className="opacity-60 mt-1">{s.preview}…</div>}
                    </li>
                  ))}
                </ul>

                {m.meta && (
                  <p className="opacity-50 mt-1">
                    {m.meta.cached ? "Cached • " : ""}
                    {typeof m.meta.latency === "number" ? `${m.meta.latency} ms` : null}
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
          placeholder="Ask me something…"
          className="flex-1 rounded-lg bg-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-pink-400"
        />
        <button
          disabled={sending || !input.trim()}
          aria-label="Send message"
          className={`px-4 py-2 rounded-lg ${sending || !input.trim() ? "opacity-50 cursor-not-allowed" : "bg-white/10 hover:bg-white/20"}`}
        >
          {sending ? "Sending..." : "Send"}
        </button>
      </form>
    </main>
  );
}
