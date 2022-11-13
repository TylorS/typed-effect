export interface RuntimeFlags {
  readonly interruptStatus: boolean
  readonly shouldTrace: boolean
}

export function RuntimeFlags(overrides: Partial<RuntimeFlags> = {}): RuntimeFlags {
  return {
    interruptStatus: true,
    shouldTrace: true,
    ...overrides,
  }
}
