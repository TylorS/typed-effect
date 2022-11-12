import { FiberId } from './FiberId.js'
import { RootScheduler, Scheduler } from './Scheduler.js'

export interface FiberContext {
  readonly id: FiberId
  readonly scheduler: Scheduler
}

export function FiberContext(scheduler: Scheduler = RootScheduler()): FiberContext {
  return {
    id: FiberId(scheduler.unixTime()),
    scheduler,
  }
}
