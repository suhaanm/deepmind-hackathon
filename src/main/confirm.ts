import { randomUUID } from 'node:crypto'
import type { StateStore } from './state'

const CONFIRM_TIMEOUT_MS = 120_000

// ask_user_confirm: approval can only ever arrive through answer(), which is wired to a real click in the dock.
export class ConfirmBroker {
  private pending: { id: string; options: [string, string]; resolve: (choice: string | null) => void; timer: NodeJS.Timeout } | null = null

  constructor(private readonly state: StateStore) {}

  ask(question: string, options: [string, string]): Promise<string | null> {
    this.cancel()
    const id = randomUUID()
    return new Promise((resolve) => {
      const timer = setTimeout(() => this.settle(null), CONFIRM_TIMEOUT_MS)
      this.pending = { id, options, resolve, timer }
      this.state.patch({ pendingConfirm: { id, question: question.slice(0, 500), options } })
    })
  }

  answer(id: string, choice: string): boolean {
    if (!this.pending || this.pending.id !== id || !this.pending.options.includes(choice)) return false
    this.settle(choice)
    return true
  }

  cancel(): void {
    if (this.pending) this.settle(null)
  }

  private settle(choice: string | null): void {
    const pending = this.pending
    if (!pending) return
    clearTimeout(pending.timer)
    this.pending = null
    this.state.patch({ pendingConfirm: undefined })
    pending.resolve(choice)
  }
}
