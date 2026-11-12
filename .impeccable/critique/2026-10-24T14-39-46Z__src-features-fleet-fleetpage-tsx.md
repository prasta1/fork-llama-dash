---
target: fleet UI (FleetPage + FleetPerformancePage) re-critique
total_score: 32
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:/Users/macstudio/llama-dash/src/features/fleet/FleetPage.tsx"
target_fingerprint: "sha256:053e6e6d1afc0dfe063904a3c6903fc1fd33a305696be5ff3a9ca74da3ef96e4"
target_path: /Users/macstudio/llama-dash/src/features/fleet/FleetPage.tsx
timestamp: 2026-10-24T14-39-46Z
slug: src-features-fleet-fleetpage-tsx
---
# Re-Critique — llama-dash Fleet UI

**Method: dual-agent (A: sa-0-d9ba3fec · B: sa-1-acb298f3)** — B degraded (repetition loop cut the stream) but returned complete detector evidence before failing.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 4 | Dots, latency, version, unreachable banner, last-updated |
| 2 | Match System / Real World | 3 | 'avg ms' raw 6-digit values; 'ttl' unexplained |
| 3 | User Control and Freedom | 3 | Sortable, window toggle — but no drill-down, no keyboard for toggle |
| 4 | Consistency and Standards | 4 | Cohesive token system across both pages |
| 5 | Error Prevention | 3 | Read-only, low risk |
| 6 | Recognition Rather Than Recall | 3 | 'ready' count hides mid-run states; 'ttl' jargon |
| 7 | Flexibility and Efficiency | 4 | g-leader nav, sortable columns |
| 8 | Aesthetic and Minimalist Design | 3 | Dense but '0' error noise, raw ms values |
| 9 | Error Recovery | 3 | Unreachable banner now surfaces error (was 2) |
| 10 | Help and Documentation | 2 | No legend for ctx/ttl, no onboarding for g-leader |
| **Total** | | **32/40** | **Good** |

## Design Specificity Verdict

**Highly specific and disciplined** — a coherent dark/mono/terminal-adjacent system with a real token architecture, consistent headers, status dots, and g-leader nav. **All 8 prior fixes hold in source and live render.** The `G P` console flood is **gone** (detector confirms clean console on both pages). But specificity breaks down in two places: the Performance 'avg ms' column renders raw 6-digit values (live: `130376` for deepseek-r1) that force mental math, and the Fleet 'ready' count silently excludes starting/stopping models.

**Deterministic scan:** CLI static scan clean (0 findings). Runtime detector: 74 findings on Fleet, 77 on Performance — all on the **visible desktop viewport** (no off-screen sidebar false positives this time). Categories: undersized 9–10px text, low-contrast (2.1–3.3:1 vs 4.5:1), dark-glow on dots, text-overflow, cramped-padding, nested-cards, skipped-heading. **No JS exceptions.** The `G P` flood is confirmed absent.

## Overall Impression

The fixes landed and held — the failure path is no longer silent, the collision is gone, and the data is richer. The score is 32/40 (down 1 from 33), but that's **not a regression** — the re-review looked deeper and found two new data-presentation issues the first pass missed. The design is now specific about *chrome and tokens* but not yet about *humanizing the data it presents*.

## What's Working

1. **Cohesive, disciplined design system** — shared tokens, mono type, status-dot language, identical header/panel structure across both pages. One voice.
2. **g-leader nav with real pending-state feedback** — the dimmed leader + lit target key is a genuinely thoughtful power-user affordance.
3. **The unreachable-host banner now surfaces the actual error** (verified in source) — the operator gets the failure reason, not a bare label.
4. **Consistent k-formatting + right-aligned tabular-nums** make the perf table scannable; the err column flips red only when >0.

## Priority Issues

**[P1] Performance 'avg ms' renders raw 6-digit values** (live: `130376`, `26972`). Unreadable at a glance — the column answers "how slow" and forces mental math. **Fix:** humanize to `130s`/`2.2m`. → `$impeccable layout`

**[P1] Fleet 'ready' count hides mid-run states.** `2/16 ready` counts only `state==='ready'`, silently excluding starting/stopping. For "is anything mid-run," the numerator under-reports live state. **Fix:** count any non-stopped state, or show `ready` + `active` separately. → `$impeccable clarify`

**[P2] Mobile hides ctx and ttl entirely** (`hide-mobile` on both). The state text fix helped, but the two columns answering "is it loaded and how long" vanish on narrow viewports. **Fix:** keep ctx/ttl on mobile or move to a detail view. → `$impeccable adapt`

**[P2] 'no activity' empty state doesn't distinguish** "no data recorded" from "activity unavailable/error" — `activity.error` exists in the API but is never surfaced. **Fix:** show the error when present. → `$impeccable harden`

**[P3] '0' error values render in dim text on every row** — visual noise in a 24-row table. **Fix:** show only non-zero errors or an em-dash. → `$impeccable distill`

**[P3] Last-updated is time-only** (`toLocaleTimeString`) — for a 7/30/90d window, `9:57 AM` is ambiguous across days. **Fix:** include date or relative staleness. → `$impeccable polish`

## Persona Red Flags

**Alex (power user):** g-leader nav and sortable columns are excellent, but the most-used control — the 7/30/90d window toggle — is mouse-only with no keyboard shortcut, and the raw 6-digit ms values force extra cognitive work.

**Sam (accessibility):** the host-card StatusDot is `aria-hidden` with no text alternative; the leader-key pending state is color-only with no aria announcement; `--fg-dim` (#5d6461 on #0e1114) is low-contrast and likely fails WCAG AA; hide-mobile ctx/ttl means Sam on a narrow viewport loses the page's core data.

## Minor Observations

- Fleet card packs `2/16 ready`, latency, version into one 11px line — three data points easy to misread as related.
- 'primary' badge appears in both the card header and perf table — redundant but consistent.
- No affordance beyond the arrow icon tells the operator the table is already sorted.
- Nothing hints the data auto-refreshes on an interval.
- Fleet's empty state gives actionable guidance; perf's 'no activity' offers none.

## Questions to Consider

- If the core question is "is a model loaded and mid-run," why does the ready-count hide starting/stopping models?
- Is the operator really meant to read `130376` ms, or should the column be humanized?
- For a tool "shaped to be shareable," where's the onboarding for g-leader nav and ctx/ttl?
- Why is the most-used control (window toggle) mouse-only in a g-leader-driven UI?

## Run Notes

Target slug `src-features-fleet-fleetpage-tsx`; no ignore list; two isolated sub-agents. Assessment B degraded (repetition loop cut the stream) but returned complete detector evidence before failing (CLI 0 findings; runtime 74 Fleet / 77 Perf on visible viewport; `G P` flood confirmed absent; no JS exceptions). Browser automation degraded to manual headless-Chrome CDP (browser_exec handshake timeout); live server stopped directly. Assessment A sub-agent's scratch script write failed (cdp_drive.py) — throwaway, not repo code; project tree unaffected.
