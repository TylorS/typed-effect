import { Context } from '@fp-ts/data/Context'
import * as Either from '@fp-ts/data/Either'
import { pipe } from '@fp-ts/data/Function'
import * as RA from '@fp-ts/data/ReadonlyArray'

import * as Cause from './Cause.js'
import { Disposable } from './Disposable.js'
import { Effect } from './Effect.js'
import { Exit } from './Exit.js'
import type { Fiber } from './Fiber.js'
import type { FiberId } from './FiberId.js'
import type { FiberRefs } from './FiberRefs.js'
import type { FiberRuntimeFlags } from './FiberRuntimeFlags.js'
import * as FiberStatus from './FiberStatus.js'
import {
  FlatMapCauseFrame,
  FlatMapFrame,
  Frame,
  InterruptFrame,
  MapCauseFrame,
  MapFrame,
  MatchFrame,
  PopFrame,
  TraceFrame,
} from './Frame.js'
import { pending } from './Future.js'
import * as I from './Instruction.js'
import { MutableStack } from './_internal.js'

export interface FiberRuntimeOptions<R> {
  readonly context: Context<R>
  readonly fiberRefs: FiberRefs
  readonly flags: FiberRuntimeFlags
}

export class FiberRuntime<Services, Errors, Output> implements Fiber<Errors, Output> {
  protected started = false
  protected instr!: I.Instruction<any, any, any> | null
  protected frames: Frame[] = []
  protected disposable: Disposable.Settable = Disposable.settable()
  protected observers: ((exit: Exit<Errors, Output>) => void)[] = []
  protected interruptedBy: FiberId[] = []
  protected interruptStatus = this.options.flags.interruptStatus
  protected currentContext = new MutableStack(this.options.context)
  protected currentFiberRefs = new MutableStack(this.options.fiberRefs)
  protected fiberStatus: FiberStatus.FiberStatus<Errors, Output> = FiberStatus.Pending

  constructor(
    readonly effect: Effect<Services, Errors, Output>,
    readonly id: FiberId,
    readonly options: FiberRuntimeOptions<Services>,
  ) {
    this.setInstr(effect)
  }

  readonly exit: Fiber<Errors, Output>['exit'] = new I.Lazy(() => {
    if (this.fiberStatus.tag === 'Done') {
      return new I.Of(this.fiberStatus.exit)
    }

    const future = pending<never, never, Exit<Errors, Output>>()

    this.addObserver((exit) => future.complete(new I.Of(exit)))

    return new I.Async(future)
  })

  readonly addObserver: Fiber<Errors, Output>['addObserver'] = (observer) => {
    this.observers.push(observer)

    return Disposable(() => {
      const i = this.observers.indexOf(observer)

      if (i > -1) {
        this.observers.splice(i, 1)
      }
    })
  }

  // Only public to users of FiberRuntime directly
  public start() {
    if (this.started) {
      return false
    }

    this.loop()

    this.started = true
  }

  // Internals

  /**
   * The main loop, processes the current instruction for as long as it can
   * yielding whenever any async operation is encountered.
   */
  protected loop() {
    this.running()

    while (this.instr) {
      try {
        this.step(this.instr)
      } catch (e) {
        this.continueWithCause(new Cause.Unexpected(e))
      }
    }

    this.pending()
  }

  protected step(instr: I.Instruction<any, any, any>) {
    ;(this[instr.tag] as (i: typeof instr) => void)(instr)
  }

  // Constructors

  protected Of(instr: I.Of<any>) {
    this.continueWith(instr.input)
  }

  protected FromCause(instr: I.FromCause<any>) {
    this.continueWithCause(instr.input)
  }

  protected Sync(instr: I.Sync<any>) {
    this.continueWith(instr.input())
  }

  protected Async(instr: I.Async<any, any, any>) {
    this.addTrace(instr.__trace)

    const { state, addObserver } = instr.input

    // If the future is resolved, just use it's value now
    if (state.tag === 'Resolved') {
      return this.setInstr(state.effect)
    }

    // Otherwise wait for the future to resolve
    const inner = Disposable.settable()

    inner.add(
      addObserver((effect) => {
        inner.dispose()
        this.setInstr(effect)
        this.loop()
      }),
    )

    inner.add(this.disposable.add(inner))
  }

  protected Lazy(instr: I.Lazy<any, any, any>) {
    this.addTrace(instr.__trace)
    this.setInstr(instr.input())
  }

  // Functionality

  protected AccessContext(instr: I.AccessContext<any, any, any, any>) {
    this.addTrace(instr.__trace)
    this.setInstr(instr.input(this.currentContext.current))
  }

  protected ProvideContext(instr: I.ProvideContext<any, any, any>) {
    const [effect, ctx] = instr.input
    this.currentContext.push(ctx)
    this.frames.push(new PopFrame(() => this.currentContext.pop(), instr.__trace))
    this.setInstr(effect)
  }

