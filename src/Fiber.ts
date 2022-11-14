import { Disposable } from './Disposable.js'
import { Effect } from './Effect.js'
import { Exit } from './Exit.js'
import { FiberId } from './FiberId.js'

// TODO: Trace
// TODO: Runtime vs Synthetic Fibers

export interface Fiber<Errors, Output> {
  readonly id: FiberId
  readonly exit: Effect<never, never, Exit<Errors, Output>>
  readonly inheritRefs: Effect<never, never, void>
  readonly addObserver: (observer: (exit: Exit<Errors, Output>) => void) => Disposable
  readonly interruptAs: (id: FiberId) => Effect<never, never, Exit<Errors, Output>>
}
