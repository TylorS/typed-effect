import * as Semigroup from '@fp-ts/core/typeclass/Semigroup'

import type { FiberId } from './FiberId.js'
import { UnixTime } from './Time.js'

export type Cause<E> =
  | Empty
  | Expected<E>
  | Unexpected
  | Interrupted
  | Sequential<E>
  | Concurrent<E>
  | Traced<E>

export class CauseError<E> extends Error {
  constructor(readonly cause: Cause<E>) {
    super() // TODO: Pretty printing
  }
}

export class Empty {
  readonly tag = 'Empty'
}

export class Expected<E> {
  readonly tag = 'Expected'
  constructor(readonly time: UnixTime, readonly error: E) {}
}

export class Unexpected {
  readonly tag = 'Unexpected'
  constructor(readonly time: UnixTime, readonly error: unknown) {}
}

export class Interrupted {
  readonly tag = 'Interrupted'
  constructor(readonly time: UnixTime, readonly fiberId: FiberId) {}
}

export class Sequential<E> {
  readonly tag = 'Sequential'
  constructor(readonly left: Cause<E>, readonly right: Cause<E>) {}
}

export class Concurrent<E> {
  readonly tag = 'Concurrent'
  constructor(readonly left: Cause<E>, readonly right: Cause<E>) {}
}

export class Traced<E> {
  readonly tag = 'Traced'
  // TODO: Improve trace type
  constructor(readonly cause: Cause<E>, readonly trace: string) {}
}

export const combine =
  <E2 = never>(y: Cause<E2>) =>
  <E = never>(x: Cause<E>): Cause<E | E2> =>
    x.tag === 'Empty' ? y : y.tag === 'Empty' ? x : new Sequential<E | E2>(x, y)

export function makeSequentialSemigroup<E>(): Semigroup.Semigroup<Cause<E>> {
  return Semigroup.fromCombine(combine)
}
