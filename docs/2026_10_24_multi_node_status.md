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
| 3 | `model_events.node_id` migration + per-node watcher state | ❌ NOT DONE | `model-watcher.ts` still has ONE global `knownRunning`. **Highest-risk silent failure** per the design: two nodes running the same model name cancel each other's events. |
| 4 | Model index (`Map<modelId, nodeId[]>`) refreshed on watcher tick | ❌ NOT DONE | Dispatch prerequisite. Watchtower doesn't need it; routing does. |
| 5 | Proxy dispatch: `node` routing target, `selectUpstream()` order, `requests.node_id` | ❌ NOT DONE | Core of option 2. Proxy still routes to primary only. |
| 6 | Per-node admin API (models/system/config/log events) | 🟡 PARTIAL | `/api/fleet` returns per-host health/models/running/activity. Existing surfaces (models page, system, config editor, log events) are not node-aware. |
| 7 | UI: node badges, per-node System rows, Requests filter, Logs selector | 🟡 PARTIAL | Fleet + Performance pages exist. Models/System/Requests/Logs pages aren't node-aware. |
| 8 | `GET /v1/models` merge across nodes | ❌ NOT DONE | Clients see only the primary's catalog. |
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