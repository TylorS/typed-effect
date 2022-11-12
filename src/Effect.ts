import type { Context } from '@fp-ts/data/Context'
import { left, right } from '@fp-ts/data/Either'
import { pipe } from '@fp-ts/data/Function'
import { Option } from '@fp-ts/data/Option'

import { Cause, CauseError } from './Cause.js'
import type { Exit } from './Exit.js'
import type { FiberRef } from './FiberRef.js'
import type { FiberRefs } from './FiberRefs.js'
import { FiberRuntimeFlags } from './FiberRuntimeFlags.js'
import type { Future } from './Future.js'
import * as I from './Instruction.js'

export interface Effect<Services, Errors, Output>
  extends Effect.Variance<Services, Errors, Output> {
  readonly [Symbol.iterator]: () => Generator<Effect<Services, Errors, any>, Output, any>
}

export function Effect<Eff extends Effect<any, any, any>, A>(
  f: () => Generator<Eff, A>,
  __trace?: string,
): Effect<Effect.ServicesOf<Eff>, Effect.ErrorsOf<Eff>, A> {
  return new I.Lazy(() => {
    const gen = f()

    return new I.FlatMapCause([
      runEffectGenerator(gen, gen.next()),
      (cause) => runEffectGenerator(gen, gen.throw(new CauseError(cause))),
    ])
  }, __trace)
}

export namespace Effect {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  export type ServicesOf<T> = [T] extends [Effect<infer R, infer _E, infer _A>] ? R : never
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  export type ErrorsOf<T> = [T] extends [Effect<infer _R, infer E, infer _A>] ? E : never
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  export type OutputOf<T> = [T] extends [Effect<infer _R, infer _E, infer A>] ? A : never

  /**
   * This is utilized to help TypeScript understand the variance of the Effect
   * within the type system. This helps ensure that inference works as expected.
   */
  export interface Variance<R, E, A> {
    readonly _R: (_: never) => R
    readonly _E: (_: never) => E
    readonly _A: (_: never) => A
  }
}

function runEffectGenerator<Eff extends Effect<any, any, any>, A>(
  gen: Generator<Eff, A>,
  result: IteratorResult<Eff, A>,
): Effect<Effect.ServicesOf<Eff>, Effect.ErrorsOf<Eff>, A> {
  if (result.done) {
    return new I.Of(result.value)
  }

  return new I.FlatMap([result.value, (value) => runEffectGenerator(gen, gen.next(value))])
}

export function of<A>(a: A, __trace?: string): Effect<never, never, A> {
  return new I.Of(a, __trace)
}

export function fromCause<E>(cause: Cause<E>, __trace?: string): Effect<never, E, never> {
  return new I.FromCause(cause, __trace)
}

export function fromExit<E, A>(exit: Exit<E, A>, __trace?: string): Effect<never, E, A> {
  return exit._tag === 'Right' ? of(exit.right, __trace) : fromCause(exit.left, __trace)
}

export function sync<A>(f: () => A, __trace?: string): Effect<never, never, A> {
  return new I.Sync(f, __trace)
}

export function access<R, R2, E2, A>(
  f: (r: Context<R>) => Effect<R2, E2, A>,
  __trace?: string,
): Effect<R | R2, E2, A> {
  return new I.AccessContext<R, R2, E2, A>(f, __trace)
}

export function provide<R>(
  context: Context<R>,
  __trace?: string,
): <E, A>(effect: Effect<R, E, A>) => Effect<never, E, A> {
  return (effect) => new I.ProvideContext([effect, context], __trace)
}

export function lazy<R, E, A>(f: () => Effect<R, E, A>, __trace?: string): Effect<R, E, A> {
  return new I.Lazy(f, __trace)
}

export function map<A, B>(f: (a: A) => B, __trace?: string) {
  return <R, E>(eff: Effect<R, E, A>): Effect<R, E, B> => new I.Map([eff, f], __trace)
}

export function flatMap<A, R2, E2, B>(f: (a: A) => Effect<R2, E2, B>, __trace?: string) {
  return <R, E>(eff: Effect<R, E, A>): Effect<R | R2, E | E2, B> => new I.FlatMap([eff, f], __trace)
}

export function matchCause<E, R2, E2, B, A, R3, E3, C>(
  onCause: (cause: Cause<E>) => Effect<R2, E2, B>,
  onValue: (value: A) => Effect<R3, E3, C>,
  __trace?: string,
) {
  return <R>(eff: Effect<R, E, A>): Effect<R | R2 | R3, E2 | E3, B | C> =>
    new I.Match<R, E, A, R2, E2, B, R3, E3, C>([eff, onCause, onValue], __trace)
}

export function attempt<R, E, A>(
  eff: Effect<R, E, A>,
  __trace?: string,
): Effect<R, never, Exit<E, A>> {
  return pipe(
    eff,
    matchCause(
      (cause) => of(left(cause)),
      (value) => of(right(value)),
      __trace,
    ),
  )
}

export function flatMapCause<E, R2, E2, B>(
  f: (cause: Cause<E>) => Effect<R2, E2, B>,
  __trace?: string,
) {
  return <R, A>(eff: Effect<R, E, A>): Effect<R | R2, E2, A | B> =>
    new I.FlatMapCause([eff, f], __trace)
}

export function mapCause<E, E2>(f: (cause: Cause<E>) => Cause<E2>, __trace?: string) {
  return <R, A>(eff: Effect<R, E, A>): Effect<R, E2, A> => new I.MapCause([eff, f], __trace)
}

export function wait<R, E, A>(future: Future<R, E, A>): Effect<R, E, A> {
  return new I.Async(future)
}

export function uninterruptable<R, E, A>(eff: Effect<R, E, A>): Effect<R, E, A> {
  return new I.SetInterruptStatus([eff, false])
}

export function interruptible<R, E, A>(eff: Effect<R, E, A>): Effect<R, E, A> {
  return new I.SetInterruptStatus([eff, true])
}

export const getFiberRefs: Effect<never, never, FiberRefs> = new I.GetFiberRefs()

export const getRuntimeFlags: Effect<never, never, FiberRuntimeFlags> = new I.GetRuntimeFlags()

export const getFiberRef = <R, E, A>(ref: FiberRef<R, E, A>): Effect<R, E, A> =>
  pipe(
    getFiberRefs,
    flatMap((refs) => refs.get(ref)),
  )

export const getFiberRefOption = <R, E, A>(
  ref: FiberRef<R, E, A>,
): Effect<never, never, Option<A>> =>
  pipe(
    getFiberRefs,
    map((refs) => refs.getOption(ref)),
  )

export const setFiberRef =
  <A>(value: A) =>
  <R, E>(ref: FiberRef<R, E, A>): Effect<R, E, A> =>
    pipe(
      getFiberRefs,
      flatMap((refs) => refs.set(ref, value)),
    )

export const modifyFiberRef =
  <A, B>(f: (a: A) => readonly [B, A]) =>
  <R, E>(ref: FiberRef<R, E, A>): Effect<R, E, B> =>
    pipe(
      getFiberRefs,
      flatMap((refs) => refs.modify(ref, f)),
    )

export const removeFiberRef = <R, E, A>(ref: FiberRef<R, E, A>): Effect<R, E, Option<A>> =>
  pipe(
    getFiberRefs,
    flatMap((refs) => refs.delete(ref)),
  )

export { removeFiberRef as deleteFiberRef }

export const withFiberRefs =
  (refs: FiberRefs, __trace?: string) =>
  <R, E, A>(effect: Effect<R, E, A>): Effect<R, E, A> =>
    new I.WithFiberRefs([effect, refs], __trace)
