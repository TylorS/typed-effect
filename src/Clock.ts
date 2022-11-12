import { Duration } from '@fp-ts/data/Duration'

import { Time, UnixTime } from './Time.js'

export interface Clock {
  readonly startTime: UnixTime
  readonly currentTime: () => Time
  readonly unixTime: () => UnixTime
  readonly getTime: (duration: Duration) => Time
  readonly getUnixTime: (duration: Duration) => UnixTime
}

export function makeDateClock(): Clock {
  const startTime = Date.now()

  return {
    startTime: UnixTime(startTime),
    currentTime: () => Time(Date.now() - startTime),
    unixTime: () => UnixTime(Date.now()),
    getTime: (duration) => Time(duration.millis),
    getUnixTime: (duration) => UnixTime(Date.now() + duration.millis),
  }
}
