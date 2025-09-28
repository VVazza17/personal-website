const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

export async function getProjects() {
    const res = await fetch(`${BASE_URL}/projects`);
    if (!res.ok) throw new Error("Failed to fetch projects");
    return res.json();
}

export async function sendChatMessage(message) {
    const res = await fetch(`${BASE_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
    });
    if (!res.ok) throw new Error("Chat failed");
    return res.json();
}   