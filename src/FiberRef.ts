import { SK } from '@fp-ts/data/Function'
import { Option, some } from '@fp-ts/data/Option'

import { Effect, getFiberRef } from './Effect.js'

// TODO: Composition types - Invariant Map, Match, Fresh, Lazy?, Tuple, Struct

export interface FiberRef<R, E, A> {
  readonly id: FiberRefId
  readonly initial: Effect<R, E, A>
  readonly fork: (current: A) => Option<A>
  readonly join: (current: A, incoming: A) => A

  readonly [Symbol.iterator]: () => Generator<Effect<R, E, A>, A, A>

  readonly withId: (id: FiberRefId) => FiberRef<R, E, A>
}

export type FiberRefId = symbol & FIBER_REF_ID

export interface FIBER_REF_ID {
  readonly FIBER_REF_ID: unique symbol
}

export function FiberRefId(name: string): FiberRefId {
  return Symbol(name) as FiberRefId
}

export type FiberRefOptions<A> = {
  readonly fork?: (current: A) => Option<A>
  readonly join?: (current: A, incoming: A) => A
}

export function FiberRef<R, E, A>(
  name: string,
  initial: Effect<R, E, A>,
  options: FiberRefOptions<A> = {},
): FiberRef<R, E, A> {
  const ref: FiberRef<R, E, A> = {
    id: FiberRefId(name),
    initial,
    fork: options.fork ?? some,
    join: options.join ?? SK,
    *[Symbol.iterator]() {
      return yield* getFiberRef(ref)
    },
    withId(id) {
      return {
        ...ref,
        id,
      }
    },
  }

  return ref
}
