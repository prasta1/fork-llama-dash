---
target: fleet UI (FleetPage + FleetPerformancePage)
total_score: 33
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 3
target_identity: "file:/Users/macstudio/llama-dash/src/features/fleet/FleetPage.tsx"
target_fingerprint: "sha256:fbe11cf7a998f67e620d1c7b8dc5734a63c098f6966d7c0cf0e84b395cc1a251"
target_path: /Users/macstudio/llama-dash/src/features/fleet/FleetPage.tsx
timestamp: 2026-10-24T13-10-50Z
slug: src-features-fleet-fleetpage-tsx
---
# Design Critique — llama-dash Fleet UI

**Method: dual-agent (A: sa-0-c642406d · B: sa-1-ea2ae508)**

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 4 | Dots + latency + version on every host; refresh feedback |
| 2 | Match System / Real World | 4 | Host→models→state maps to how an operator thinks |
| 3 | User Control and Freedom | 3 | Sortable, window toggle, refresh — but no drill-down from cards |
| 4 | Consistency and Standards | 4 | Tokens reused across pages; disciplined system |
| 5 | Error Prevention | 3 | Read-only page, low risk; no destructive actions |
| 6 | Recognition Rather Than Recall | 3 | State is dot-only on mobile; 'resident' undefined |
| 7 | Flexibility and Efficiency | 4 | g-leader nav, sortable columns, dense tables |
| 8 | Aesthetic and Minimalist Design | 4 | Dense but not cluttered; every element earns its pixel |
| 9 | Error Recovery | 2 | Unreachable host = red dot, no error, no last-seen, no guidance |
| 10 | Help and Documentation | 2 | No legend for state dots, no 'resident' definition, no freshness |
| **Total** | | **33/40** | **Good** |

## Design Specificity Verdict

**Grounded in this product, not category-interchangeable.** The composition is built around the operator's actual questions — per-host reachability, model residency, per-model performance over a window. The g-leader nav, mono type, dim/faint hierarchy, 'read-only' subtitle, 'primary' badge, and `set FLEET_HOSTS...` empty state are all terminal-adjacent and operator-specific. This reads as a watchtower for a self-hosted llama-swap fleet, not a generic dashboard template.

**Deterministic scan:** CLI static scan of both source files returned **zero findings** (clean markup). Browser runtime detection found **207 findings** across `/fleet` (121) and `/fleet/performance` (86) — but the bulk are **false positives** on the off-screen mobile sidebar (translated `-translate-x-full`, not visible at desktop width) and the dev-only TanStack devtools panel. The real, non-false-positive findings: undersized 9–10px mono text, low-contrast section labels, and the **`G P` duplicate-handler console flood** (confirmed real — Performance and Playground both bind `'p'`).

## Overall Impression

A competent, disciplined, operator-first watchtower with a strong design-token system and genuine power-user features. The single biggest opportunity: **the failure path is emotionally cold.** When a host is unreachable — the highest-stakes moment in the product — the card shows a red dot and nothing else. No error, no last-seen, no "what to do." The schema already carries `health.error` and `health.health`; the UI just drops them.

## What's Working

1. **Dense, scanable, operator-first density** — mono type, tabular-nums, dim/faint hierarchy, tight 10–11px labels pack maximum information per viewport without visual noise.
2. **The g-leader keyboard nav is genuine efficiency** — unique second keys, pending-state visual, sr-only shortcut text, capability-filtered bindings. Real power-user craft, not decoration.
3. **A disciplined design-token system** — status colors with glow pulses, series ramp, reduced-motion support, forced-colors handling, and a light theme that inverts correctly. The peer-model hatching is a thoughtful non-color encoding.

## Priority Issues

**[P0] Unreachable-host state is silent.** A red dot with no error message, no last-seen timestamp, no `health.error` surfaced. At the highest-stakes moment (host down) the operator gets zero diagnostic signal. **Fix:** surface the error string and a last-seen/latency-failed indicator. → `$impeccable harden`

**[P0] Per-model state is dot-only on mobile.** The state text column is `hide-mobile`, leaving only the 2px `aria-hidden` StatusDot. Color-blind and low-vision operators cannot read state on small screens. **Fix:** add a text state label (or aria-label on the dot) that survives mobile. → `$impeccable adapt`

**[P1] `G P` keyboard collision (real bug).** Performance and Playground both bind leader `'p'` — the console floods with duplicate-handler warnings. **Fix:** give Performance a different leader (e.g. `'f'` is taken by Fleet; use `'v'` or `'e'`). → `$impeccable polish`

**[P1] `'resident'` is undefined jargon.** The resident/total count requires knowing 'resident' means 'ready state'. **Fix:** tooltip/legend, or relabel to 'ready/total'. → `$impeccable clarify`

**[P1] Performance table drops meaningful metrics.** `avgDurationMs`, `inputTokens`, and `errorCount` exist in the schema but aren't shown. For an operator, `errorCount` over a window is a critical health signal that's invisible. **Fix:** add an error column or per-row error badge. → `$impeccable layout`

**[P2] No data-freshness indicator.** The refresh button spins, but there's no 'last updated' timestamp or staleness warning. **Fix:** add a last-updated label. → `$impeccable polish`

## Persona Red Flags

**Alex (power user):** mostly served — g-leader nav, sortable columns, dense tables. Red flags: no keyboard shortcut for the window toggle, and no drill-down from a Fleet card to that host's detail. Alex wants to get from "host down" to "why" in one keystroke; that path doesn't exist.

**Sam (accessibility):** several flags. StatusDot is `aria-hidden` and the only state encoding on mobile. The state text column is `hide-mobile`, removing the only non-color cue. The 'primary' badge and 'resident' count rely on color and jargon. The 9–10px mono labels are below comfortable readability even with zoom. The sort buttons' faint 40%-opacity ArrowUpDown icon may be below contrast threshold.

## Minor Observations

- 'primary' badge at `text-[9px]` is extremely small; tracking makes it hard to read.
- `upstreamHost` in `text-[10px]` likely truncates on narrow cards with no tooltip.
- 'out tok' formats `>=1000` as `k` but 'reqs' doesn't — inconsistent number formatting across adjacent columns.
- Window toggle buttons announce '7d' to screen readers, ambiguous without context.
- Fleet grid is `auto-rows-min` with varying card heights — ragged bottom edge hurts scanability.
- 'no models' empty state is terse; could say 'no models configured on this host'.

## Questions to Consider

- If a host is unreachable, why does the card show a red dot but no error, no last-seen, and no "what to do next"? Is the failure path simply unfinished?
- The performance table hides `errorCount` and `avgDurationMs` — is the product hiding the metric that would actually tell an operator the fleet is degrading?
- The Fleet card isn't clickable. For a watchtower, shouldn't a host card be the entry point to that host's detail?
- The window toggle is 7/30/90d only. For a model loaded for 2 hours, is a 7-day floor too coarse? Should there be a 'today' or 'live' window?

## Run Notes

Target slug `src-features-fleet-fleetpage-tsx`; no ignore list; assessments ran as two isolated parallel sub-agents (A design review, B detector+browser). CLI detector: 0 findings on source. Browser: 207 runtime findings, bulk false positives on off-screen mobile sidebar + devtools; real findings confirmed (undersized text, low contrast, `G P` collision). Browser automation degraded to manual headless-Chrome CDP workaround (browser_exec handshake timed out; no listener on 9222). Live server stopped cleanly; injected script tag left in place (config_missing, manual injection). Console capture drowned by the `G P` duplicate-handler flood; detector findings read via `window.impeccableDetectAsync()` return value instead.
