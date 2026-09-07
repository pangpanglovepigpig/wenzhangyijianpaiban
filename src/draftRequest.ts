export const DRAFT_TIMEOUT_MS = 60_000;

export class DraftTimeoutError extends Error {
  constructor() {
    super("AI 排版超时，请重试");
    this.name = "DraftTimeoutError";
  }
}

/** Owns one atomic generation, including its end-to-end deadline. */
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
    const started = Date.now();
    let outcome = "error";
    let rejectWait!: (error: unknown) => void;
    const stopped = new Promise<never>((_resolve, reject) => { rejectWait = reject; });
    const onAbort = () => rejectWait(controller.signal.reason);
    const expire = () => {
      const error = new DraftTimeoutError();
      rejectWait(error);
      controller.abort(error);
    };
    const checkDeadline = () => {
      if (Date.now() - started >= DRAFT_TIMEOUT_MS) expire();
    };
    controller.signal.addEventListener("abort", onAbort, { once: true });
    const timer = setTimeout(expire, DRAFT_TIMEOUT_MS);
    // Browsers may suspend timers in background tabs. Recheck on resume and commit.
    const page = typeof document === "undefined" ? undefined : document;
    page?.addEventListener("visibilitychange", checkDeadline);
    busy(true);
    try {
      const result = await Promise.race([task(controller.signal), stopped]);
      if (Date.now() - started >= DRAFT_TIMEOUT_MS) {
        controller.abort(new DraftTimeoutError());
        throw new DraftTimeoutError();
      }
      if (generation === this.generation && !controller.signal.aborted) {
        commit(result);
        outcome = "success";
      } else outcome = "cancelled";
    } catch (error) {
      const timedOut = controller.signal.reason instanceof DraftTimeoutError || Date.now() - started >= DRAFT_TIMEOUT_MS;
      outcome = generation !== this.generation ? "cancelled" : timedOut ? "timeout" : "error";
      if (generation === this.generation) {
        if (timedOut) controller.abort(new DraftTimeoutError());
        fail(timedOut ? new DraftTimeoutError() : error);
      }
    } finally {
      clearTimeout(timer);
      controller.signal.removeEventListener("abort", onAbort);
      page?.removeEventListener("visibilitychange", checkDeadline);
      console.info("article_layout_client", { outcome, durationMs: Date.now() - started });
      if (generation === this.generation) {
        this.controller = null;
        this.onBusy = null;
        busy(false);
      }
    }
  }
}
