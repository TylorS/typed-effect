import { Disposable } from './Disposable.js'
import { Effect } from './Effect.js'
import { Exit } from './Exit.js'
import { FiberId } from './FiberId.js'

// TODO: Trace
// TODO: Interrupts

export interface Fiber<Errors, Output> {
  readonly id: FiberId
  readonly exit: Effect<never, never, Exit<Errors, Output>>
  readonly addObserver: (observer: (exit: Exit<Errors, Output>) => void) => Disposable
}
