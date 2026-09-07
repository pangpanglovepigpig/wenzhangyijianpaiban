// Local-only browser QA harness. Never imported by the application or API.
// Run: node scripts/verify-layout-ui.mjs
import { createServer } from "vite";
import { buildSentenceIndex, createBlocksFromText, applyStructureSuggestions } from "../shared/articleStructure.js";

process.env.VITE_ENABLE_AI_DRAFT = "true";
const mode = process.env.LAYOUT_QA_MODE || "normal";
if (!["normal", "hang", "body-stall", "unavailable", "timeout-then-success"].includes(mode)) {
  throw new Error("Unknown LAYOUT_QA_MODE");
}
let requestCount = 0;
const server = await createServer({
  server: { host: "127.0.0.1", port: 4175, strictPort: true },
  plugins: [{
    name: "local-layout-qa",
    configureServer(vite) {
      vite.middlewares.use("/api/generate-draft", async (req, res) => {
        try {
          const chunks = [];
          for await (const chunk of req) chunks.push(chunk);
          const { text } = JSON.parse(Buffer.concat(chunks).toString());
          requestCount += 1;
          if (mode === "hang" || (mode === "timeout-then-success" && requestCount === 1)) return;
          if (mode === "body-stall") {
            res.setHeader("Content-Type", "application/json");
            res.write('{"blocks":');
            return;
          }
          if (mode === "unavailable") {
            res.statusCode = 503;
            res.end(JSON.stringify({ error: "AI 服务暂时不可用，请稍后重试。" }));
            return;
          }
          const { huizhouStructure } = await vite.ssrLoadModule("/src/testFixtures.ts");
          const sentences = buildSentenceIndex(text);
          const structure = huizhouStructure.flatMap(({ quote, action }) => {
            const sentence = sentences.find((item) => item.text === quote);
            return sentence ? [{ sentenceId: sentence.sentenceId, action }] : [];
          });
          const blocks = applyStructureSuggestions(createBlocksFromText(text), structure, text);
          await new Promise((resolve) => setTimeout(resolve, 1500));
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ blocks, notice: "本地验收：模拟 AI 建议，不消耗额度。" }));
        } catch {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: "Local QA failed" }));
        }
      });
    },
  }],
});
await server.listen();
server.printUrls();
