import * as Context from '@fp-ts/data/Context'
import { Duration } from '@fp-ts/data/Duration'
import { pipe } from '@fp-ts/data/Function'

import { Clock } from './Clock.js'
import { DefaultServices } from './DefaultServices.js'
import { sync } from './Effect.js'
import { GlobalFiberScope, makeGlobalFiberScope } from './FiberScope.js'
import { IdGenerator, makeIdGenerator } from './IdGenerator.js'
import { Layer } from './Layer.js'
import { Scheduler, makeScheduler } from './Scheduler.js'
import { Time, UnixTime } from './Time.js'
import { Timeline } from './Timeline.js'
import { Timer } from './Timer.js'
import { asks } from './operators.js'

export interface TestClock extends Clock {
  readonly progressTimeBy: (duration: Duration) => Time
  readonly fork: () => TestClock
}

export const TestClock = Context.Tag<TestClock>()

export function makeTestClock(startTime: UnixTime = UnixTime(Date.now())): TestClock {
  let currentTime = 0

  return {
    startTime,
    time: {
      get: () => Time(currentTime),
      delay: (duration) => Time(currentTime + duration.millis),
    },
    unixTime: {
      get: () => UnixTime(startTime + currentTime),
      delay: (duration) => UnixTime(startTime + currentTime + duration.millis),
    },
    progressTimeBy: (duration) => {
      currentTime += duration.millis

      return Time(currentTime)
    },
    fork: () => makeTestClock(UnixTime(startTime + currentTime)),
  }
}

export interface TestTimer extends TestClock, Timer {
  readonly fork: () => TestTimer
}

export const TestTimer = Context.Tag<TestTimer>()

export function makeTestTimer(
  clock: TestClock = makeTestClock(),
  timeline = Timeline<(time: Time) => void>(),
): TestTimer {
  return {
    ...clock,
    setTimer: (f, duration) => timeline.add(clock.unixTime.delay(duration), f),
    progressTimeBy: (duration) => {
      clock.progressTimeBy(duration)
      const time = clock.time.get()
      timeline.getReadyTasks(UnixTime(clock.startTime + time)).forEach((f) => f(time))
      return time
    },
    fork: () => makeTestTimer(clock.fork(), timeline),
  }
}

export interface TestScheduler extends TestClock, Scheduler {
  readonly fork: () => TestScheduler
}

export const TestScheduler = Context.Tag<TestScheduler>()

export function makeTestScheduler(timer: TestTimer = makeTestTimer()): TestScheduler {
  return new TestSchedulerImpl(makeScheduler(timer), timer)
}

class TestSchedulerImpl implements TestScheduler {
  readonly startTime = this.timer.startTime
  readonly time = this.timer.time
  readonly unixTime = this.timer.unixTime
  readonly progressTimeBy = this.timer.progressTimeBy
  readonly dispose = this.scheduler.dispose
  readonly delay = this.scheduler.delay
  readonly schedule = this.scheduler.schedule

  constructor(readonly scheduler: Scheduler, readonly timer: TestTimer) {}

  fork(): TestScheduler {
    return new TestSchedulerImpl(this.scheduler, this.timer.fork())
  }
}

export const progressTimeBy = (duration: Duration) =>
  asks(TestScheduler, (scheduler) => scheduler.progressTimeBy(duration))

export type TestServices = TestScheduler

export const TestServices: Layer<never, never, TestServices | DefaultServices> = Layer(
  sync(() => {
    const clock = makeTestClock()
    const timer = makeTestTimer(clock)
    const scheduler = makeTestScheduler(timer)

    return pipe(
      Context.empty(),
      Context.add(Scheduler)(scheduler),
      Context.add(TestScheduler)(scheduler),
      Context.add(IdGenerator)(makeIdGenerator()),
      Context.add(GlobalFiberScope)(makeGlobalFiberScope()),
    )
  }),
)
