// Two more features on the same key:
//   alert-classifier: one-word label, 20 alerts, under four request settings
//   ticket-summary:   two sentences from a long support thread, 10 runs
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { meteredChat } from "../src/ledger.mjs";
import { ALERTS, CLASSIFIER_SYSTEM, SUMMARY_SYSTEM, TICKET } from "../src/features.mjs";

const OUT = "data/feature-runs.jsonl";
const LEDGER = "data/ledger.jsonl";
const done = new Set(existsSync(OUT) ? readFileSync(OUT, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l).key) : []);

const VARIANTS = [
  { name: "deepseek default", model: "deepseek-v4.1-flash", extra: {} },
  { name: "deepseek effort=low", model: "deepseek-v4.1-flash", extra: { reasoning_effort: "low" } },
  { name: "kimi default", model: "kimi-k2.6", extra: {} },
  { name: "kimi effort=none", model: "kimi-k2.6", extra: { reasoning_effort: "none" } },
];

// ONLY=<variant name> runs one variant (so variants can run in parallel);
// SUMMARY=0 skips the summary runs.
const only = process.env.ONLY;
for (const v of VARIANTS.filter((x) => !only || x.name === only)) {
  for (let i = 0; i < ALERTS.length; i++) {
    const key = `classifier|${v.name}|${i}`;
    if (done.has(key)) continue;
    const tenant = i % 2 === 0 ? "tenant-a" : "tenant-b";
    const r = await meteredChat({ feature: "alert-classifier", tenant, ledger: LEDGER }, { model: v.model, ...v.extra, messages: [{ role: "system", content: CLASSIFIER_SYSTEM }, { role: "user", content: `Alert: ${ALERTS[i]}` }] });
    const label = (r.data.choices[0].message.content || "").trim().toLowerCase();
    appendFileSync(OUT, JSON.stringify({ key, feature: "alert-classifier", variant: v.name, model: v.model, alert: i, label, usage: r.data.usage, attempts: r.attempts }) + "\n");
    console.log(key, label, r.data.usage.completion_tokens);
  }
}

for (let i = 0; i < (process.env.SUMMARY === "0" ? 0 : 10); i++) {
  const key = `summary|deepseek default|${i}`;
  if (done.has(key)) continue;
  const tenant = i % 2 === 0 ? "tenant-a" : "tenant-b";
  const r = await meteredChat({ feature: "ticket-summary", tenant, ledger: LEDGER }, { model: "deepseek-v4.1-flash", messages: [{ role: "system", content: SUMMARY_SYSTEM }, { role: "user", content: TICKET }] });
  appendFileSync(OUT, JSON.stringify({ key, feature: "ticket-summary", variant: "deepseek default", model: "deepseek-v4.1-flash", run: i, text: r.data.choices[0].message.content, usage: r.data.usage, attempts: r.attempts }) + "\n");
  console.log(key, r.data.usage.completion_tokens);
}
