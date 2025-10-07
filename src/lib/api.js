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

export async function getProjectById(id) {
  return withRetry(async () => {
    const r = await fetch(`${BASE_URL}/projects/${id}`);
    if (!r.ok) throw new Error("Failed to load project");
    return r.json();
  });
}

export async function sendChatMessage({text, sessionId}) {
  console.log("POST", `${BASE_URL}/chat`, { text, sessionId })

  return withRetry(async () => {
    const r = await fetch(`${BASE_URL}/chat`, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ sessionId, message: text }),
    });
    if (!r.ok) throw new Error("Chat failed");
    return r.json();
  });
}

export async function submitContact({ name, email, message }) {
  return withRetry(async () => {
    const r = await fetch(`${BASE_URL}/contact`, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ name, email, message }),
    });
    if (!r.ok) throw new Error("Contact failed");
    return r.json();
  });
}