import * as Context from '@fp-ts/data/Context'
import { pipe } from '@fp-ts/data/Function'

import { Clock } from './Clock.js'
import { DefaultServices, DefaultServicesContext, getDefaultService } from './DefaultServices.js'
import * as Effect from './Effect.js'
import { Fiber } from './Fiber.js'
import { None } from './FiberId.js'
import { makeFiberRefs } from './FiberRefs.js'
import { RuntimeOptions } from './FiberRuntime.js'
import { FiberScope, GlobalFiberScope } from './FiberScope.js'
import { Layer } from './Layer.js'
import { Runtime } from './Runtime.js'
import { RuntimeFlags } from './RuntimeFlags.js'
import { Scheduler } from './Scheduler.js'

export function provideService<S>(tag: Context.Tag<S>, service: S) {
  const addService = Context.add(tag)(service)

  return <R, E, A>(effect: Effect.Effect<R | S, E, A>): Effect.Effect<Exclude<R, S>, E, A> =>
    Effect.access((env) => pipe(effect, Effect.provide(addService(env as Context.Context<R>))))
}

export function provideLayer<R2, E2, S>(layer: Layer<R2, E2, S>) {
  return <R, E, A>(
    effect: Effect.Effect<R | S, E, A>,
  ): Effect.Effect<R2 | Exclude<R, S>, E | E2, A> =>
    Effect.access((env) =>
      pipe(
        layer,
        Effect.getFiberRef,
        Effect.flatMap((env2) =>
          pipe(effect, Effect.provide(Context.merge(env2)(env as Context.Context<R | R2>))),
        ),
      ),
    )
}

export function ask<S>(tag: Context.Tag<S>): Effect.Effect<S, never, S> {
  return Effect.access(
    (env: Context.Context<S>) =>
      pipe(env, Context.get(tag as Context.Tags<S>), Effect.of) as Effect.Effect<never, never, S>,
  )
}

export function asks<S, A>(tag: Context.Tag<S>, f: (s: S) => A): Effect.Effect<S, never, A> {
  return pipe(ask(tag), Effect.map(f))
}

export function asksEffect<S, R, E, A>(
  tag: Context.Tag<S>,
  f: (s: S) => Effect.Effect<R, E, A>,
): Effect.Effect<R | S, E, A> {
  return pipe(ask(tag), Effect.flatMap(f))
}

export const DefaultRuntime: Runtime<DefaultServices> = Runtime({
  context: DefaultServicesContext,
  scope: FiberScope(None),
  fiberRefs: makeFiberRefs(),
  flags: RuntimeFlags(),
})

export const {
  runWith: runMainWith,
  runPromise: runMain,
  runPromiseExit: runMainExit,
} = DefaultRuntime

export const getScheduler: Effect.Effect<never, never, Scheduler> = Effect.Effect(function* () {
  const ctx = yield* context<never>()
  const fiberRefs = yield* Effect.getFiberRefs

  return getDefaultService(ctx, fiberRefs, Scheduler)
})

export const getClock: Effect.Effect<never, never, Clock> = getScheduler

export const getGlobalFiberScope: Effect.Effect<never, never, GlobalFiberScope> = Effect.Effect(
  function* () {
    const ctx = yield* context<never>()
    const fiberRefs = yield* Effect.getFiberRefs

    return getDefaultService(ctx, fiberRefs, GlobalFiberScope)
  },
)

export const context = <R>(): Effect.Effect<R, never, Context.Context<R>> =>
  Effect.access(Effect.of)

const getRuntimeOptions_ = Effect.getRuntimeOptions<any>()

export const runtime = <R>(): Effect.Effect<R, never, Runtime<R>> =>
  pipe(getRuntimeOptions_, Effect.map(Runtime))

const getRuntime_ = runtime<any>()

export const fork = <R, E, A>(
  effect: Effect.Effect<R, E, A>,
  options?: Partial<RuntimeOptions<R>>,
): Effect.Effect<R, never, Fiber<E, A>> =>
  pipe(
    getRuntime_,
    Effect.map((r) => r.forkFiber(effect, options)),
  )

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
