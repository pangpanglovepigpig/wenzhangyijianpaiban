import { expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { App } from "./App";

test("renders a single local layout action without an AI service link", () => {
  const html = renderToStaticMarkup(<App />);
  expect(html.match(/排版文章<\/button>/g)).toHaveLength(1);
  expect(html).toContain("本地自动排版，文章无需上传");
  expect(html).not.toMatch(/AI 排版|vercel|deepseek|最多等待/);
});
