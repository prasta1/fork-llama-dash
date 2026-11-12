import { existsSync, copyFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'

export type ModelActivityStats = {
  model: string
  requests: number
  avgTokensPerSecond: number | null
  avgDurationMs: number | null
  outputTokens: number
  inputTokens: number
  errorCount: number
}

export type ActivitySummary = {
  available: boolean
  path: string | null
  error: string | null
  windowDays: number
  models: ModelActivityStats[]
}

/**
 * Reads per-model performance from a llama-swap activity SQLite store.
 * llama-swap records every request's input/output tokens, tokens/sec, and
 * duration into this store (config `store.path`), so llama-dash can observe
 * fleet performance WITHOUT being in the traffic path. This is the
 * "watchtower" data source.
 *
 * The store is read-only here — llama-dash never writes to it.
 */
export function readActivitySummary(storePath: string | null, windowDays = 7): ActivitySummary {
  if (!storePath || !existsSync(storePath)) {
    return { available: false, path: storePath, error: 'activity store not found', windowDays, models: [] }
  }

  let db: Database.Database | null = null
  let tempDir: string | null = null
  try {
    // SQLite needs real file locking, which SMB mounts don't provide (and the
    // live llama-swap process holds the store open). Copy to a local temp file
    // before opening so remote/secondary stores read reliably.
    tempDir = mkdtempSync(join(tmpdir(), 'llama-dash-activity-'))
    const localPath = join(tempDir, 'activity.sqlite')
    copyFileSync(storePath, localPath)
    db = new Database(localPath, { readonly: true })
    const since = Math.floor(Date.now() / 1000) - windowDays * 86400
    const rows = db
      .prepare(
        `SELECT
           model_id AS model,
           count(*) AS requests,
           avg(tokens_per_second) AS avgTokensPerSecond,
           avg(duration_ms) AS avgDurationMs,
           sum(output_tokens) AS outputTokens,
           sum(input_tokens) AS inputTokens,
           sum(CASE WHEN resp_status_code >= 400 THEN 1 ELSE 0 END) AS errorCount
         FROM activity
         WHERE ts_created > ?
         GROUP BY model_id
         ORDER BY requests DESC`,
      )
      .all(since) as Array<{
      model: string
      requests: number
      avgTokensPerSecond: number | null
      avgDurationMs: number | null
      outputTokens: number | null
      inputTokens: number | null
      errorCount: number | null
    }>

    return {
      available: true,
      path: storePath,
      error: null,
      windowDays,
      models: rows.map((r) => ({
        model: r.model,
        requests: r.requests,
        avgTokensPerSecond: r.avgTokensPerSecond != null ? Math.round(r.avgTokensPerSecond * 10) / 10 : null,
        avgDurationMs: r.avgDurationMs != null ? Math.round(r.avgDurationMs) : null,
        outputTokens: r.outputTokens ?? 0,
        inputTokens: r.inputTokens ?? 0,
        errorCount: r.errorCount ?? 0,
      })),
    }
  } catch (err) {
    return {
      available: false,
      path: storePath,
      error: err instanceof Error ? err.message : String(err),
      windowDays,
      models: [],
    }
  } finally {
    db?.close()
    if (tempDir) rmSync(tempDir, { recursive: true, force: true })
  }
}
