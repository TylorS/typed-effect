import { Context } from '@fp-ts/data/Context'
import { identity } from '@fp-ts/data/Function'

import { Effect } from './Effect.js'
import { FiberRef } from './FiberRef.js'

export interface Layer<R, E, A> extends FiberRef<R, E, Context<A>> {}

export function Layer<R, E, A>(name: string, effect: Effect<R, E, Context<A>>) {
  return FiberRef(name, effect, {
    join: identity,
  })
}
