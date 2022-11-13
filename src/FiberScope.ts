import { Tag } from 'node_modules/@fp-ts/data/Context.js'

import { Effect } from './Effect.js'
import { FiberId, None } from './FiberId.js'
import type { FiberRuntime } from './FiberRuntime.js'

export interface FiberScope {
  readonly id: FiberId
  readonly size: number
  readonly addChild: <R1, E1, A1>(child: FiberRuntime<R1, E1, A1>) => void
  readonly interruptChildren: Effect<never, never, void>
}

export function FiberScope(id: FiberId): FiberScope {
  const children = new Set<FiberRuntime<any, any, any>>()

  const scope: FiberScope = {
    id,
    get size() {
      return children.size
    },
    addChild: (child) => {
      children.add(child)

      child.addObserver(() => {
        children.delete(child)
      })
    },
    interruptChildren: Effect(function* () {
      // TODO: Concurrency
      for (const child of children) {
        yield* child.interruptAs(id)
      }
    }),
  }

  return scope
}

export type GlobalFiberScope = FiberScope & GLOBAL_FIBER_SCOPE

export const GlobalFiberScope = Tag<GlobalFiberScope>()

export function makeGlobalFiberScope(): GlobalFiberScope {
  return FiberScope(None) as GlobalFiberScope
}

export interface GLOBAL_FIBER_SCOPE {
  readonly GLOBAL_FIBER_SCOPE: unique symbol
}
