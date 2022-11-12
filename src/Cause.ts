import type { FiberId } from './FiberId.js'

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
    super()
  }
}

export class Empty {
  readonly _tag = 'Empty'
}

export class Expected<E> {
  readonly _tag = 'Expected'
  constructor(readonly error: E) {}
}

export class Unexpected {
  readonly _tag = 'Unexpected'
  constructor(readonly error: unknown) {}
}

export class Interrupted {
  readonly _tag = 'Interrupted'
  constructor(readonly fiberId: FiberId) {}
}

export class Sequential<E> {
  readonly _tag = 'Then'
  constructor(readonly left: Cause<E>, readonly right: Cause<E>) {}
}

export class Concurrent<E> {
  readonly _tag = 'Both'
  constructor(readonly left: Cause<E>, readonly right: Cause<E>) {}
}

export class Traced<E> {
  readonly _tag = 'Traced'
  // TODO: Improve trace type
  constructor(readonly cause: Cause<E>, readonly trace: string) {}
}
