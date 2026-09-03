import { afterEach, expect, test, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

afterEach(() => vi.unstubAllEnvs());

test.each(["true", "false"])("renders one layout action in mode %s", async (enabled) => {
  vi.stubEnv("VITE_ENABLE_AI_DRAFT", enabled);
  vi.resetModules();
  const { App } = await import("./App");
  const html = renderToStaticMarkup(<App />);
  expect(html.match(/排版文章<\/button>/g)).toHaveLength(1);
  expect(html).not.toContain("生成初稿");
  if (enabled === "true") expect(html).toContain("AI 排版：自动判断");
  else {
    expect(html).toContain("本地排版，无 AI");
    expect(html).toContain('href="https://wenzhangyijianpaiban.vercel.app/"');
  }
});
