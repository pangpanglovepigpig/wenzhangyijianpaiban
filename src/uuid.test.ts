import { afterEach, describe, expect, test, vi } from "vitest";
import { createId } from "./uuid";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("createId", () => {
  test("uses the native UUID generator when the browser provides it", () => {
    const randomUUID = vi.fn(() => "11111111-2222-4333-8444-555555555555");
    vi.stubGlobal("crypto", { randomUUID, getRandomValues: vi.fn() });

    expect(createId()).toBe("11111111-2222-4333-8444-555555555555");
    expect(randomUUID).toHaveBeenCalledOnce();
  });

  test("creates an RFC 4122 v4 id when old Safari has no randomUUID", () => {
    const getRandomValues = vi.fn((bytes: Uint8Array) => {
      bytes.fill(0xab);
      return bytes;
    });
    vi.stubGlobal("crypto", { getRandomValues });

    const id = createId();

    expect(id).toBe("abababab-abab-4bab-abab-abababababab");
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(getRandomValues).toHaveBeenCalledOnce();
  });

  test("still creates an id if the Web Crypto API is unavailable", () => {
    vi.stubGlobal("crypto", undefined);
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    expect(createId()).toBe("80808080-8080-4080-8080-808080808080");
  });
});
