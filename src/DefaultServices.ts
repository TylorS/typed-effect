import * as Context from '@fp-ts/data/Context'
import { pipe } from '@fp-ts/data/Function'

import { Clock, makeDateClock } from './Clock.js'
import { of } from './Effect.js'
import { Layer } from './Layer.js'
import { Scheduler, makeScheduler } from './Scheduler.js'
import { Timer, makeSetTimeoutTimer } from './Timer.js'

export type DefaultServices = Clock | Timer | Scheduler | IdGenerator

const empty = Context.empty()

export const DefaultClock = makeDateClock()
export const DefaultTimer = makeSetTimeoutTimer(DefaultClock)
export const DefaultScheduler = makeScheduler(DefaultTimer)

export const makeIdGenerator = (): IdGenerator => {
  let id = 0

  return () => id++
}

export interface IdGenerator {
  (): number
}

export const IdGenerator = Context.Tag<IdGenerator>()

export const DefaultEnv: Context.Context<DefaultServices> = pipe(
  empty,
  Context.add(Clock)(DefaultClock),
  Context.add(Timer)(DefaultTimer),
  Context.add(Scheduler)(DefaultScheduler),
  Context.add(IdGenerator)(makeIdGenerator()),
)

export const DefaultServices: Layer<never, never, DefaultServices> = Layer(
  'DefaultServices',
  of(DefaultEnv),
)
