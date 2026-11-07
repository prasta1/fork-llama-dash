import { execFileSync } from 'node:child_process'
import tailwindcss from '@tailwindcss/vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

const gitCommit = (() => {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim()
  } catch {
    return 'unknown'
  }
})()

const config = defineConfig(({ mode }) => {
  // Vite's dev server is loopback-only by default and rejects requests whose
  // Host header isn't in `allowedHosts` (a DNS-rebinding guard). Both are
  // configurable so reaching the dashboard from another machine on the LAN or
  // a tailnet doesn't require editing this file. See `.env.example`.
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
  const allowedHosts = (env.DEV_ALLOWED_HOSTS ?? 'localhost')
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean)

  return {
    server: {
      // Bind all interfaces so the dashboard is reachable from other hosts.
      host: env.DEV_HOST || true,
      allowedHosts,
    },
    define: {
      __GIT_COMMIT__: JSON.stringify(gitCommit),
    },
    resolve: { tsconfigPaths: true },
    plugins: [
      devtools({
        editor: {
          name: 'macOS open',
          open: async (path) => {
            const { spawn } = await import('node:child_process')

            spawn('open', [path], {
              detached: true,
              stdio: 'ignore',
            }).unref()
          },
        },
      }),
      tailwindcss(),
      tanstackStart(),
      viteReact(),
    ],
  }
})

export default config
