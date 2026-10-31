// DI bag. ONE LINE PER SERVICE: an owner swaps in their real implementation by editing only their own line.
// Flags: ALONGSIDE_MOCK=1 mocks every model-backed service; ALONGSIDE_MOCK_<NAME>=1 mocks one (NAME in upper case,
// e.g. ALONGSIDE_MOCK_GROUNDER=1). Plumbing services (overlay, live) are real by default and mocked only per-service.
// Factories must not touch `s` at construction time: other services may not exist yet. Read `s.x` inside methods.
import type { Services, ServiceName } from '../shared/contracts'
import type { ServiceContext } from './context'
import { createCapture } from './capture'
import { createLiveBridge } from './live-bridge'
import { createOverlayController } from './overlay-controller'
import { createAgentsFromServices } from './agents/wire'
import {
  mockAgents,
  mockArchitect,
  mockCapture,
  mockGrounder,
  mockLearner,
  mockLevels,
  mockLiveBridge,
  mockOverlay,
  mockRouter,
  mockRunner,
  mockScam,
  mockTeaching,
  mockVerifier,
} from './mocks'

const PLUMBING: ReadonlySet<ServiceName> = new Set<ServiceName>(['overlay', 'live'])

export function isMocked(name: ServiceName): boolean {
  if (process.env[`ALONGSIDE_MOCK_${name.toUpperCase()}`] === '1') return true
  return process.env.ALONGSIDE_MOCK === '1' && !PLUMBING.has(name)
}

// With no real factory yet, the mock is used regardless of flags.
function pick<T>(name: ServiceName, mock: () => T, real?: () => T): T {
  return real && !isMocked(name) ? real() : mock()
}

export function createServices(ctx: ServiceContext): Services {
  const s = {} as Services
  s.capture = pick('capture', () => mockCapture(), () => createCapture(ctx)) // OVERLAY
  s.overlay = pick('overlay', () => mockOverlay(ctx), () => createOverlayController(ctx)) // OVERLAY
  s.grounder = pick('grounder', () => mockGrounder()) // SERVICES
  s.verifier = pick('verifier', () => mockVerifier()) // SERVICES
  s.architect = pick('architect', () => mockArchitect()) // SERVICES
  s.scam = pick('scam', () => mockScam()) // SERVICES
  s.router = pick('router', () => mockRouter()) // SERVICES
  s.live = pick('live', () => mockLiveBridge(ctx), () => createLiveBridge(ctx)) // LIVE
  s.learner = pick('learner', () => mockLearner()) // TEACH
  s.levels = pick('levels', () => mockLevels()) // TEACH
  s.runner = pick('runner', () => mockRunner(ctx, s)) // TEACH
  s.teaching = pick('teaching', () => mockTeaching(ctx)) // TEACH
  s.agents = pick('agents', () => mockAgents(ctx, s), () => createAgentsFromServices(ctx, s)) // AGENTS
  return s
}
