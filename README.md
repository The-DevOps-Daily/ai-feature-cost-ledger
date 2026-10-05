# AI Feature Cost Ledger

What does one request to an AI feature really bill, and which feature spent the money? This repo measures both against [DigitalOcean Serverless Inference](https://www.digitalocean.com/products/inference-engine), using only the `usage` block the provider returns with every response.

## Run it

```bash
cp .env.example .env              # add your DO_INFERENCE_KEY
export $(cat .env | xargs)
npm run probe                     # which reasoning_effort values each model accepts
npm run incident                  # 40 incident-assistant requests, 2 models, single-shot vs agent
npm run features                  # 80 alert labels under 4 settings + 10 ticket summaries
npm run report                    # data/report.json, no API calls
```

No dependencies beyond Node 20+. The recorded runs from 2026-10-05 are in `data/`, so `npm run report` works without a key.

## What each part does

| file | what it is |
| --- | --- |
| `src/ledger.mjs` | `meteredChat()`: every call carries a feature and a tenant, and writes one row in OpenTelemetry GenAI attribute names |
| `src/cost.mjs` | splits `usage` into uncached input, cached input, output and reasoning, and prices it from `data/pricing.json` |
| `src/incident.mjs` | a fixed incident (OOM-killed pods after a deploy) with four tools that always return the same text |
| `src/features.mjs` | 20 alert lines for a one-word classifier, and one long support thread to summarise |
| `scripts/00-effort-probe.mjs` | one alert under each `reasoning_effort` value, errors recorded as returned |
| `scripts/01-incident.mjs` | the same question answered single-shot (all tool output pasted in) and as a tool-calling agent, 10 runs each per model |
| `scripts/02-features.mjs` | the classifier under default reasoning and reduced reasoning, plus the summary feature |
| `scripts/03-report.mjs` | medians, ranges, cost per request, and the ratios the post quotes |

Prices are DigitalOcean's published per-token prices, recorded with their source and date in `data/pricing.json`.

## What it found

- A one-word alert label used a median of 566 reasoning tokens on Kimi K2.6 (up to 1,590) and 184 on DeepSeek V4.1 Flash (up to 1,783). On mean costs, one label cost 32 to 48 percent of a full incident investigation.
- With `reasoning_effort: "none"`, Kimi K2.6 produced 2 output tokens per label and cost 41 times less per 1,000 labels at list price. It also changed 6 of 20 labels.
- The agent loop was not the multiplier we expected: in 19 of 20 investigations the model asked for all four tools in one step, so it took two calls.
- The same prompt used 551 to 1,652 reasoning tokens across ten runs. Per-request cost is a distribution, not a number.

The write-up, with what we could not conclude: [Knowing what your AI feature costs before finance does](https://devops-daily.com/posts/ai-feature-cost-before-finance-does).

## License

MIT
