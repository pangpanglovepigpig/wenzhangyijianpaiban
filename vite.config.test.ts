import { describe, expect, test } from "vitest";
import config, { LEGACY_SAFARI_TARGET } from "./vite.config";

describe("browser compatibility build", () => {
  test("keeps Safari 14 as an explicit JavaScript and CSS target", () => {
    expect(LEGACY_SAFARI_TARGET).toBe("safari14");
    expect(config.build?.target).toBe(LEGACY_SAFARI_TARGET);
    expect(config.build?.cssTarget).toBe(LEGACY_SAFARI_TARGET);
  });
});
