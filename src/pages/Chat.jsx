import { useState } from "react";
import { sendChatMessage } from "../lib/api";

export default function Chat() {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");

    async function handleSend(e) {
        e.preventDefault();
        if (!input.trim()) return;

        const userMessage = { role : "user", text: input };
        setMessages([...messages, userMessage]);
        setInput("")

        try {
            const reply = await sendChatMessage(input);
            setMessages(m => [...m, userMessage, { role: "bot", text: reply }]);
        } catch {
            setMessages(m => [...m, userMessage, { role: "bot", text: "Error" }]);
        }
    }

    return (
        <section className="space-y-4">
            <h2 className="text-2xl font-semibold">Chat with me</h2>
            <div className="space-y-2 max-h-96 overflow-y-auto border p-3 rounded">
                {messages.map((m, i) => (
                    <p key={i} className={m.role === "user" ? "text-blue-400" : "text-pink-400"}>
                        <strong>{m.role}:</strong> {m.text}
                    </p>
                ))}
            </div>
            <form onSubmit={handleSend} className="flex gap-2">
                <input
                    className="flex-1 rounded bg-gray-800 text-white px-3 py-2"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder="Ask me about myself..."
                />
                <button className="bg-pink-500 px-4 py-2 rounded text-white">Send</button>
            </form>
        </section>
    );
}