  protected GetRuntimeFlags() {
    this.continueWith(this.getFiberRuntimeFlags())
  }

  protected GetFiberRefs() {
    this.continueWith(this.currentFiberRefs.current)
  }

  protected WithFiberRefs(instr: I.WithFiberRefs<any, any, any>) {
    const [effect, refs] = instr.input
    this.currentFiberRefs.push(refs)
    this.frames.push(new PopFrame(() => this.currentFiberRefs.pop(), instr.__trace))
    this.setInstr(effect)
  }

  protected SetInterruptStatus(instr: I.SetInterruptStatus<any, any, any>) {
    this.addTrace(instr.__trace)
    const currentStatus = this.interruptStatus
    const [effect, status] = instr.input

    // If currently interruptable, mark this spot in the stack to check for
    // interrupters of this fiber
    if (currentStatus) {
      this.frames.push(new InterruptFrame(instr.__trace))
    }

    this.interruptStatus = status
    this.frames.push(new PopFrame(() => currentStatus))
    this.setInstr(effect)
  }

  // Frames

  protected Map(instr: I.Map<any, any, any, any>) {
    const [effect, f] = instr.input
    this.frames.push(new MapFrame(f, instr.__trace))
    this.setInstr(effect)
  }

  protected FlatMap(instr: I.FlatMap<any, any, any, any, any, any>) {
    const [effect, f] = instr.input
    this.frames.push(new FlatMapFrame(f, instr.__trace))
    this.setInstr(effect)
  }

  protected Match(instr: I.Match<any, any, any, any, any, any, any, any, any>) {
    const [effect, f, g] = instr.input
    this.frames.push(new MatchFrame(f, g, instr.__trace))
    this.setInstr(effect)
  }

  protected MapCause(instr: I.MapCause<any, any, any, any>) {
    const [effect, f] = instr.input
    this.frames.push(new MapCauseFrame(f, instr.__trace))
    this.setInstr(effect)
  }

  protected FlatMapCause(instr: I.FlatMapCause<any, any, any, any, any, any>) {
    const [effect, f] = instr.input
    this.frames.push(new FlatMapCauseFrame(f, instr.__trace))
    this.setInstr(effect)
  }

  // Control flow

  protected continueWith(value: any): void {
    const frame = this.frames.pop()

    if (!frame) {
      return this.done(Either.right(value))
    }

    switch (frame.tag) {
      case 'FlatMap':
        return this.setInstr(frame.f(value))
      case 'Map':
        return this.continueWith(frame.f(value))
      case 'Match':
        return this.setInstr(frame.g(value))
      case 'Interrupt': {
        if (RA.isNonEmpty(this.interruptedBy)) {
          return this.interruptNow(this.interruptedBy)
        } else {
          this.interruptStatus = true
        }
      }
    }

    this.continueWith(value)
  }

  protected continueWithCause(cause: Cause.Cause<Errors>): void {
    const frame = this.frames.pop()

    if (!frame) {
      return this.done(Either.left(cause))
    }

    switch (frame.tag) {
      case 'Match':
        return this.setInstr(frame.f(cause))
      case 'FlatMapCause':
        return this.setInstr(frame.f(cause))
      case 'MapCause':
        return this.continueWithCause(frame.f(cause))
      case 'Interrupt': {
        if (RA.isNonEmpty(this.interruptedBy)) {
          return this.interruptNow(this.interruptedBy)
        } else {
          this.interruptStatus = true
        }
      }
    }

    this.continueWithCause(cause)
  }

  protected interruptNow(interruptedBy: RA.NonEmptyReadonlyArray<FiberId>) {
    this.continueWithCause(
      pipe(
        interruptedBy,
        RA.mapNonEmpty((id) => new Cause.Interrupted(id)),
        RA.reduce(new Cause.Empty() as Cause.Cause<Errors>, (l, r) => new Cause.Sequential(l, r)),
      ),
    )
  }

  // Status updates

  protected pending() {
    if (this.fiberStatus.tag === 'Running') {
      this.fiberStatus = FiberStatus.Pending
    }
  }

  protected running() {
    if (this.fiberStatus.tag === 'Pending') {
      this.fiberStatus = FiberStatus.Running
    }
  }

  protected done(exit: Exit<Errors, Output>): void {
    this.instr = null
    this.disposable.dispose()
    this.observers.forEach((observer) => observer(exit))
    this.observers = []
  }

  // Helpers

  protected setInstr(effect: Effect<any, any, any> | null): void {
    this.instr = effect as I.Instruction<any, any, any> | null
  }

  protected addTrace(trace?: string) {
    if (this.options.flags.shouldTrace && trace) {
      this.frames.push(new TraceFrame(trace))
    }
  }

  protected getFiberRuntimeFlags(): FiberRuntimeFlags {
    return {
      ...this.options.flags,
      interruptStatus: this.interruptStatus,
    }
  }
}
