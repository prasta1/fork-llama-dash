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
      <div className="page min-h-full flex-1 bg-surface-1">
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

        <section className="panel !rounded-none !border-x-0 !bg-surface-1 flex min-h-0 flex-1 flex-col">
          {data == null ? (
            <div className="empty-state px-6 max-md:px-3">loading fleet…</div>
          ) : data.hosts.length === 0 ? (
            <div className="empty-state px-6 max-md:px-3">
              no fleet hosts configured. set FLEET_HOSTS to add secondary llama-swap instances.
            </div>
          ) : (
            <div className="grid min-h-0 flex-1 auto-rows-min gap-4 p-4 max-md:grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
              {data.hosts.map((host) => (
                <HostCard key={host.id} host={host} />
              ))}
            </div>
          )}
        </section>
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
        {host.health.latencyMs != null ? (
          <span>{host.health.latencyMs}ms</span>
        ) : null}
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
