# Multi-Node Inference — Implementation Status & Working Spec

Date: 2026-10-24
Branch: feature/multi-node-inference (based on studio-dev-access)
Status: IN PROGRESS — commits 1–2 of the original 10-commit design are done (by the fleet work on studio-dev-access). This branch carries the design forward.

## How this branch relates to studio-dev-access

`studio-dev-access` (the iteration Patrick is sitting with) contains the fleet
*watchtower*: read-only observability across both llama-swap hosts, plus the
foundation refactor that multi-node routing will build on. This branch is based
**on** studio-dev-access so the foundation is inherited; it does NOT redo that
work.

## Status map: original 10-commit design vs. what exists

| # | Design commit (from 2026_08_14 plan) | Status | Notes |
|---|---|---|---|
| 1 | Parameterize `llama-swap/client.ts` + `createLlamaSwapBackend()` | ✅ DONE | `createLlamaSwapClient(baseUrl)` and `createLlamaSwapBackend(baseUrl)` exist on studio-dev-access (`0e1c9d6`). |
| 2 | Node registry (env-declared nodes), `inferenceBackend` shim | 🟡 PARTIAL | Registry exists (`src/server/inference/fleet.ts`): id/label/primary/backend/activityStorePath. Config syntax is `FLEET_HOSTS=id=url` (not the plan's `INFERENCE_2_BASE_URL`). Functionally equivalent; naming differs. |
| 3 | `model_events.node_id` migration + per-node watcher state | ✅ DONE (2026-11-07) | Migration `0038` adds `node_id` (default/backfill `'primary'`). `model-watcher.ts` keeps one known-running set per fleet host and watches every host. Timeline/model-detail readers filter to `PRIMARY_NODE_ID` until the UI is node-aware (row 7). Verified single-node live; the two-hosts-same-model case is not yet exercised. `nodeId` on `ProxyContext`/`ProxyLogInput` is a `null` placeholder until row 5; it is not written to `requests` yet. |
| 4 | Model index (`Map<modelId, nodeId[]>`) refreshed on watcher tick | ✅ DONE (2026-11-07) | `inference/model-index.ts`, stored per node so an unreachable host keeps its last known models; priority = fleet order (primary first). Filled by `model-watcher.ts` via `listModels()` on every tick. Nothing reads it yet — `getOwningNodeId()` is for row 5 dispatch and row 8. |
| 5 | Proxy dispatch: `node` routing target, `selectUpstream()` order, `requests.node_id` | 🟡 PARTIAL (2026-11-07) | Done: model-index dispatch in `proxy/upstream.ts` (`resolveNodeRoute`), behind `FLEET_ROUTING=true` (default off — secondaries stay observe-only), unknown model → primary, `direct` target still wins; `requests.node_id` (migration `0039`, null = pre-multi-node or direct target) written on every logged request. **Not done:** the explicit `node` routing-rule target (pin) — deferred, nothing needs it yet. Verified live with routing off (row logged `primary`); routing to a real secondary is covered by unit tests only. |
| 6 | Per-node admin API (models/system/config/log events) | 🟡 PARTIAL | `/api/fleet` returns per-host health/models/running/activity. Existing surfaces (models page, system, config editor, log events) are not node-aware. |
| 7 | UI: node badges, per-node System rows, Requests filter, Logs selector | 🟡 PARTIAL | Fleet + Performance pages exist. Models/System/Requests/Logs pages aren't node-aware. |
| 8 | `GET /v1/models` merge across nodes | ✅ DONE (2026-11-07) | `proxy/models-list.ts`. Only when `FLEET_ROUTING=true` and the fleet has 2+ hosts; otherwise relayed as before. Merges each host's raw `/v1/models` entries (all fields kept), higher-priority host wins duplicate ids, unreachable hosts skipped (5s timeout), all-fail falls through to the relay so the client sees the real error. Not request-logged; key model restrictions don't filter it (same as before). Verified live by registering the primary's own URL as a fake second host: same 13 models, identical entries, no log row. A direct routing target still wins. |
| 9 | Metrics `node` label | ❌ NOT DONE | `/metrics` gauges sum both hosts into one series. |
| 10 | Docs: README, `.env.example`, compose | 🟡 PARTIAL | `.env` has `FLEET_HOSTS`/`FLEET_ACTIVITY_PATHS`; `.env.example` doesn't document them. |

## Modifications to the original design (learned since 2026-08-14)

1. **Watchtower replaces proxy-capture for observability.** The original design
   assumed llama-dash's proxy is in the traffic path, so request data comes from
   proxying. Patrick does NOT want clients repointed. Instead, llama-dash reads
   each llama-swap instance's **activity SQLite store** (`store.path` in
   llama-swap config) — per-model tokens/s, request counts, duration, output
   tokens — with zero traffic-path involvement. That's the `activity` field on
   `/api/fleet` and the Performance page. **This is a better fit than the
   design's proxy-capture model and is retained.**

2. **Node config naming: `FLEET_HOSTS`/`FLEET_ACTIVITY_PATHS` instead of
   `INFERENCE_2_*`.** Same semantics (env-declared, boot-read, no UI CRUD).
   Canonicalize on this unless a reason emerges to switch.

3. **Per-host activity store paths are required** for the watchtower on
   secondary hosts (SMB-mounted or local). Reading copies the store to a local
   temp file first (SQLite needs real file locking; SMB doesn't provide it).

4. **Routing (commits 4–5) is the remaining big lift** and is deliberately
   deferred until Patrick has sat with studio-dev-access. The design doc's
   dispatch semantics (direct > node target > model index > primary fallback)
   remain the spec.

## Next step on this branch

Commit 3 per the design: `requests.node_id` / `model_events.node_id` migration
and per-node watcher state. This is the critical silent-failure item and the
prerequisite for dispatch. See the original plan for the full walkthrough.