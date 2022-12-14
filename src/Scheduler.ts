import { Tag } from '@fp-ts/data/Context'
import * as Duration from '@fp-ts/data/Duration'
import * as O from '@fp-ts/data/Option'

import { Clock } from './Clock.js'
import { Disposable } from './Disposable.js'
import { Effect } from './Effect.js'
import { pending } from './Future.js'
import { Async, Lazy } from './Instruction.js'
import { Time, UnixTime } from './Time.js'
import * as Timeline from './Timeline.js'
import { Timer, makeSetTimeoutTimer } from './Timer.js'

export interface Scheduler extends Clock, Disposable {
  readonly delay: <R, E, A>(effect: Effect<R, E, A>, duration: Duration.Duration) => Effect<R, E, A>

  readonly schedule: <R, E, A, R2, E2>(
    effect: Effect<R, E, A>,
    schedule: Schedule,
  ) => Effect<R | R2, E | E2, ScheduleState>

  readonly fork: () => Scheduler
}

export const Scheduler = Tag<Scheduler>()

export interface Schedule {
  readonly step: (
    state: ScheduleState,
    input: ScheduleInput,
  ) => readonly [ScheduleState, ScheduleDecision]
}

export interface ScheduleInput {
  readonly currentTime: Time
  readonly currentDelay: O.Option<Duration.Duration>
}

export interface ScheduleState {
  readonly startTime: Time
  readonly iterations: number
  readonly previousTime: O.Option<Time>
  readonly previousDelay: O.Option<Duration.Duration>
  readonly currentDelay: Duration.Duration
}

export namespace ScheduleState {
  export const initial = (startTime: Time): ScheduleState => ({
    startTime,
    iterations: 0,
    previousTime: O.none,
    previousDelay: O.none,
    currentDelay: Duration.zero,
  })
}

export type ScheduleDecision = ScheduleContinue | ScheduleDone

export interface ScheduleContinue {
  readonly tag: 'Continue'
  readonly delay: O.Option<Duration.Duration>
}

export interface ScheduleDone {
  readonly tag: 'Done'
}

export function makeScheduler(timer: Timer = makeSetTimeoutTimer()): Scheduler {
  const [disposable, add] = callbackScheduler(timer)

  const delay: Scheduler['delay'] = (effect, duration) =>
    new Lazy(() => {
      const task = new Task(effect)

      add(timer.unixTime.delay(duration), task.start)

      return task.wait
    })

  const schedule: Scheduler['schedule'] = (effect, schedule) =>
    Effect(function* () {
      const startTime = timer.time.get()
      let [state, decision] = schedule.step(ScheduleState.initial(startTime), {
        currentTime: startTime,
        currentDelay: O.none,
      })

      while (decision.tag === 'Continue') {
        const currentDelay = decision.delay

        if (O.isSome(currentDelay)) {
          const task = new Task(effect)

          add(timer.unixTime.delay(currentDelay.value), task.start)

          yield* task.wait
        } else {
          yield* effect
        }

        ;[state, decision] = schedule.step(state, {
          currentTime: timer.time.get(),
          currentDelay,
        })
      }

      return state
    })

  const scheduler: Scheduler = {
    startTime: timer.startTime,
    time: timer.time,
    unixTime: timer.unixTime,
    dispose: disposable.dispose,
    delay,
    schedule,
    fork: (): Scheduler => new ForkScheduler(scheduler, timer.fork()),
  }

  return scheduler
}

class ForkScheduler implements Scheduler {
  readonly startTime = this.timer.startTime
  readonly time = this.timer.time
  readonly unixTime = this.timer.unixTime
  readonly dispose = this.scheduler.dispose
  readonly delay = this.scheduler.delay
  readonly schedule = this.scheduler.schedule

  constructor(readonly scheduler: Scheduler, readonly timer: Timer) {}

  fork(): Scheduler {
    return new ForkScheduler(this.scheduler, this.timer.fork())
  }
}

class Task<R, E, A> {
  protected future = pending<R, E, A>()
  constructor(readonly effect: Effect<R, E, A>) {}
  readonly wait: Effect<R, E, A> = new Async(this.future)
  readonly start = () => this.future.complete(this.effect)
}

function callbackScheduler(
  timer: Timer,
): readonly [Disposable, (time: UnixTime, f: () => void) => Disposable] {
  const timeline = Timeline.Timeline<() => void>(scheduleNextRun)
  let disposable: Disposable = Disposable.unit
  let nextArrival: UnixTime | null = null

  function scheduleNextRun() {
    // If the timeline is empty, lets cleanup our resources
    if (timeline.isEmpty()) {
      disposable.dispose()
      nextArrival = null

      return
    }

    // Get the time of the next arrival currently in the Timeline
    const next = timeline.nextArrival()
    const needToScheduleEarlierTime = !nextArrival || nextArrival > next

    // If we need to create or schedule an earlier time, cleanup the old timer
    // and schedule the new one.
    if (needToScheduleEarlierTime) {
      disposable.dispose()
      disposable = timer.setTimer(runReadyTasks, Duration.millis(next - timer.time.get()))
      nextArrival = next
    }
  }

  function runReadyTasks() {
    timeline.getReadyTasks(timer.unixTime.get()).forEach((f) => f())

    scheduleNextRun()
  }

  return [Disposable(() => disposable.dispose()), timeline.add] as const
}
