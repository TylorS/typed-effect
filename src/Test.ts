import * as Context from '@fp-ts/data/Context'
import { Duration } from '@fp-ts/data/Duration'
import { pipe } from 'node_modules/@fp-ts/data/Function.js'

import { Clock } from './Clock.js'
import { DefaultServices, IdGenerator, makeIdGenerator } from './DefaultServices.js'
import { sync } from './Effect.js'
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
    currentTime: () => Time(currentTime),
    unixTime: () => UnixTime(startTime + currentTime),
    getTime: (duration) => Time(currentTime + duration.millis),
    getUnixTime: (duration) => UnixTime(startTime + currentTime + duration.millis),
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
    setTimer: (f, duration) => timeline.add(clock.getUnixTime(duration), f),
    progressTimeBy: (duration) => {
      clock.progressTimeBy(duration)
      const time = clock.currentTime()
      timeline.getReadyTasks(clock.unixTime()).forEach((f) => f(time))
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

export type TestServices = TestClock | TestTimer | TestScheduler

export const TestServices: Layer<never, never, TestServices | DefaultServices> = Layer(
  'TestServices',
  sync(() => {
    const clock = makeTestClock()
    const timer = makeTestTimer(clock)
    const scheduler = makeTestScheduler(timer)

    return pipe(
      Context.empty(),
      Context.add(TestClock)(clock),
      Context.add(TestTimer)(timer),
      Context.add(Scheduler)(scheduler),
      Context.add(TestScheduler)(scheduler),
      Context.add(IdGenerator)(makeIdGenerator()),
    )
  }),
)
