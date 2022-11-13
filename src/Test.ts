import * as Context from '@fp-ts/data/Context'
import { Duration } from '@fp-ts/data/Duration'
import { pipe } from 'node_modules/@fp-ts/data/Function.js'

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

export interface TestClock extends Clock {
  readonly progressTimeBy: (duration: Duration) => Time
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
  }
}

export interface TestTimer extends TestClock, Timer {}

export const TestTimer = Context.Tag<TestTimer>()

export function makeTestTimer(clock: TestClock): TestTimer {
  const timeline = Timeline<(time: Time) => void>()

  return {
    ...clock,
    setTimer: (f, duration) => timeline.add(clock.unixTime.delay(duration), f),
    progressTimeBy: (duration) => {
      clock.progressTimeBy(duration)
      const time = clock.time.get()
      timeline.getReadyTasks(UnixTime(clock.startTime + time)).forEach((f) => f(time))
      return time
    },
  }
}

export interface TestScheduler extends TestClock, Scheduler {}

export const TestScheduler = Context.Tag<TestScheduler>()

export function makeTestScheduler(timer: TestTimer): TestScheduler {
  return {
    ...makeScheduler(timer),
    progressTimeBy: timer.progressTimeBy,
  }
}

export type TestServices = TestScheduler

export const TestServices: Layer<never, never, TestServices | DefaultServices> = Layer(
  'TestServices',
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
