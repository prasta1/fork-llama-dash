import { RefreshCw } from 'lucide-react'
import { PageHeader } from '../../components/PageHeader'
import { RouteError } from '../../components/RouteError'
import { StatusDot, stateTone } from '../../components/StatusDot'
import { cn } from '../../lib/cn'
import { useFleet } from '../../lib/queries'
import type { ApiFleetHost } from '../../lib/schemas/fleet'

export function FleetPage() {
  const { data, error, isRefetching, refetch } = useFleet()

  if (error) {
    return <RouteError kicker="dsh · fleet" title="Failed to load fleet" message={error.message} />
  }

  return (
    <div className="content">
      <div className="page min-h-full bg-surface-1">
        <PageHeader
          kicker="dsh · fleet"
          title="Fleet"
          subtitle="all observed llama-swap instances · read-only"
          variant="integrated"
          action={
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                onClick={() => refetch()}
                disabled={isRefetching}
                aria-label="Refresh fleet"
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

        {data != null ? (
          <>
            <section className="panel !rounded-none !border-x-0 !border-b !bg-surface-1">
              {data.hosts.length === 0 ? (
                <div className="empty-state px-6 max-md:px-3">
                  no fleet hosts configured. set FLEET_HOSTS to add secondary llama-swap instances.
                </div>
              ) : (
                <div className="grid auto-rows-min gap-4 p-4 max-md:grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                  {data.hosts.map((host) => (
                    <HostCard key={host.id} host={host} />
                  ))}
                </div>
              )}
            </section>

            <PerformanceSection hosts={data.hosts} />
          </>
        ) : (
          <section className="panel !rounded-none !border-x-0 !bg-surface-1 flex flex-1 flex-col">
            <div className="empty-state px-6 max-md:px-3">loading fleet…</div>
          </section>
        )}
      </div>
    </div>
  )
}

function HostCard({ host }: { host: ApiFleetHost }) {
  const reachable = host.health.reachable
  const resident = host.running.filter((r) => r.state === 'ready').length
  const total = host.models.length

  return (
    <div className="flex flex-col overflow-hidden rounded border border-border bg-surface-2">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <StatusDot tone={reachable ? 'ok' : 'err'} live={reachable} />
          <span className="truncate font-mono text-sm font-medium text-fg">{host.label}</span>
          {host.primary ? (
            <span className="rounded bg-accent/15 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-accent">
              primary
            </span>
          ) : null}
        </div>
        <span className="shrink-0 font-mono text-[10px] text-fg-dim">{host.upstreamHost}</span>
      </div>

      <div className="flex items-center gap-4 border-b border-border px-3 py-2 font-mono text-[11px] text-fg-muted">
        <span>
          <span className="text-fg">{resident}</span>/{total} resident
        </span>
        {host.health.latencyMs != null ? <span>{host.health.latencyMs}ms</span> : null}
        {host.health.version ? <span className="truncate">{host.health.version}</span> : null}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {host.models.length === 0 ? (
          <div className="px-3 py-3 font-mono text-xs text-fg-dim">no models</div>
        ) : (
          <table className="dtable">
            <thead>
              <tr>
                <th style={{ width: 18 }} aria-label="state" />
                <th className="mono">id</th>
                <th style={{ width: 90 }} className="hide-mobile">
                  state
                </th>
              </tr>
            </thead>
            <tbody>
              {host.models.map((m) => {
                const run = host.running.find((r) => r.model === m.id)
                const state = run?.state ?? 'stopped'
                return (
                  <tr key={m.id}>
                    <td>
                      <StatusDot tone={stateTone(state, m.running)} live={m.running} />
                    </td>
                    <td className="mono break-all">{m.id}</td>
                    <td className="hide-mobile font-mono text-[11px] text-fg-dim">{state}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

type PerformanceRow = {
  hostId: string
  hostLabel: string
  model: string
  avgTokensPerSecond: number | null
  requests: number
  outputTokens: number
}

function PerformanceSection({ hosts }: { hosts: ApiFleetHost[] }) {
  const rows: PerformanceRow[] = hosts.flatMap((host) =>
    host.activity.models.map((m) => ({
      hostId: host.id,
      hostLabel: host.label,
      model: m.model,
      avgTokensPerSecond: m.avgTokensPerSecond,
      requests: m.requests,
      outputTokens: m.outputTokens,
    })),
  )

  rows.sort((a, b) => b.requests - a.requests)

  const hasActivity = hosts.some((h) => h.activity.available && h.activity.models.length > 0)

  return (
    <section className="panel !rounded-none !border-x-0 !bg-surface-1">
      <div className="px-4 pt-4 pb-2">
        <h2 className="m-0 font-mono text-xs font-medium tracking-wide text-fg">Performance</h2>
        <p className="m-0 mt-0.5 font-mono text-[10px] text-fg-dim">
          per-model averages from llama-swap activity · 7d
        </p>
      </div>
      {!hasActivity ? (
        <div className="empty-state px-6 pb-4 max-md:px-3">no activity recorded in the observation window.</div>
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
                    {hosts.find((h) => h.id === r.hostId)?.primary ? (
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
  )
}