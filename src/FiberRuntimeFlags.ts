export interface FiberRuntimeFlags {
  readonly interruptStatus: boolean
  readonly shouldTrace: boolean
}

export function FiberRuntimeFlags(overrides: Partial<FiberRuntimeFlags> = {}): FiberRuntimeFlags {
  return {
    interruptStatus: true,
    shouldTrace: true,
    ...overrides,
  }
}
