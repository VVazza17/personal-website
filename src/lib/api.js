const BASE_URL = import.meta.env.VITE_API_BASE_URL;

export async function withRetry(fn, attempts = 2) {
  try { return await fn(); }
  catch (e) {
    if (attempts <= 0) throw e;
    await new Promise(r => setTimeout(r, 400));
    return withRetry(fn, attempts - 1);
  }
}

export async function getProjects() {
  return withRetry(async () => {
    const r = await fetch(`${BASE_URL}/projects`);
    if (!r.ok) throw new Error("Failed to load projects");
    return r.json();
  });
}

export async function sendChatMessage({ sessionId, message }) {
  const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, message }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export async function retrieveSnippets(q) {
  const r = await fetch(`${import.meta.env.VITE_API_BASE_URL}/retrieve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ q }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "retrieve failed");
  return data;
}