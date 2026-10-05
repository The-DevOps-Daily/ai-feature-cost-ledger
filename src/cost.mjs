import { readFileSync } from "node:fs";

const pricing = JSON.parse(readFileSync(new URL("../data/pricing.json", import.meta.url), "utf8"));

/**
 * Normalise a provider usage object into the four numbers a bill is made of.
 * completion_tokens already includes reasoning tokens; prompt_tokens already
 * includes cached tokens. Both are split out so neither is counted twice.
 */
export function splitUsage(u = {}) {
  const input = u.prompt_tokens ?? 0;
  const cached = u.prompt_tokens_details?.cached_tokens ?? u.cache_read_input_tokens ?? 0;
  const output = u.completion_tokens ?? 0;
  const reasoning = u.completion_tokens_details?.reasoning_tokens ?? 0;
  return { input, cached, uncached: input - cached, output, reasoning, visible: output - reasoning };
}

/** USD for one response, from the published per-million-token prices. */
export function costUsd(model, usage, { ignoreCache = false } = {}) {
  const p = pricing.models[model];
  if (!p) throw new Error(`no price for ${model}`);
  const s = splitUsage(usage);
  const cachedRate = p.cachedInput ?? p.input;
  const cached = ignoreCache ? 0 : s.cached;
  const uncached = s.input - cached;
  return (uncached * p.input + cached * cachedRate + s.output * p.output) / 1e6;
}

export { pricing };
