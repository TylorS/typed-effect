import * as Context from '@fp-ts/data/Context'
import { pipe } from '@fp-ts/data/Function'

import { Clock } from './Clock.js'
import { DefaultEnv, DefaultServices } from './DefaultServices.js'
import * as Effect from './Effect.js'
import { makeFiberRefs } from './FiberRefs.js'
import { FiberRuntimeFlags } from './FiberRuntimeFlags.js'
import { Layer } from './Layer.js'
import { Runtime } from './Runtime.js'
import { Scheduler } from './Scheduler.js'
import { Timer } from './Timer.js'

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
  context: DefaultEnv,
  fiberRefs: makeFiberRefs(),
  flags: FiberRuntimeFlags(),
})

export const {
  runWith: runMainWith,
  runPromise: runMain,
  runPromiseExit: runMainExit,
} = DefaultRuntime

export const getClock: Effect.Effect<never, never, Clock> = pipe(
  DefaultServices,
  Effect.getFiberRef,
  Effect.map(Context.get(Clock)),
)

export const getTimer: Effect.Effect<never, never, Timer> = pipe(
  DefaultServices,
  Effect.getFiberRef,
  Effect.map(Context.get(Timer)),
)

export const getScheduler: Effect.Effect<never, never, Scheduler> = pipe(
  DefaultServices,
  Effect.getFiberRef,
  Effect.map(Context.get(Scheduler)),
)

export const context = <R>(): Effect.Effect<R, never, Context.Context<R>> =>
  Effect.access(Effect.of)

export const runtime = <R>(): Effect.Effect<R, never, Runtime<R>> =>
  Effect.Effect(function* () {
    return Runtime({
      context: yield* context<R>(),
      fiberRefs: yield* Effect.getFiberRefs,
      flags: yield* Effect.getRuntimeFlags,
    })
  })
