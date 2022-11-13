import * as Context from '@fp-ts/data/Context'
import { pipe } from '@fp-ts/data/Function'
import * as Option from '@fp-ts/data/Option'

import { makeDateClock } from './Clock.js'
import { of } from './Effect.js'
import type { FiberRefs } from './FiberRefs.js'
import { GlobalFiberScope, makeGlobalFiberScope } from './FiberScope.js'
import { IdGenerator, makeIdGenerator } from './IdGenerator.js'
import { Layer } from './Layer.js'
import { Scheduler, makeScheduler } from './Scheduler.js'
import { makeSetTimeoutTimer } from './Timer.js'

export type DefaultServices = Scheduler | IdGenerator | GlobalFiberScope

const empty = Context.empty()

export const DefaultClock = makeDateClock()
export const DefaultTimer = makeSetTimeoutTimer(DefaultClock)
export const DefaultScheduler = makeScheduler(DefaultTimer)
export const DefaultIdGenerator = makeIdGenerator()
export const DefaultGlobalScope = makeGlobalFiberScope()

export const DefaultServicesContext: Context.Context<DefaultServices> = pipe(
  empty,
  Context.add(Scheduler)(DefaultScheduler),
  Context.add(IdGenerator)(DefaultIdGenerator),
  Context.add(GlobalFiberScope)(DefaultGlobalScope),
)

export const DefaultServices: Layer<never, never, DefaultServices> = Layer(
  'DefaultServices',
  of(DefaultServicesContext),
)

export const getDefaultService = <R, S extends DefaultServices>(
  context: Context.Context<R>,
  fiberRefs: FiberRefs,
  service: Context.Tag<S>,
): S => {
  const contextOption = pipe(context, Context.getOption<S>(service))

  if (Option.isSome(contextOption)) {
    return contextOption.value
  }

  return pipe(
    fiberRefs.getOption(DefaultServices),
    Option.getOrElse(DefaultServicesContext),
    Context.get(service as Context.Tags<S>),
  ) as S
}
