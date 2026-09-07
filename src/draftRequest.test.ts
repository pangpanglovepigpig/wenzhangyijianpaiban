import { afterEach, describe, expect, test, vi } from "vitest";
import { DraftRequest, DraftTimeoutError } from "./draftRequest";

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe("atomic AI layout request", () => {
  test("waits for a complete result, and disables duplicate submission immediately", async () => {
    const request = new DraftRequest();
    const pending = deferred<string>();
    const task = vi.fn(() => pending.promise);
    const commit = vi.fn();
    const busy = vi.fn();
    const first = request.run(task, commit, vi.fn(), busy);
    await request.run(task, commit, vi.fn(), busy);
    expect(task).toHaveBeenCalledOnce();
    expect(request.pending).toBe(true);
    expect(commit).not.toHaveBeenCalled();
    pending.resolve("complete");
    await first;
    expect(commit).toHaveBeenCalledExactlyOnceWith("complete");
    expect(busy.mock.calls).toEqual([[true], [false]]);
  });

  test.each(["input edit", "manual block edit", "unmount"])("cancels and ignores late results after %s", async (reason) => {
    const request = new DraftRequest();
    const pending = deferred<string>();
    const commit = vi.fn();
    const fail = vi.fn();
    let signal!: AbortSignal;
    const run = request.run((s) => { signal = s; return pending.promise; }, commit, fail, vi.fn());
    request.cancel(reason !== "unmount");
    expect(signal.aborted).toBe(true);
    pending.resolve("stale");
    await run;
    expect(commit).not.toHaveBeenCalled();
    expect(fail).not.toHaveBeenCalled();
  });

  test("does not let an old result or finalizer overwrite a newer request", async () => {
    const request = new DraftRequest();
    const old = deferred<string>();
    const next = deferred<string>();
    const commit = vi.fn();
    const first = request.run(() => old.promise, commit, vi.fn(), vi.fn());
    request.cancel();
    const second = request.run(() => next.promise, commit, vi.fn(), vi.fn());
    old.resolve("stale");
    await first;
    expect(request.pending).toBe(true);
    expect(commit).not.toHaveBeenCalled();
    next.resolve("current");
    await second;
    expect(commit).toHaveBeenCalledExactlyOnceWith("current");
  });

  test("failure never commits an intermediate result or clears the source", async () => {
    const request = new DraftRequest();
    const commit = vi.fn();
    const fail = vi.fn();
    const error = new Error("configuration error");
    await request.run(() => Promise.reject(error), commit, fail, vi.fn());
    expect(commit).not.toHaveBeenCalled();
    expect(fail).toHaveBeenCalledExactlyOnceWith(error);
    expect(request.pending).toBe(false);
  });
});


describe("end-to-end deadline", () => {
  test("releases busy at one minute even when cancellation is ignored, then ignores a late result during retry", async () => {
    vi.useFakeTimers();
    const request = new DraftRequest();
    const old = deferred<string>();
    const next = deferred<string>();
    const commit = vi.fn();
    const fail = vi.fn();
    const busy = vi.fn();
    let signal!: AbortSignal;
    const first = request.run((s) => { signal = s; return old.promise; }, commit, fail, busy);
    await vi.advanceTimersByTimeAsync(59999);
    expect(request.pending).toBe(true);
    expect(fail).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await first;
    expect(signal.aborted).toBe(true);
    expect(fail).toHaveBeenCalledExactlyOnceWith(expect.any(DraftTimeoutError));
    expect(fail.mock.calls[0][0].message).toBe("AI 排版超时，请重试");
    expect(busy.mock.calls).toEqual([[true], [false]]);
    expect(request.pending).toBe(false);
    const second = request.run(() => next.promise, commit, fail, busy);
    old.resolve("stale");
    await Promise.resolve();
    expect(commit).not.toHaveBeenCalled();
    expect(request.pending).toBe(true);
    next.resolve("new");
    await second;
    expect(commit).toHaveBeenCalledExactlyOnceWith("new");
    expect(vi.getTimerCount()).toBe(0);
  });

  test("cancellation settles an uncooperative task immediately and removes its deadline", async () => {
    vi.useFakeTimers();
    const request = new DraftRequest();
    const fail = vi.fn();
    const busy = vi.fn();
    const run = request.run(() => new Promise(() => {}), vi.fn(), fail, busy);
    request.cancel();
    await run;
    await vi.advanceTimersByTimeAsync(180000);
    expect(fail).not.toHaveBeenCalled();
    expect(busy.mock.calls).toEqual([[true], [false]]);
    expect(vi.getTimerCount()).toBe(0);
  });

  test.each(["resolve", "resume"])("rejects an overdue %s when background timers were suspended", async (action) => {
    vi.useFakeTimers();
    const page = new EventTarget();
    vi.stubGlobal("document", page);
    const request = new DraftRequest();
    const pending = deferred<string>();
    const commit = vi.fn();
    const fail = vi.fn();
    const run = request.run(() => pending.promise, commit, fail, vi.fn());
    vi.setSystemTime(Date.now() + 61000);
    if (action === "resolve") pending.resolve("late");
    else page.dispatchEvent(new Event("visibilitychange"));
    await run;
    expect(fail).toHaveBeenCalledWith(expect.any(DraftTimeoutError));
    expect(commit).not.toHaveBeenCalled();
    expect(request.pending).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});
