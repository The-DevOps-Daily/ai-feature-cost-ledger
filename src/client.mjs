const ENDPOINT = "https://inference.do-ai.run/v1/chat/completions";
const RETRY = new Set([429, 500, 502, 503, 504]);

/**
 * One chat completion. Retries busy or failing responses with backoff and
 * reports how many attempts it took, because a retry is a cost question too:
 * you cannot see from the client whether a failed attempt was billed.
 */
export async function chat(body, { attempt = 1, maxAttempts = 6 } = {}) {
  const key = process.env.DO_INFERENCE_KEY;
  if (!key) throw new Error("DO_INFERENCE_KEY is not set");
  const started = Date.now();
  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    // No response arrived. The request may or may not have reached the
    // provider, so a retry here can be a second billed call.
    if (attempt >= maxAttempts + 6) throw err;
    await new Promise((r) => setTimeout(r, Math.min(60000, 5000 * attempt)));
    const out = await chat(body, { attempt: attempt + 1, maxAttempts });
    out.failedAttempts.unshift({ status: "network", body: String(err.cause?.code || err.message) });
    return out;
  }
  if (!res.ok) {
    const text = (await res.text()).slice(0, 200);
    if (RETRY.has(res.status) && attempt < maxAttempts) {
      const wait = Math.min(30000, 1000 * 2 ** attempt) + Math.floor(Math.random() * 500);
      await new Promise((r) => setTimeout(r, wait));
      const out = await chat(body, { attempt: attempt + 1, maxAttempts });
      out.failedAttempts.unshift({ status: res.status, body: text });
      return out;
    }
    throw new Error(`${res.status} ${text}`);
  }
  const data = await res.json();
  return { data, attempts: attempt, failedAttempts: [], ms: Date.now() - started };
}
