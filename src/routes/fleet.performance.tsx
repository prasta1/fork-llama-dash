import { createFileRoute } from '@tanstack/react-router'
import { FleetPerformancePage } from '../features/fleet/FleetPerformancePage'

export const Route = createFileRoute('/fleet/performance')({ component: FleetPerformancePage })
