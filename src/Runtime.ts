import * as Either from '@fp-ts/data/Either'

import { CauseError } from './Cause.js'
import { getDefaultService } from './DefaultServices.js'
import * as Effect from './Effect.js'
import { Exit } from './Exit.js'
import { Live } from './FiberId.js'
import { FiberRuntime, RuntimeOptions } from './FiberRuntime.js'
import { FiberScope } from './FiberScope.js'
import { IdGenerator } from './IdGenerator.js'
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
