import { deepStrictEqual } from 'assert'

import { left } from '@fp-ts/data/Either'
import { pipe } from '@fp-ts/data/Function'

import { Expected } from './Cause.js'
import * as Effect from './Effect.js'
import { runMain, runMainExit } from './Runtime.js'
import { makeScheduler } from './Scheduler.js'

describe(import.meta.url, () => {
  const scheduler = makeScheduler()

  describe(Effect.of.name, () => {
    it('lifts a value into an Effect context', async () => {
      const value = Math.random()
      const result = await runMain(Effect.of(value))

      deepStrictEqual(result, value)
    })
  })

  describe(Effect.fromCause.name, () => {
    it('lifts a Cause into an Effect context', async () => {
      const value = Math.random()
      const cause = new Expected(scheduler.unixTime.get(), value)
      const exit = await runMainExit(Effect.fromCause(cause))

      deepStrictEqual(exit, left(cause))
    })
  })

  it('runs fib', async () => {
    const fib = (n: number): Effect.Effect<never, never, number> =>
      n < 2
        ? Effect.of(n)
        : pipe(
            fib(n - 2),
            Effect.flatMap((a) =>
              pipe(
                fib(n - 1),
                Effect.map((b) => a + b),
              ),
            ),
          )

    for (let i = 0; i < 20; ++i) {
      console.time('Fib25')
      const result = await runMain(fib(25))
      console.timeEnd('Fib25')
      deepStrictEqual(result, 75025)
    }
  })
})
