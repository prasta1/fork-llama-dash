import { describe, expect, it, vi } from 'vitest'

vi.mock('./gpu-poller.ts', () => ({
  getGpuSnapshot: () => ({
    available: true,
    cpuUtilizationPercent: 40,
    driver: 'nvidia',
    polledAt: Date.now(),
    gpus: [
      {
        index: 0,
        name: 'RTX Test',
        memoryUsedMiB: 1024,
        memoryTotalMiB: 2048,
        memoryPercent: 50,
        utilizationPercent: 25,
        temperatureC: 61,
        powerW: 110,
        powerMaxW: 250,
        cores: null,
      },
    ],
  }),
}))

vi.mock('./llama-swap/client.ts', () => ({
  createLlamaSwapClient: () => ({
    health: vi.fn(async () => 'OK'),
    listRunning: vi.fn(async () => ({ running: [{ model: 'local-a' }, { model: 'local-b' }] })),
  }),
}))

vi.mock('./proxy/log.ts', () => ({
  getRequestLogQueueStats: () => ({ queued: 3, dropped: 1 }),
}))

vi.mock('./db/index.ts', () => {
  function chain(result: unknown) {
    const api = {
      from: () => api,
      groupBy: () => api,
      where: () => api,
      all: () => result,
      get: () => result,
    }
    return api
  }
  let selectCalls = 0
  return {
    db: {
      select: () => {
        selectCalls++
        if (selectCalls === 1) {
          return chain([
            {
              nodeId: 'primary',
              endpoint: '/v1/messages',
              model: 'claude-test',
              statusCode: 200,
              streamed: true,
              count: 2,
            },
            {
              nodeId: 'studio',
              endpoint: '/v1/messages',
              model: 'claude-test',
              statusCode: 200,
              streamed: true,
              count: 7,
            },
            { nodeId: null, endpoint: '/v1/messages', model: 'claude-test', statusCode: 200, streamed: true, count: 1 },
          ])
        }
        if (selectCalls === 2) {
          return chain([
            {
              nodeId: 'primary',
              model: 'claude-test',
              promptTokens: 10,
              completionTokens: 5,
              cacheCreationTokens: 2,
              cacheReadTokens: 1,
              totalTokens: 18,
            },
          ])
        }
        if (selectCalls === 3) {
          return chain([
            { durationMs: 100, nodeId: 'primary' },
            { durationMs: 300, nodeId: 'primary' },
            { durationMs: 5000, nodeId: 'studio' },
          ])
        }
        return chain({ success: 2, failure: 1 })
      },
    },
    schema: {
      requests: {
        nodeId: 'nodeId',
        endpoint: 'endpoint',
        model: 'model',
        statusCode: 'statusCode',
        streamed: 'streamed',
        promptTokens: 'promptTokens',
        completionTokens: 'completionTokens',
        cacheCreationTokens: 'cacheCreationTokens',
        cacheReadTokens: 'cacheReadTokens',
        totalTokens: 'totalTokens',
        durationMs: 'durationMs',
        startedAt: 'startedAt',
        credentialInjectionJson: 'credentialInjectionJson',
      },
    },
  }
})

import { renderPrometheusMetrics } from './metrics'

describe('renderPrometheusMetrics', () => {
  it('renders core prometheus metrics', async () => {
    const body = await renderPrometheusMetrics()

    expect(body).toContain(
      'llama_dash_requests_total{node="primary",endpoint="/v1/messages",model="claude-test",status_class="2xx",streamed="true"} 2',
    )
    expect(body).toContain('llama_dash_tokens_total{node="primary",model="claude-test",type="total"} 18')
    expect(body).toContain('llama_dash_log_queue_depth 3')
    expect(body).toContain('llama_dash_log_queue_dropped_total 1')
    expect(body).toContain('llama_dash_credential_injections_total{result="success"} 2')
    expect(body).toContain('llama_dash_credential_injections_total{result="failure"} 1')
    expect(body).toContain('llama_dash_upstream_reachable{node="primary"} 1')
    expect(body).toContain('llama_dash_models_running{node="primary"} 2')
    expect(body).toContain('llama_dash_cpu_utilization_percent 40')

    // Each node keeps its own series instead of being summed.
    expect(body).toContain(
      'node="studio",endpoint="/v1/messages",model="claude-test",status_class="2xx",streamed="true"} 7',
    )
    expect(body).toContain(
      'node="unknown",endpoint="/v1/messages",model="claude-test",status_class="2xx",streamed="true"} 1',
    )
    expect(body).toContain('llama_dash_request_duration_p95_seconds_30m{node="studio"} 5')
    expect(body).toContain('llama_dash_request_duration_p50_seconds_30m{node="primary"} 0.1')
    expect(body).not.toMatch(/llama_dash_request_duration_p\d+_seconds_30m \d/)
    expect(body).toContain('llama_dash_gpu_memory_used_bytes{index="0",name="RTX Test",driver="nvidia"} 1073741824')
  })
})
