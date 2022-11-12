import { Context } from '@fp-ts/data/Context'

import type { Cause } from './Cause.js'
import type { Effect } from './Effect.js'
import type { FiberRefs } from './FiberRefs.js'
import type { FiberRuntimeFlags } from './FiberRuntimeFlags.js'
import type { Future } from './Future.js'

// TODO: Fusion of frames
// TODO: Fork
// TODO: Set runtime flags
// TODO: FiberScope + Cancelation
// TODO: Scope
// TODO: Semaphores

export type Instruction<R, E, A> =
  | AccessContext<R, R, E, A>
  | Async<R, E, A>
  | FlatMap<R, E, any, R, E, A>
  | FlatMapCause<R, any, A, R, E, A>
  | FromCause<E>
  | GetRuntimeFlags
  | Lazy<R, E, A>
  | Map<R, E, any, A>
  | MapCause<R, any, A, E>
  | Match<R, any, any, R, E, A, R, E, A>
  | Of<A>
  | ProvideContext<any, E, A>
  | SetInterruptStatus<R, E, A>
  | WithFiberRefs<R, E, A>

abstract class Instr<I, R, E, A> implements Effect<R, E, A> {
  readonly _R!: (_: never) => R
  readonly _E!: (_: never) => E
  readonly _A!: (_: never) => A

  constructor(readonly input: I, readonly __trace?: string) {}

  *[Symbol.iterator](): Generator<Effect<R, E, any>, A, any> {
    return yield this
  }
}

export class AccessContext<R, R2, E, A> extends Instr<
  (r: Context<R>) => Effect<R2, E, A>,
  R | R2,
  E,
  A
> {
  readonly tag = 'AccessContext'
}

export class ProvideContext<R, E, A> extends Instr<
  readonly [Effect<R, E, A>, Context<R>],
  never,
  E,
  A
> {
  readonly tag = 'ProvideContext'
}

export class FromCause<E> extends Instr<Cause<E>, never, E, never> {
  readonly tag = 'FromCause'
}

export class Of<A> extends Instr<A, never, never, A> {
  readonly tag = 'Of'
}

export class Sync<A> extends Instr<() => A, never, never, A> {
  readonly tag = 'Sync'
}

export class Lazy<R, E, A> extends Instr<() => Effect<R, E, A>, R, E, A> {
  readonly tag = 'Lazy'
}

export class Map<R, E, A, B> extends Instr<readonly [Effect<R, E, A>, (a: A) => B], R, E, B> {
  readonly tag = 'Map'
}

export class FlatMap<R, E, A, R2, E2, B> extends Instr<
  readonly [Effect<R, E, A>, (a: A) => Effect<R2, E2, B>],
  R | R2,
  E | E2,
  B
> {
  readonly tag = 'FlatMap'
}

export class MapCause<R, E, A, E2> extends Instr<
  readonly [Effect<R, E, A>, (a: Cause<E>) => Cause<E2>],
  R,
  E2,
  A
> {
  readonly tag = 'MapCause'
}

export class FlatMapCause<R, E, A, R2, E2, B> extends Instr<
  readonly [Effect<R, E, A>, (a: Cause<E>) => Effect<R2, E2, B>],
  R | R2,
  E2,
  B
> {
  readonly tag = 'FlatMapCause'
}

export class Match<R, E, A, R2, E2, B, R3, E3, C> extends Instr<
  readonly [Effect<R, E, A>, (e: Cause<E>) => Effect<R2, E2, B>, (a: A) => Effect<R3, E3, C>],
  R | R2 | R3,
  E2 | E3,
  B | C
> {
  readonly tag = 'Match'
}

export class Async<R, E, A> extends Instr<Future<R, E, A>, R, E, A> {
  readonly tag = 'Async'
}

export class SetInterruptStatus<R, E, A> extends Instr<
  readonly [Effect<R, E, A>, boolean],
  R,
  E,
  A
> {
  readonly tag = 'SetInterruptStatus'
}

export class GetRuntimeFlags extends Instr<void, never, never, FiberRuntimeFlags> {
  readonly tag = 'GetRuntimeFlags'
}

export class GetFiberRefs extends Instr<void, never, never, FiberRefs> {
  readonly tag = 'GetFiberRefs'
}

export class WithFiberRefs<R, E, A> extends Instr<readonly [Effect<R, E, A>, FiberRefs], R, E, A> {
  readonly tag = 'WithFiberRefs'
}
