import { Tag } from '@fp-ts/data/Context'
import * as Duration from '@fp-ts/data/Duration'

import { Clock, makeDateClock } from './Clock.js'
import { Disposable } from './Disposable.js'
import { Time } from './Time.js'

export interface Timer extends Clock {
  readonly setTimer: (f: (time: Time) => void, duration: Duration.Duration) => Disposable
}

export const Timer = Tag<Timer>()

export function make(clock: Clock, setTimer: Timer['setTimer']): Timer {
  return {
    ...clock,
    setTimer,
  }
}

const shouldUseMicroTask = Duration.lessThanOrEqualTo(Duration.zero)

export function makeSetTimeoutTimer(clock: Clock = makeDateClock()): Timer {
  return make(clock, (f, duration) => {
    if (shouldUseMicroTask(duration)) {
      queueMicrotask(() => f(clock.currentTime()))

      return Disposable.unit
    }

    const id = setTimeout(() => f(clock.currentTime()), duration.millis)

    return Disposable(() => clearTimeout(id))
  })
}
