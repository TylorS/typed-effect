import { Time } from './Time.js'

// TODO: Synthetic IDs

export type FiberId = FiberId.Live | FiberId.None

export namespace FiberId {
  export interface Live {
    readonly tag: 'Live'
    readonly id: number
    readonly startTime: Time
  }

  export interface None {
    readonly tag: 'None'
  }
}

export function Live(id: number, startTime: Time): FiberId.Live {
  return {
    tag: 'Live',
    id,
    startTime,
  }
}

export const None: FiberId.None = { tag: 'None' }
