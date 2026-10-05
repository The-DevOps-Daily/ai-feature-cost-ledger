// Which ways of turning reasoning down does each model accept on this endpoint?
// One alert, six request variants, recorded as returned (errors included).
import { writeFileSync } from "node:fs";
import { CLASSIFIER_SYSTEM, ALERTS } from "../src/features.mjs";

const VARIANTS = {
  default: {},
  "reasoning_effort=low": { reasoning_effort: "low" },
  "reasoning_effort=minimal": { reasoning_effort: "minimal" },
  "reasoning_effort=none": { reasoning_effort: "none" },
};
const out = [];
for (const model of ["deepseek-v4.1-flash", "kimi-k2.6"]) {
  for (const [name, extra] of Object.entries(VARIANTS)) {
    const res = await fetch("https://inference.do-ai.run/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.DO_INFERENCE_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ model, ...extra, messages: [{ role: "system", content: CLASSIFIER_SYSTEM }, { role: "user", content: `Alert: ${ALERTS[0]}` }] }),
    });
    const body = await res.json();
    const row = { model, variant: name, status: res.status, error: body.error?.message, usage: body.usage, label: body.choices?.[0]?.message?.content };
    out.push(row);
    console.log(model, name, res.status, row.error || `completion=${body.usage.completion_tokens} reasoning=${body.usage.completion_tokens_details?.reasoning_tokens} label=${row.label}`);
  }
}
writeFileSync("data/effort-probe.json", JSON.stringify(out, null, 2) + "\n");
