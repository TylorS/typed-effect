import * as C from '@fp-ts/data/Context'
import { isRight } from '@fp-ts/data/Either'
import { pipe } from '@fp-ts/data/Function'
import * as Option from '@fp-ts/data/Option'

import * as Effect from './Effect.js'
import { FiberRef, FiberRefId } from './FiberRef.js'
import { Future, pending } from './Future.js'

// TODO: Effect variants + Semaphore

export interface FiberRefs {
  readonly getReferences: () => ReadonlyMap<FiberRef<any, any, any>, any>
  readonly getOption: <R, E, A>(fiberRef: FiberRef<R, E, A>) => Option.Option<A>
  readonly get: <R, E, A>(fiberRef: FiberRef<R, E, A>) => Effect.Effect<R, E, A>
  readonly set: <R, E, A>(fiberRef: FiberRef<R, E, A>, a: A) => Effect.Effect<never, never, A>
  readonly modify: <R, E, A, B>(
    fiberRef: FiberRef<R, E, A>,
    f: (a: A) => readonly [B, A],
  ) => Effect.Effect<R, E, B>
  readonly delete: <R, E, A>(fiberRef: FiberRef<R, E, A>) => Effect.Effect<R, E, Option.Option<A>>
  readonly inherit: Effect.Effect<never, never, void>
}

export const FiberRefs = C.Tag<FiberRefs>()

export function makeFiberRefs(
  references: Map<FiberRef<any, any, any>, any> = new Map(),
): FiberRefs {
  const valuesById = new Map<FiberRefId<any>, any>(
    Array.from(references).map(([fiberRef, value]) => [fiberRef.id, value]),
  )
  const refsById = new Map<FiberRefId<any>, FiberRef<any, any, any>>(
    Array.from(references).map(([fiberRef]) => [fiberRef.id, fiberRef]),
  )
  const initializing = new Map<FiberRefId<any>, Future<any, any, any>>()

  const getReferences = () => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return new Map(Array.from(valuesById).map(([id, value]) => [refsById.get(id)!, value]))
  }

  const getOption: FiberRefs['getOption'] = (fiberRef) => {
    if (valuesById.has(fiberRef.id)) {
      refsById.set(fiberRef.id, fiberRef)

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return Option.some(valuesById.get(fiberRef.id)!)
    }

    return Option.none
  }

  const initialize: FiberRefs['get'] = (fiberRef) =>
    Effect.Effect(function* () {
      refsById.set(fiberRef.id, fiberRef)

      if (initializing.has(fiberRef.id)) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return yield* Effect.wait(initializing.get(fiberRef.id)!)
      }

      const future = pending<any, any, any>()
      initializing.set(fiberRef.id, future)
      const exit = yield* Effect.attempt(fiberRef.initial)

      if (isRight(exit)) {
        valuesById.set(fiberRef.id, exit.right)
      }

      const eff = Effect.fromExit(exit)

      future.complete(eff)
      initializing.delete(fiberRef.id)

      return yield* eff
    })

  const get: FiberRefs['get'] = (fiberRef) =>
    pipe(
      getOption(fiberRef),
      Option.match(() => initialize(fiberRef), Effect.of),
    )

  const set: FiberRefs['set'] = (fiberRef, a) =>
    Effect.sync(() => {
      valuesById.set(fiberRef.id, a)
      refsById.set(fiberRef.id, fiberRef)

      return a
    })

  const modify: FiberRefs['modify'] = (fiberRef, f) =>
    pipe(
      get(fiberRef),
      Effect.flatMap((a) =>
        Effect.sync(() => {
          const [b, a_] = f(a)

          valuesById.set(fiberRef.id, a_)
          refsById.set(fiberRef.id, fiberRef)

          return b
        }),
      ),
    )

  const delete_: FiberRefs['delete'] = (fiberRef) =>
    Effect.sync(() => {
      const option = getOption(fiberRef)

      valuesById.delete(fiberRef.id)
      refsById.delete(fiberRef.id)

      return option
    })

  const inherit: FiberRefs['inherit'] = pipe(
    Effect.getFiberRefs,
    Effect.flatMap((fiberRefs) =>
      Effect.Effect(function* () {
        for (const [fiberRef, value] of getReferences()) {
          const current = fiberRefs.getOption(fiberRef)

          yield* pipe(
            current,
            Option.match(
              () => fiberRefs.set(fiberRef, value),
              (current) => fiberRefs.set(fiberRef, fiberRef.join(current, value)),
            ),
          )
        }
      }),
    ),
  )

  const refs: FiberRefs = {
    getReferences,
    getOption,
    get,
    set,
    modify,
    delete: delete_,
    inherit,
  }

  return refs
}
