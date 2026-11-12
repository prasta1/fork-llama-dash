# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary user is Patrick — a self-hosted AI/ML infrastructure operator running a
fleet of local models across multiple machines (Mac Studio M3 Ultra as primary,
MacBook Pro as secondary, a Mac Mini and Synology NAS also in the mix). He is a
technical operator, not an end-user of the models: he runs the fleet, monitors
it, and wants to understand how it's performing. The product is built for him
first, but shaped so it could be shared with or used by other self-hosters
later — so the design should not hard-code his specific machines or habits.

## Product Purpose

llama-dash turns a self-hosted local inference fleet into an observable,
policy-controlled AI gateway. Its core job, as Patrick confirmed, is to **watch
the fleet** — observability into every model across every machine — without
being in the traffic path. It answers three questions at a glance: is a model
loaded in memory, is it mid-run, and how is it performing now and over the last
n days. Success means Patrick can look at one screen and know the health and
performance of his entire fleet across machines.

## Positioning

The meaningfully different mechanism is the **watchtower**: llama-dash observes
the fleet by reading each llama-swap instance's own activity store (per-model
tokens/s, request counts, duration, output tokens) rather than proxying traffic.
This gives full observability with zero performance implications and zero client
repointing — clients keep hitting llama-swap directly. A neighboring tool that
proxies traffic to observe it cannot truthfully claim this.

## Operating Context

- Self-hosted, local inference. Models served via llama-swap over llama.cpp/GGUF
  (and the sushi MLX engine on the primary).
- Multiple hosts: Mac Studio (primary, always-on), MacBook (secondary, observed
  via tailnet + SMB-mounted activity store), Mac Mini, Synology NAS.
- Patrick interacts with models rarely inside the dashboard — the dashboard is a
  watchtower, not a playground. Real model traffic flows to llama-swap directly.
- The fleet work lives on a fork (`prasta1/fork-llama-dash`), upstream is
  `ndom91/llama-dash`. Patrick sits with iterations before merging.
- Dev server runs on the Studio at :5173, reached from the MacBook via SSH
  tunnel (localhost:5173). Auth is better-auth, first-user-only signup.

## Capabilities and Constraints

- **Fleet observability (watchtower)** — per-host health, model residency,
  running state, and per-model performance (tok/s, reqs, output tokens) over a
  7/30/90-day window, read from each llama-swap activity store. Read-only.
- **Gateway control** — proxy, auth, API keys, routing rules, request logging,
  playgrounds, config editing. These exist and are bound to the primary host.
- **Durable constraint (confirmed):** llama-dash must stay **OUT of the traffic
  path**. Clients keep hitting llama-swap directly. The watchtower reads the
  activity store; it does not proxy. Future work must not break this.
- **Multi-node routing is deferred** — the `feature/multi-node-inference` branch
  carries the design (commits 1–2 done, 3–10 remain). Routing to secondaries is
  a future option, not a current requirement.
- Terminology: "fleet" = the set of observed llama-swap hosts; "primary" = the
  host llama-dash is bound to; "watchtower" = the read-only observability layer.
- Undecided: whether multi-node routing (option 2) will ever be built.

## Brand Commitments

- Name: llama-dash. Fork: `prasta1/fork-llama-dash`; upstream `ndom91/llama-dash`.
- The incumbent visual system (dark, mono, terminal-adjacent, `g`-leader
  keyboard nav) is the existing identity. No binding brand assets beyond the
  favicon and the llama-dash name.

## Evidence on Hand

- Real fleet data: llama-swap activity stores on the Studio
  (`~/.hermes/llama-swap/activity.sqlite`, ~31K rows) and MacBook
  (`/Volumes/prasta/.hermes/llama-swap/activity.sqlite`, ~2K rows) with real
  per-model performance.
- Design docs in `docs/`: multi-node inference design + plan (2026-08-14),
  status spec (2026-10-24), routing MVP spec, architecture audit, product
  landscape notes.
- README.md documents the full feature set.
- No testimonials, customers, or external case studies — must not fabricate.

## Product Principles

1. **Observe without obstructing.** The watchtower reads; it never sits in the
   traffic path. Zero performance implications, zero client repointing.
2. **One screen, whole fleet.** The operator should see every machine's models
   and performance at a glance, not hunt across tabs.
3. **Real data over decoration.** Performance numbers come from actual activity
   stores, not estimates. Empty states are honest, not padded.
4. **Built for Patrick, shaped for others.** Don't hard-code his machines or
   habits; keep it general enough to share.
5. **Sit with it before shipping.** Iterations are reviewed and sat with before
   merging — the design should be complete and trustworthy, not rushed.

## Accessibility & Inclusion

No product-specific accessibility requirement was established beyond the
incumbent system's existing keyboard navigation (g-leader shortcuts, j/k/Enter
list movement). The operator is a single technical user; standard web
accessibility applies but no special accommodation is confirmed.
