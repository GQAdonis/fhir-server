# Model map per harness and tier

Discovered 2026-09-25 from locally configured harnesses (per `agent-team-models`: listings prove configuration, not inference quality). Tiers are operator labels:
- `hard`: difficult reasoning and review;
- `medium`: routine implementation;
- `low`: bounded mechanical work.

Where a harness offers no verified smaller model, the tier is expressed through **reasoning effort on the configured default model**. Strength is never inferred from a model name.

## Discovery sources

| Harness | Version | Source | Configured default |
|---|---|---|---|
| Claude Code | CLI | aliases `opus`, `sonnet`, `haiku` (Opus 5.5, Sonnet 5, Haiku 4.5) | `opus` |
| Codex | 0.154.0 | `~/.codex/config.toml`, `codex debug models` (visible: gpt-6-astra, gpt-5.6-sol/terra/luna, gpt-5.5, and Ollama cloud models) | `gpt-6-astra` |
| OpenCode | 1.18.25 | `opencode models` (kimi-for-coding/k3, k3-256k; minimax/MiniMax-M3; openai/gpt-6-*; amazon-bedrock/anthropic.*) | `kimi-for-coding/k3` |
| Kimi Code | 0.42.0 | `~/.kimi/config.toml` (`default_model = "kimi-code/k3"`; also kimi-for-coding, kimi-for-coding-highspeed) | `kimi-code/k3` |
| MiniMax Code | 0.5.4 | `~/.minimax/config.yaml` provider `minimax`; `mcode -m <provider/model>` per session | `minimax/MiniMax-M3` |

## Tier → model

| Tier | Claude | Codex | OpenCode | Kimi Code | MiniMax Code |
|---|---|---|---|---|---|
| hard | `opus` | `gpt-6-astra`, `model_reasoning_effort = "high"` | `kimi-for-coding/k3` | ignored by harness; session default `kimi-code/k3` | `minimax/MiniMax-M3` |
| medium | `sonnet` | `gpt-6-astra`, `model_reasoning_effort = "medium"` | `kimi-for-coding/k3` | ignored by harness; session default `kimi-code/k3` | `minimax/MiniMax-M3` |
| low | `haiku` | `gpt-6-astra`, `model_reasoning_effort = "low"` | `kimi-for-coding/k3` | ignored by harness; session default `kimi-code/k3` | `minimax/MiniMax-M3` |

## Notes

- **Kimi** ignores per-role model frontmatter (native contract). The intended model is written into the Harness card text only. Choose the model at invocation (`kimi -m`).
- **MiniMax** agent files carry the model, but `mcode exec` has no agent selector. Interactive sessions pick the agent, and `-m` overrides the model per session.
- **PHI lanes:** none of these endpoints is BAA-covered. PHI-capable roles on a Tribe lane use `TRIBE_MODEL_*` env configuration (change `configure-phi-lanes`) instead of this table.
- Faster variants were seen (`gpt-6-astra-fast`, `kimi-for-coding-highspeed`, `MiniMax-M2.7-highspeed`). They are not bound, because no capability or price metadata was verified for them.
