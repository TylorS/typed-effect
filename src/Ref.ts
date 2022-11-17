import { flow, pipe } from '@fp-ts/data/Function'
import * as Option from '@fp-ts/data/Option'

import * as Effect from './Effect.js'
import * as FiberRef from './FiberRef.js'

export interface Ref<R, E, I, O = I> {
  readonly get: Effect.Effect<R, E, O>
  readonly set: (i: I) => Effect.Effect<R, E, O>
  readonly update: (f: (i: I) => I) => Effect.Effect<R, E, O>
  readonly modify: <A>(f: (i: I) => readonly [A, I]) => Effect.Effect<R, E, A>
  readonly delete: Effect.Effect<R, E, Option.Option<O>>
}

export function fromFiberRef<R, E, A>(fiberRef: FiberRef.FiberRef<R, E, A>): Ref<R, E, A> {
  return {
    get: Effect.getFiberRef(fiberRef),
    set: (a) => Effect.setFiberRef(a)(fiberRef),
    update: (f) => Effect.updateFiberRef(f)(fiberRef),
    modify: (f) => Effect.modifyFiberRef(f)(fiberRef),
    delete: Effect.deleteFiberRef(fiberRef),
  }
}

export function map<A, B>(f: (a: A) => B) {
  return <R, E, I>(ref: Ref<R, E, I, A>): Ref<R, E, I, B> => ({
    get: pipe(ref.get, Effect.map(f)),
    set: flow(ref.set, Effect.map(f)),
    update: flow(ref.update, Effect.map(f)),
    modify: ref.modify,
    delete: pipe(ref.delete, Effect.map(Option.map(f))),
  })
}

export function mapEffect<A, R2, E2, B>(f: (a: A) => Effect.Effect<R2, E2, B>) {
  return <R, E, I>(ref: Ref<R, E, I, A>): Ref<R | R2, E | E2, I, B> => ({
    get: pipe(ref.get, Effect.flatMap(f)),
    set: flow(ref.set, Effect.flatMap(f)),
    update: flow(ref.update, Effect.flatMap(f)),
    modify: ref.modify,
    delete: pipe(
      ref.delete,
      Effect.flatMap(Option.match(() => Effect.of(Option.none), flow(f, Effect.map(Option.some)))),
    ),
  })
}
