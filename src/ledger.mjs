import { appendFileSync } from "node:fs";
import { chat } from "./client.mjs";
import { costUsd, splitUsage } from "./cost.mjs";

/**
 * The whole idea in one function: every model call carries the feature and
 * tenant that caused it, and the record is written in OpenTelemetry GenAI
 * attribute names so the same fields work in a span, a log line or a table.
 */
export async function meteredChat({ feature, tenant, ledger }, body) {
  const res = await chat(body);
  const u = res.data.usage;
  const s = splitUsage(u);
  const row = {
    ts: new Date().toISOString(),
    "app.feature": feature,
    "app.tenant": tenant,
    "gen_ai.operation.name": "chat",
    "gen_ai.provider.name": "digitalocean",
    "gen_ai.request.model": body.model,
    "gen_ai.response.model": res.data.model,
    "gen_ai.usage.input_tokens": s.input,
    "gen_ai.usage.cache_read.input_tokens": s.cached,
    "gen_ai.usage.output_tokens": s.output,
    "gen_ai.usage.reasoning.output_tokens": s.reasoning,
    "app.cost_usd": costUsd(body.model, u),
    "app.attempts": res.attempts,
    "app.latency_ms": res.ms,
  };
  if (ledger) appendFileSync(ledger, JSON.stringify(row) + "\n");
  return { ...res, row };
}
