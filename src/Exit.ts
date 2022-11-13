import * as Either from '@fp-ts/data/Either'

import { Cause } from './Cause.js'

export type Exit<E, A> = Either.Either<Cause<E>, A>

export const fromCause = <E>(cause: Cause<E>): Exit<E, never> => Either.left(cause)

export const of = <A>(value: A): Exit<never, A> => Either.right(value)
