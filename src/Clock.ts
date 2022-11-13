import * as C from '@fp-ts/data/Context'
import { Duration } from '@fp-ts/data/Duration'

import { Time, UnixTime } from './Time.js'

export interface Clock {
  readonly startTime: UnixTime
  readonly time: {
    readonly get: () => Time
    readonly delay: (duration: Duration) => Time
  }
  readonly unixTime: {
    readonly get: () => UnixTime
    readonly delay: (duration: Duration) => UnixTime
  }
}

export const Clock = C.Tag<Clock>()

export function makeDateClock(): Clock {
  const startTime = Date.now()

  return {
    startTime: UnixTime(startTime),
    time: {
      get: () => Time(Date.now() - startTime),
      delay: (duration) => Time(Date.now() - startTime + duration.millis),
    },
    unixTime: {
      get: () => UnixTime(Date.now()),
      delay: (duration) => UnixTime(Date.now() + duration.millis),
    },
  }
}
