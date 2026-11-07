import { seriesVar } from '../lib/series-color'

/**
 * Names the fleet host a request or model belongs to. Node identity is a category, not a state, so the dot
 * uses the --series ramp (see series-color.ts) and never --ok / --warn / --err.
 */
export function NodeBadge({ label, step, active = true }: { label: string; step: number; active?: boolean }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-sm border border-border px-1.5 py-0.5 font-mono text-[10px] text-fg-dim">
      <span
        className="size-1.5 shrink-0 rounded-full"
        style={active ? { background: seriesVar(step) } : { boxShadow: `inset 0 0 0 1px ${seriesVar(step)}` }}
        aria-hidden="true"
      />
      <span className="truncate">{label}</span>
      {active ? null : <span className="sr-only">(idle)</span>}
    </span>
  )
}
