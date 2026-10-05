// The same incident question answered two ways, by two models, ten times each:
//   single: everything the tools would return, pasted into one prompt
//   agent:  the model calls the tools itself, one step at a time
// Every response's usage block is recorded as returned. Resumable.
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { meteredChat } from "../src/ledger.mjs";
import { SYSTEM, QUESTION, TOOL_SCHEMAS, contextBlock, runTool } from "../src/incident.mjs";

const OUT = "data/incident-runs.jsonl";
const LEDGER = "data/ledger.jsonl";
const MODELS = (process.env.MODELS || "deepseek-v4.1-flash,kimi-k2.6").split(",");
const N = Number(process.env.N || 10);
const MAX_STEPS = 10;

const done = new Set(existsSync(OUT) ? readFileSync(OUT, "utf8").trim().split("\n").filter(Boolean).map((l) => { const r = JSON.parse(l); return `${r.model}|${r.condition}|${r.run}`; }) : []);

const correct = (text) => /oom|out of memory|memory/i.test(text) && /2\.14|price_cache|cache/i.test(text);

async function single(model, tenant) {
  const messages = [{ role: "system", content: SYSTEM }, { role: "user", content: `${QUESTION}\n\n${contextBlock()}` }];
  const r = await meteredChat({ feature: "incident-assistant-single", tenant, ledger: LEDGER }, { model, messages });
  const text = r.data.choices[0].message.content || "";
  return { steps: [{ usage: r.data.usage, attempts: r.attempts, ms: r.ms }], answer: text };
}

async function agent(model, tenant) {
  const messages = [{ role: "system", content: SYSTEM }, { role: "user", content: QUESTION }];
  const steps = [];
  for (let i = 0; i < MAX_STEPS; i++) {
    const r = await meteredChat({ feature: "incident-assistant", tenant, ledger: LEDGER }, { model, messages, tools: TOOL_SCHEMAS });
    const msg = r.data.choices[0].message;
    steps.push({ usage: r.data.usage, attempts: r.attempts, ms: r.ms, toolCalls: (msg.tool_calls || []).map((t) => t.function.name) });
    if (!msg.tool_calls || msg.tool_calls.length === 0) return { steps, answer: msg.content || "" };
    // Send the assistant turn back exactly as received (minus reasoning text),
    // then one tool message per call: this is what makes every step resend
    // the whole conversation.
    messages.push({ role: "assistant", content: msg.content ?? "", tool_calls: msg.tool_calls });
    for (const tc of msg.tool_calls) messages.push({ role: "tool", tool_call_id: tc.id, content: runTool(tc.function.name) });
  }
  return { steps, answer: "", truncated: true };
}

for (const model of MODELS) {
  for (const condition of ["single", "agent"]) {
    for (let run = 0; run < N; run++) {
      if (done.has(`${model}|${condition}|${run}`)) continue;
      const tenant = run % 2 === 0 ? "tenant-a" : "tenant-b";
      const res = condition === "single" ? await single(model, tenant) : await agent(model, tenant);
      const row = { model, condition, run, tenant, ...res, correct: correct(res.answer) };
      appendFileSync(OUT, JSON.stringify(row) + "\n");
      console.log(model, condition, run, `steps=${res.steps.length}`, `correct=${row.correct}`);
    }
  }
}
