// A fixed incident: checkout-api returns 502s after a deploy raised its cache
// size, and its pods are being OOM-killed. Every tool returns the same text on
// every run, so the only thing that varies between runs is the model.

const pods = `NAME                            READY   STATUS             RESTARTS        AGE   NODE
checkout-api-7d9f8b6c54-2xkqp   0/1     CrashLoopBackOff   7 (41s ago)     23m   pool-a-3f9k
checkout-api-7d9f8b6c54-8mw4n   1/1     Running            6 (3m12s ago)   23m   pool-a-7h2c
checkout-api-7d9f8b6c54-qz7tr   0/1     CrashLoopBackOff   7 (1m5s ago)    23m   pool-a-3f9k
checkout-api-7d9f8b6c54-v5lds   1/1     Running            5 (6m40s ago)   23m   pool-a-9d1x
Last state for checkout-api-7d9f8b6c54-2xkqp: Terminated, Reason: OOMKilled, Exit Code: 137
Container limits: cpu 500m, memory 512Mi. Requests: cpu 250m, memory 384Mi.`;

const logLines = [];
for (let i = 0; i < 36; i++) {
  const ts = `2026-10-05T07:${String(12 + Math.floor(i / 6)).padStart(2, "0")}:${String((i * 9) % 60).padStart(2, "0")}Z`;
  const kind = i % 6;
  if (kind === 0) logLines.push(`${ts} INFO  http   POST /v1/checkout 200 182ms cart_items=4 region=fra1`);
  if (kind === 1) logLines.push(`${ts} INFO  cache  warmup progress entries=${48000 + i * 2100} heap_used_mb=${300 + i * 6}`);
  if (kind === 2) logLines.push(`${ts} WARN  gc     long pause 840ms heap_used_mb=${330 + i * 6} heap_limit_mb=512`);
  if (kind === 3) logLines.push(`${ts} ERROR http   POST /v1/checkout upstream payment-svc timeout after 2000ms`);
  if (kind === 4) logLines.push(`${ts} INFO  http   GET /healthz 200 3ms`);
  if (kind === 5) logLines.push(`${ts} WARN  cache  eviction disabled: PRICE_CACHE_MAX_ENTRIES=250000 exceeds safe size for heap`);
}
logLines.push("2026-10-05T07:18:02Z FATAL runtime out of memory: heap limit reached (512Mi), process exiting");
const logs = logLines.join("\n");

const deploys = `REVISION  DEPLOYED (UTC)        AUTHOR      CHANGE
v2.14.0   2026-10-05 06:58      ci-bot      PRICE_CACHE_MAX_ENTRIES 50000 -> 250000; warm cache on start (PR #4471)
v2.13.2   2026-10-02 14:10      ci-bot      bump payment-svc client to 3.8.1
v2.13.1   2026-09-30 09:45      ci-bot      add region label to checkout metrics`;

const metrics = `checkout-api container_memory_working_set_bytes (max per pod, MiB), 5 min steps
06:50 212  06:55 215  07:00 389  07:05 471  07:10 508  07:15 511  07:20 497
checkout-api http_requests 5xx ratio
06:50 0.1%  06:55 0.1%  07:00 2.4%  07:05 9.8%  07:10 17.2%  07:15 21.5%  07:20 19.9%`;

const TOOLS = {
  list_pods: () => pods,
  get_logs: () => logs,
  get_recent_deploys: () => deploys,
  get_metrics: () => metrics,
};

export const TOOL_SCHEMAS = [
  { type: "function", function: { name: "list_pods", description: "List pods for a service with status, restarts and last termination reason.", parameters: { type: "object", properties: { service: { type: "string" } }, required: ["service"] } } },
  { type: "function", function: { name: "get_logs", description: "Return recent log lines for a service.", parameters: { type: "object", properties: { service: { type: "string" }, lines: { type: "integer" } }, required: ["service"] } } },
  { type: "function", function: { name: "get_recent_deploys", description: "Return the last deploys of a service with their change notes.", parameters: { type: "object", properties: { service: { type: "string" } }, required: ["service"] } } },
  { type: "function", function: { name: "get_metrics", description: "Return memory and error-rate series for a service.", parameters: { type: "object", properties: { service: { type: "string" } }, required: ["service"] } } },
];

export const SYSTEM = `You are the on-call assistant for a platform team that runs about 40 services on Kubernetes.
Rules:
- Investigate with the tools before you answer. Do not guess at causes you have not seen evidence for.
- Prefer the most recent change as a suspect, but confirm it with logs or metrics.
- Never suggest deleting data, scaling to zero, or disabling alerts.
- Your final answer goes to an engineer who was just paged on a phone. Use at most three short sentences: the cause, the evidence, and the one action to take now.
- Do not use tables or markdown headings in the final answer.`;

export const QUESTION = "checkout-api started returning 502s about 15 minutes ago. What is going on?";

/** Everything the tools would return, pasted into one prompt. */
export function contextBlock() {
  return [
    "Output of list_pods(checkout-api):\n" + pods,
    "Output of get_logs(checkout-api):\n" + logs,
    "Output of get_recent_deploys(checkout-api):\n" + deploys,
    "Output of get_metrics(checkout-api):\n" + metrics,
  ].join("\n\n");
}

export function runTool(name) {
  const fn = TOOLS[name];
  return fn ? fn() : `unknown tool ${name}`;
}
