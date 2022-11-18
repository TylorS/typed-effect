import * as Either from '@fp-ts/data/Either'
import { pipe } from '@fp-ts/data/Function'

import { CauseError } from './Cause.js'
import { DefaultServices, DefaultServicesContext, getDefaultService } from './DefaultServices.js'
import * as Effect from './Effect.js'
import { Exit } from './Exit.js'
import { Live, None } from './FiberId.js'
import { makeFiberRefs } from './FiberRefs.js'
import { FiberRuntime, RuntimeOptions } from './FiberRuntime.js'
import { FiberScope, GlobalFiberScope } from './FiberScope.js'
import { IdGenerator } from './IdGenerator.js'
import { RuntimeFlags } from './RuntimeFlags.js'
import { Scheduler } from './Scheduler.js'

export interface Runtime<R> {
  readonly forkFiber: <E, A>(
    effect: Effect.Effect<R, E, A>,
    options?: Partial<RuntimeOptions<R>>,
  ) => FiberRuntime<R, E, A>

  readonly runWith: <E, A>(
    effect: Effect.Effect<R, E, A>,
    f: (exit: Exit<E, A>) => void,
    options?: Partial<RuntimeOptions<R>>,
  ) => void

  readonly runPromiseExit: <E, A>(
    effect: Effect.Effect<R, E, A>,
    options?: Partial<RuntimeOptions<R>>,
  ) => Promise<Exit<E, A>>

  readonly runPromise: <E, A>(
    effect: Effect.Effect<R, E, A>,
    options?: Partial<RuntimeOptions<R>>,
  ) => Promise<A>
}

export function Runtime<R>(options: RuntimeOptions<R>): Runtime<R> {
  const scheduler = getDefaultService(options.context, options.fiberRefs, Scheduler)
  const makeNextId = getDefaultService(options.context, options.fiberRefs, IdGenerator)
  const makeNextFiberId = () => Live(makeNextId(), scheduler.time.get())

  // TODO: Fork FiberRefs + Scheduler
  const makeOptions = (overrides?: Partial<RuntimeOptions<R>>): RuntimeOptions<R> => ({
    ...options,
    ...overrides,
  })

  const forkFiber: Runtime<R>['forkFiber'] = (effect, overrides) => {
    const id = makeNextFiberId()
    const opts = makeOptions(overrides)
    const scope = FiberScope(id)
    const child = new FiberRuntime(effect, id, { ...opts, scope })

    opts.scope.addChild(child)

    return child
  }

  const runWith: Runtime<R>['runWith'] = (effect, f, overrides) => {
    const r = forkFiber(effect, overrides)
    r.addObserver(f)
    r.start()
    return r
  }

  const runPromiseExit: Runtime<R>['runPromiseExit'] = (effect, overrides) =>
    new Promise((resolve) => runWith(effect, resolve, overrides))

  const runPromise: Runtime<R>['runPromise'] = (effect, overrides) =>
    new Promise((resolve, reject) =>
      runWith(
        effect,
        Either.match((cause) => reject(new CauseError(cause)), resolve),
        overrides,
      ),
    )

  return {
    forkFiber,
    runWith,
    runPromiseExit,
    runPromise,
  }
}

export const DefaultRuntime: Runtime<DefaultServices> = Runtime({
  context: DefaultServicesContext,
  scope: FiberScope(None),
  fiberRefs: makeFiberRefs(),
  flags: RuntimeFlags(),
})

export const {
  forkFiber: forkMainFiber,
  runWith: runMainWith,
  runPromise: runMain,
  runPromiseExit: runMainExit,
} = DefaultRuntime

const getRuntimeOptions_ = Effect.getRuntimeOptions<any>()

export const runtime = <R>(): Effect.Effect<R, never, Runtime<R>> =>
  pipe(getRuntimeOptions_, Effect.map(Runtime))

export const runtimeDaemon = <R>(): Effect.Effect<R, never, Runtime<R>> =>
  pipe(
    Effect.getRuntimeOptions<R>(),
    Effect.map((opts) =>
      Runtime({
        ...opts,
        scope: getDefaultService(opts.context, opts.fiberRefs, GlobalFiberScope),
      }),
    ),
  )
