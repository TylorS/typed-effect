import * as Either from '@fp-ts/data/Either'
import { pipe } from '@fp-ts/data/Function'

import { Cause, Expected } from './Cause.js'

export type Exit<E, A> = Either.Either<Cause<E>, A>

export const fromCause = <E>(cause: Cause<E>): Exit<E, never> => Either.left(cause)

export const of = <A>(value: A): Exit<never, A> => Either.right(value)

export const fromEither = <E, A>(either: Either.Either<E, A>): Exit<E, A> =>
  pipe(
    either,
    Either.match((e) => fromCause(new Expected(e)), of),
  )
