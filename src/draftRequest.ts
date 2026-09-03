/** Owns one atomic generation. A cancelled or superseded request cannot commit. */
export class DraftRequest {
  private controller: AbortController | null = null;
  private generation = 0;
  private onBusy: ((busy: boolean) => void) | null = null;

  get pending() { return this.controller !== null; }

  cancel(notify = true) {
    this.generation += 1;
    this.controller?.abort();
    this.controller = null;
    if (notify) this.onBusy?.(false);
    this.onBusy = null;
  }

  async run<T>(
    task: (signal: AbortSignal) => Promise<T>,
    commit: (result: T) => void,
    fail: (error: unknown) => void,
    busy: (pending: boolean) => void,
  ) {
    if (this.pending) return;
    const generation = ++this.generation;
    const controller = new AbortController();
    this.controller = controller;
    this.onBusy = busy;
    busy(true);
    try {
      const result = await task(controller.signal);
      if (generation === this.generation && !controller.signal.aborted) commit(result);
    } catch (error) {
      if (generation === this.generation && !controller.signal.aborted) fail(error);
    } finally {
      if (generation === this.generation) {
        this.controller = null;
        this.onBusy = null;
        busy(false);
      }
    }
  }
}
