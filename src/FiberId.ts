import { UnixTime } from './Time.js'

export interface FiberId {
  readonly id: number
  readonly startTime: UnixTime
}

// TODO: Where should this come from?
let id = 0

export function FiberId(startTime: UnixTime): FiberId {
  return {
    id: id++,
    startTime,
  }
}
