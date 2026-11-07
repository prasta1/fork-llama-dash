import { ArrowDown, ArrowUp, ArrowUpDown, RefreshCw } from 'lucide-react'
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

type SortKey = 'host' | 'model' | 'tokPerSec' | 'requests' | 'outputTokens'
type SortDir = 'asc' | 'desc'

const WINDOWS = [7, 30, 90] as const

const COLUMNS: Array<{ key: SortKey; label: string; num?: boolean; hideMobile?: boolean }> = [
  { key: 'host', label: 'host' },
  { key: 'model', label: 'model' },
  { key: 'tokPerSec', label: 'tok/s', num: true },
  { key: 'requests', label: 'reqs', num: true, hideMobile: true },
  { key: 'outputTokens', label: 'out tok', num: true, hideMobile: true },
]

function sortRows(rows: PerformanceRow[], key: SortKey, dir: SortDir): PerformanceRow[] {
  const sorted = [...rows]
  const dirMult = dir === 'asc' ? 1 : -1
  sorted.sort((a, b) => {
    let cmp = 0
    switch (key) {
      case 'host':
        cmp = a.hostLabel.localeCompare(b.hostLabel)
        break
      case 'model':
        cmp = a.model.localeCompare(b.model)
        break
      case 'tokPerSec':
        cmp = (a.avgTokensPerSecond ?? -1) - (b.avgTokensPerSecond ?? -1)
        break
      case 'requests':
        cmp = a.requests - b.requests
        break
      case 'outputTokens':
        cmp = a.outputTokens - b.outputTokens
        break
    }
    return cmp * dirMult
  })
  return sorted
}

export function FleetPerformancePage() {
  const [windowDays, setWindowDays] = useState<number>(7)
  const [sortKey, setSortKey] = useState<SortKey>('requests')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
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
  const sorted = sortRows(rows, sortKey, sortDir)
  const hasActivity = hosts.some((h) => h.activity.available && h.activity.models.length > 0)

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'host' || key === 'model' ? 'asc' : 'desc')
    }
  }

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
                    {COLUMNS.map((col) => {
                      const active = sortKey === col.key
                      return (
                        <th
                          key={col.key}
                          className={cn('mono', col.num && 'num', col.hideMobile && 'hide-mobile')}
                          style={col.key === 'host' ? { minWidth: 120 } : undefined}
                        >
                          <button
                            type="button"
                            onClick={() => toggleSort(col.key)}
                            className={cn(
                              'inline-flex items-center gap-1 font-mono uppercase tracking-[0.12em] transition-colors',
                              active ? 'text-fg' : 'text-fg-dim hover:text-fg',
                            )}
                            aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                          >
                            {col.label}
                            {active ? (
                              sortDir === 'asc' ? (
                                <ArrowUp className="size-3" strokeWidth={2} aria-hidden="true" />
                              ) : (
                                <ArrowDown className="size-3" strokeWidth={2} aria-hidden="true" />
                              )
                            ) : (
                              <ArrowUpDown className="size-3 opacity-40" strokeWidth={1.5} aria-hidden="true" />
                            )}
                          </button>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((r) => (
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
