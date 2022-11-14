import { Tag } from '@fp-ts/data/Context'
import * as Either from '@fp-ts/data/Either'
import { pipe } from '@fp-ts/data/Function'
import * as Option from '@fp-ts/data/Option'

import { combine } from './Cause.js'
import { Disposable } from './Disposable.js'
import * as Effect from './Effect.js'
import { Exit } from './Exit.js'

export interface Scope {
  readonly addFinalizer: (finalizer: Finalizer) => Effect.Effect<never, never, Disposable>
  readonly close: (exit: Exit<any, any>) => Effect.Effect<never, never, boolean>
}

export const Scope = Tag<Scope>()

export function makeScope(): Scope {
  const finalizers: Array<Finalizer> = []
  let closed = false
  let finalExit: Option.Option<Exit<any, any>> = Option.none

  const addFinalizer: Scope['addFinalizer'] = (finalizer) =>
    Effect.lazy(() =>
      closed && Option.isSome(finalExit)
        ? pipe(
            finalizer(finalExit.value),
            Effect.map(() => Disposable.unit),
          )
        : Effect.sync(() => {
            finalizers.push(finalizer)

            return Disposable(() => {
              const i = finalizers.indexOf(finalizer)

              if (i > -1) {
                finalizers.splice(i, 1)
              }
            })
          }),
    )

  const close: Scope['close'] = (exit) =>
    Effect.Effect(function* () {
      if (Option.isSome(finalExit)) {
        return false
      }

      finalExit = Option.some(exit)

      for (const finalizer of finalizers) {
        const finalizerExit = yield* Effect.attempt(finalizer(exit))

        if (Either.isLeft(finalizerExit)) {
          finalExit = pipe(finalExit, Option.map(Either.mapLeft(combine(finalizerExit.left))))
        }
      }

      closed = true

      return true
    })

  return {
    addFinalizer,
    close,
  }
}

export interface Finalizer {
  (exit: Exit<any, any>): Effect.Effect<never, never, void>
}