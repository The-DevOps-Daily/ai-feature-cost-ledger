// Turns the recorded usage into the numbers the post quotes. Reads only the
// files written by 01 and 02; no API calls. Writes data/report.json.
import { readFileSync, writeFileSync } from "node:fs";
import { costUsd, splitUsage } from "../src/cost.mjs";

const read = (f) => readFileSync(f, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const sum = (a) => a.reduce((x, y) => x + y, 0);
const r6 = (x) => Number(Math.round(Number(x.toPrecision(12)) * 1e7) / 1e7);

const report = { incident: {}, classifier: {}, summary: {}, ledger: {} };

// Incident assistant
const inc = read("data/incident-runs.jsonl");
for (const model of [...new Set(inc.map((r) => r.model))]) {
  for (const condition of ["single", "agent"]) {
    const runs = inc.filter((r) => r.model === model && r.condition === condition);
    if (!runs.length) continue;
    const per = runs.map((r) => {
      const s = r.steps.map((st) => splitUsage(st.usage));
      const last = s[s.length - 1];
      return {
        steps: r.steps.length,
        input: sum(s.map((x) => x.input)),
        cached: sum(s.map((x) => x.cached)),
        output: sum(s.map((x) => x.output)),
        reasoning: sum(s.map((x) => x.reasoning)),
        visibleAnswer: last.visible,
        cost: sum(r.steps.map((st) => costUsd(model, st.usage))),
        costNoCache: sum(r.steps.map((st) => costUsd(model, st.usage, { ignoreCache: true }))),
        correct: r.correct,
        attempts: sum(r.steps.map((st) => st.attempts)),
      };
    });
    report.incident[`${model} ${condition}`] = {
      runs: per.length,
      correct: per.filter((p) => p.correct).length,
      steps: { min: Math.min(...per.map((p) => p.steps)), median: median(per.map((p) => p.steps)), max: Math.max(...per.map((p) => p.steps)) },
      medianInput: median(per.map((p) => p.input)),
      medianCached: median(per.map((p) => p.cached)),
      medianOutput: median(per.map((p) => p.output)),
      medianReasoning: median(per.map((p) => p.reasoning)),
      medianVisibleAnswer: median(per.map((p) => p.visibleAnswer)),
      // a median of per-run ratios, not a ratio of medians
      medianBilledPerVisible: Math.round(median(per.map((p) => (p.input + p.output) / Math.max(1, p.visibleAnswer))) * 10) / 10,
      billedPerVisibleRange: [Math.min(...per.map((p) => (p.input + p.output) / Math.max(1, p.visibleAnswer))), Math.max(...per.map((p) => (p.input + p.output) / Math.max(1, p.visibleAnswer)))].map((x) => Math.round(x * 10) / 10),
      cacheHitRuns: per.filter((p) => p.cached > 0).length,
      costMedianCacheHitRuns: per.some((p) => p.cached > 0) ? r6(median(per.filter((p) => p.cached > 0).map((p) => p.cost))) : null,
      costNoCacheMedianCacheHitRuns: per.some((p) => p.cached > 0) ? r6(median(per.filter((p) => p.cached > 0).map((p) => p.costNoCache))) : null,
      _raw: { costMedian: median(per.map((p) => p.cost)), costMean: mean(per.map((p) => p.cost)), costNoCacheMedian: median(per.map((p) => p.costNoCache)), costNoCacheMean: mean(per.map((p) => p.costNoCache)) },
      costMedian: r6(median(per.map((p) => p.cost))),
      costMean: r6(mean(per.map((p) => p.cost))),
      costMin: r6(Math.min(...per.map((p) => p.cost))),
      costMax: r6(Math.max(...per.map((p) => p.cost))),
      costNoCacheMedian: r6(median(per.map((p) => p.costNoCache))),
      costNoCacheMean: r6(mean(per.map((p) => p.costNoCache))),
      reasoningRange: [Math.min(...per.map((p) => p.reasoning)), Math.max(...per.map((p) => p.reasoning))],
      extraAttempts: sum(per.map((p) => p.attempts)) - sum(per.map((p) => p.steps)),
    };
  }
}

// Classifier and summary
const feat = read("data/feature-runs.jsonl");
const cls = feat.filter((r) => r.feature === "alert-classifier");
const defaults = {};
for (const r of cls) if (r.variant.endsWith("default")) defaults[`${r.model}|${r.alert}`] = r.label;
for (const v of [...new Set(cls.map((r) => r.variant))]) {
  const runs = cls.filter((r) => r.variant === v);
  const s = runs.map((r) => splitUsage(r.usage));
  const costs = runs.map((r) => costUsd(r.model, r.usage));
  report.classifier[v] = {
    runs: runs.length,
    medianInput: median(s.map((x) => x.input)),
    medianOutput: median(s.map((x) => x.output)),
    medianReasoning: median(s.map((x) => x.reasoning)),
    maxOutput: Math.max(...s.map((x) => x.output)),
    medianVisible: median(s.map((x) => x.visible)),
    costPer1000: Math.round(mean(costs) * 1000 * 1e4) / 1e4,
    costPer1000NoCache: Math.round(mean(runs.map((r) => costUsd(r.model, r.usage, { ignoreCache: true }))) * 1000 * 1e4) / 1e4,
    _raw: { costMean: mean(costs), costNoCacheMean: mean(runs.map((r) => costUsd(r.model, r.usage, { ignoreCache: true }))) },
    agreesWithDefault: runs.filter((r) => defaults[`${r.model}|${r.alert}`] === r.label).length,
    labels: Object.fromEntries([...new Set(runs.map((r) => r.label))].map((l) => [l, runs.filter((r) => r.label === l).length])),
  };
}
const sumRuns = feat.filter((r) => r.feature === "ticket-summary");
if (sumRuns.length) {
  const s = sumRuns.map((r) => splitUsage(r.usage));
  report.summary = {
    runs: sumRuns.length,
    medianInput: median(s.map((x) => x.input)),
    medianCached: median(s.map((x) => x.cached)),
    medianOutput: median(s.map((x) => x.output)),
    medianReasoning: median(s.map((x) => x.reasoning)),
    medianVisible: median(s.map((x) => x.visible)),
    costMedian: r6(median(sumRuns.map((r) => costUsd(r.model, r.usage)))),
  };
}

// Ratios the post quotes, computed here so each one traces to this file
const ratio = (a, b) => Math.round((a / b) * 1000) / 1000;
report.headline = {};
for (const [model, short] of [["deepseek-v4.1-flash", "deepseek"], ["kimi-k2.6", "kimi"]]) {
  const single = report.incident[`${model} single`]._raw;
  const agentRun = report.incident[`${model} agent`]._raw;
  const cls = report.classifier[`${short} default`]._raw;
  report.headline[model] = {
    agentOverSingleNoCacheMedian: ratio(agentRun.costNoCacheMedian, single.costNoCacheMedian),
    agentOverSingleAsBilledMedian: ratio(agentRun.costMedian, single.costMedian),
    // ratio of mean costs, same cache treatment on both sides
    classifierOverAgentMeanAsBilled: ratio(cls.costMean, agentRun.costMean),
    classifierOverAgentMeanNoCache: ratio(cls.costNoCacheMean, agentRun.costNoCacheMean),
  };
}
const kd = report.classifier["kimi default"]._raw, kn = report.classifier["kimi effort=none"]._raw;
const dd = report.classifier["deepseek default"]._raw, dl = report.classifier["deepseek effort=low"]._raw;
report.headline.kimiEffortNoneSavingAsBilled = ratio(kd.costMean, kn.costMean);
report.headline.kimiEffortNoneSavingNoCache = ratio(kd.costNoCacheMean, kn.costNoCacheMean);
report.headline.deepseekEffortLowSavingAsBilled = ratio(dd.costMean, dl.costMean);
report.headline.deepseekEffortLowSavingNoCache = ratio(dd.costNoCacheMean, dl.costNoCacheMean);

// Ledger roll-up: what a per-feature view looks like
const led = read("data/ledger.jsonl");
// list price: the same tokens with no cache discount
const listCost = (r) => costUsd(r["gen_ai.request.model"], { prompt_tokens: r["gen_ai.usage.input_tokens"], completion_tokens: r["gen_ai.usage.output_tokens"] }, { ignoreCache: true });
const by = (k) => {
  const out = {};
  for (const r of led) {
    const key = r[k];
    out[key] ??= { calls: 0, costUsd: 0, listCostUsd: 0, inputTokens: 0, outputTokens: 0, reasoningTokens: 0 };
    out[key].calls++;
    out[key].costUsd += r["app.cost_usd"];
    out[key].listCostUsd += listCost(r);
    out[key].inputTokens += r["gen_ai.usage.input_tokens"];
    out[key].outputTokens += r["gen_ai.usage.output_tokens"];
    out[key].reasoningTokens += r["gen_ai.usage.reasoning.output_tokens"];
  }
  for (const v of Object.values(out)) { v.costUsd = r6(v.costUsd); v.listCostUsd = r6(v.listCostUsd); }
  return out;
};
report.ledger = { rows: led.length, byFeature: by("app.feature"), byTenant: by("app.tenant"), byModel: by("gen_ai.request.model"), totalCostUsd: r6(sum(led.map((r) => r["app.cost_usd"]))), totalListCostUsd: r6(sum(led.map(listCost))) };

const strip = (o) => JSON.parse(JSON.stringify(o, (k, v) => (k === "_raw" ? undefined : v)));
writeFileSync("data/report.json", JSON.stringify(strip(report), null, 2) + "\n");
console.log(JSON.stringify(strip(report), null, 2));
