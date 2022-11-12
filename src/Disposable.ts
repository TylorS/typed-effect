export interface Disposable {
  readonly dispose: () => void
}

export function Disposable(dispose: Disposable['dispose']): Disposable {
  return { dispose }
}

export namespace Disposable {
  export interface Settable extends Disposable {
    readonly add: (disposable: Disposable) => Disposable
  }
}

Disposable.unit = Disposable(() => void 0)

Disposable.settable = (): Disposable.Settable => {
  let disposed = false
  let disposables: Disposable[] = []

  const add = (disposable: Disposable): Disposable => {
    if (disposed) {
      disposable.dispose()

      return Disposable.unit
    } else {
      disposables.push(disposable)

      return Disposable(() => {
        const i = disposables.indexOf(disposable)

        if (i > -1) {
          disposables.splice(i, 1)
        }
      })
    }
  }

  const { dispose } = Disposable(() => {
    disposables.forEach((d) => d.dispose())
    disposables = []
    disposed = true
  })

  return {
    add,
    dispose,
  } as const
}
