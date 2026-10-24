import { RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '../../components/PageHeader'
import { RouteError } from '../../components/RouteError'
import { cn } from '../../lib/cn'
import { useFleet } from '../../lib/queries'

type PerformanceRow = {
  hostId: string
  hostLabel: string
  primary: boolean
  model: string
  avgTokensPerSecond: number | null
  requests: number
  outputTokens: number
}

const WINDOWS = [7, 30, 90] as const

export function FleetPerformancePage() {
  const [windowDays, setWindowDays] = useState<number>(7)
  const { data, error, isRefetching, refetch } = useFleet(windowDays)

  if (error) {
    return <RouteError kicker="dsh · fleet · perf" title="Failed to load performance" message={error.message} />
  }

  const hosts = data?.hosts ?? []
  const rows: PerformanceRow[] = hosts.flatMap((host) =>
    host.activity.models.map((m) => ({
      hostId: host.id,
      hostLabel: host.label,
      primary: host.primary,
      model: m.model,
      avgTokensPerSecond: m.avgTokensPerSecond,
      requests: m.requests,
      outputTokens: m.outputTokens,
    })),
  )
  rows.sort((a, b) => b.requests - a.requests)
  const hasActivity = hosts.some((h) => h.activity.available && h.activity.models.length > 0)

  return (
    <div className="content">
      <div className="page min-h-full bg-surface-1">
        <PageHeader
          kicker="dsh · fleet · perf"
          title="Performance"
          subtitle={`per-model averages from llama-swap activity · ${windowDays}d`}
          variant="integrated"
          action={
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-px rounded border border-border bg-surface-2 p-px">
                {WINDOWS.map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setWindowDays(w)}
                    className={cn(
                      'rounded px-2 py-1 font-mono text-[10px] transition-colors',
                      windowDays === w ? 'bg-accent text-accent-on' : 'text-fg-dim hover:text-fg',
                    )}
                    aria-pressed={windowDays === w}
                  >
                    {w}d
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                onClick={() => refetch()}
                disabled={isRefetching}
                aria-label="Refresh performance"
              >
                <RefreshCw
                  className={cn('size-3.5 shrink-0', isRefetching && 'animate-spin')}
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
              </button>
            </div>
          }
        />

        <section className="panel !rounded-none !border-x-0 !bg-surface-1">
          {data == null ? (
            <div className="empty-state px-6 max-md:px-3">loading performance…</div>
          ) : !hasActivity ? (
            <div className="empty-state px-6 py-4 max-md:px-3">
              no activity recorded in the last {windowDays} days.
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="dtable">
                <thead>
                  <tr>
                    <th className="mono" style={{ minWidth: 120 }}>
                      host
                    </th>
                    <th className="mono">model</th>
                    <th className="num">tok/s</th>
                    <th className="num hide-mobile">reqs</th>
                    <th className="num hide-mobile">out tok</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={`${r.hostId}:${r.model}`}>
                      <td className="mono text-[11px] text-fg-muted">
                        {r.hostLabel}
                        {r.primary ? (
                          <span className="ml-1.5 rounded bg-accent/15 px-1 py-px font-mono text-[9px] uppercase tracking-[0.12em] text-accent">
                            primary
                          </span>
                        ) : null}
                      </td>
                      <td className="mono break-all">{r.model}</td>
                      <td className="num font-mono text-[11px] text-fg">
                        {r.avgTokensPerSecond != null ? r.avgTokensPerSecond.toFixed(1) : '—'}
                      </td>
                      <td className="num hide-mobile font-mono text-[11px] text-fg-dim">{r.requests}</td>
                      <td className="num hide-mobile font-mono text-[11px] text-fg-dim">
                        {r.outputTokens >= 1000 ? `${(r.outputTokens / 1000).toFixed(0)}k` : r.outputTokens}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
