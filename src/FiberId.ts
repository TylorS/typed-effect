import { Time } from './Time.js'

export interface FiberId {
  readonly id: number
  readonly startTime: Time
}

export function FiberId(id: number, startTime: Time): FiberId {
  return {
    id: id++,
    startTime,
  }
}
