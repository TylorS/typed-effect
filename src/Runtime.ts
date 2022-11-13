import * as Context from '@fp-ts/data/Context'
import * as Either from '@fp-ts/data/Either'
import { pipe } from '@fp-ts/data/Function'
import * as Option from '@fp-ts/data/Option'

import { CauseError } from './Cause.js'
import { Clock } from './Clock.js'
import { DefaultEnv, DefaultServices, IdGenerator } from './DefaultServices.js'
import * as Effect from './Effect.js'
import { Exit } from './Exit.js'
import { FiberId } from './FiberId.js'
import { FiberRuntime, FiberRuntimeOptions } from './FiberRuntime.js'

export interface Runtime<R> {
  readonly runWith: <E, A>(
    effect: Effect.Effect<R, E, A>,
    f: (exit: Exit<E, A>) => void,
    options?: Partial<FiberRuntimeOptions<R>>,
  ) => void
  readonly runPromiseExit: <E, A>(
    effect: Effect.Effect<R, E, A>,
    options?: Partial<FiberRuntimeOptions<R>>,
  ) => Promise<Exit<E, A>>
  readonly runPromise: <E, A>(
    effect: Effect.Effect<R, E, A>,
    options?: Partial<FiberRuntimeOptions<R>>,
  ) => Promise<A>
}

export function Runtime<R>(options: FiberRuntimeOptions<R>): Runtime<R> {
  const clock = getDefaultService(options, Clock)
  const makeNextId = getDefaultService(options, IdGenerator)
  const makeNextFiberId = () => FiberId(makeNextId(), clock.currentTime())
  const makeOptions = (overrides?: Partial<FiberRuntimeOptions<R>>): FiberRuntimeOptions<R> => ({
    ...options,
    ...overrides,
  })

  const runWith: Runtime<R>['runWith'] = (effect, f, overrides) => {
    const r = new FiberRuntime(effect, makeNextFiberId(), makeOptions(overrides))
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
    runWith,
    runPromiseExit,
    runPromise,
  }
}

const getDefaultService = <R, S extends DefaultServices>(
  options: FiberRuntimeOptions<R>,
  service: Context.Tag<S>,
): S => {
  const contextOption = pipe(options.context, Context.getOption<S>(service))

  if (Option.isSome(contextOption)) {
    return contextOption.value
  }

  return pipe(
    options.fiberRefs.getOption(DefaultServices),
    Option.getOrElse(DefaultEnv),
    Context.get(service as Context.Tags<S>),
  ) as S
}
