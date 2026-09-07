// Production-build browser checks. Optional private articles stay outside Git.
// LAYOUT_PLAYWRIGHT_PATH=/path/to/playwright node scripts/verify-layout-ui.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { preview } from 'vite';
import { build } from 'esbuild';

const pw = await import(process.env.LAYOUT_PLAYWRIGHT_PATH
  ? pathToFileURL(path.join(process.env.LAYOUT_PLAYWRIGHT_PATH, 'index.mjs')).href : 'playwright');
const target = process.env.LAYOUT_QA_URL;
const output = process.env.LAYOUT_QA_OUTPUT || await fs.mkdtemp(path.join(os.tmpdir(), 'local-layout-qa-'));
await fs.mkdir(output, { recursive: true });
const server = target ? null : await preview({ preview: { host: '127.0.0.1', port: 4175, strictPort: true } });
const url = target || 'http://127.0.0.1:4175/';
const runtime = await build({ stdin: { contents: `
  import { createBlocksFromText, formatArticle } from './src/formatter';
  import { layoutPreservesSource } from './shared/articleStructure.js';
  import { prepareBlocksForPng } from './src/exportImage';
  import { paginateBlocks } from './src/pagination';
  import { resolveCardStyle, THEME_OPTIONS } from './src/cardStyle';
  import { shenzhenArticle, xiaomianArticle, huizhouArticle } from './src/testFixtures';
  window.layoutQA = { createBlocksFromText, formatArticle, layoutPreservesSource, prepareBlocksForPng,
    paginateBlocks, resolveCardStyle, THEME_OPTIONS, articles: [shenzhenArticle, xiaomianArticle, huizhouArticle] };
`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, write: false, format: 'iife', target: 'es2020' });
const browser = await pw.chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 2, acceptDownloads: true });
const page = await context.newPage();
const errors = [], forbidden = [];
page.on('pageerror', e => errors.push(e.message));
page.on('request', request => {
  if (/deepseek|\/api\/generate-draft/.test(request.url()) || (/vercel/.test(request.url()) && !url.includes('vercel'))) forbidden.push(request.url());
});
async function ready() {
  await page.waitForFunction(() => document.querySelector('.preview-scroll')?.getAttribute('aria-busy') === 'false'
    && document.querySelectorAll('.preview-image').length > 0);
}
async function layout(text) {
  await page.getByRole('textbox', { name: '文章正文', exact: true }).fill(text);
  await page.getByRole('button', { name: '排版文章', exact: true }).click();
  await ready();
  const rendered = await page.getByRole('textbox', { name: '排版块文本', exact: true }).evaluateAll(nodes => nodes.map(node => node.value).join(''));
  assert.equal(rendered.replace(/\s/g, ''), text.split(/\r?\n/).filter(line => !/^-{3,}$/.test(line.trim())).map(line => line.replace(/^#{1,3}\s+/, '')).join('').replace(/\s/g, ''));
  return page.locator('.preview-image').count();
}
try {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await ready();
  assert.match(await page.locator('body').innerText(), /本地自动排版，文章无需上传/);
  await page.addScriptTag({ content: runtime.outputFiles[0].text });
  const privateArticles = process.env.LAYOUT_QA_ARTICLES ? JSON.parse(await fs.readFile(process.env.LAYOUT_QA_ARTICLES, 'utf8')) : [];
  const cases = await page.evaluate(() => window.layoutQA.articles.map(text => ({ title: text.split('\n')[0], text })));
  const results = [];
  for (const article of [...cases, ...privateArticles]) {
    const images = await layout(article.text);
    results.push({ title: article.title, characters: article.text.length, images });
  }
  await page.locator('.preview-image').first().screenshot({ path: path.join(output, 'preview-first.png') });
  await page.screenshot({ path: path.join(output, 'mobile.png') });
  const measurements = await page.evaluate((extras) => {
    const q = window.layoutQA;
    const articles = [...q.articles, ...extras.map(a => a.text), '长引文\n\n老师说：“' + '这是很长的一段引文，没有安全断句位置，'.repeat(90) + '”'];
    let checkedPages = 0;
    for (const article of articles) for (const theme of q.THEME_OPTIONS) for (const size of [14, 16.5, 20]) {
      const blocks = q.createBlocksFromText(article);
      const style = q.resolveCardStyle({ themeId: theme.id, fontFamilyId: 'system', baseFontSize: size });
      const fitted = q.prepareBlocksForPng(blocks, style);
      const pages = q.paginateBlocks(fitted.blocks, fitted.heights, style);
      if (!q.layoutPreservesSource(pages.flatMap(p => p.blocks), article)) throw new Error('Page text mismatch: ' + theme.id);
      for (const p of pages) {
        const used = p.blocks.reduce((sum, b) => sum + fitted.heights.get(b.id), 0);
        if (used > style.contentHeight + 0.01) throw new Error('Page overflow: ' + theme.id);
        if (pages.indexOf(p) < pages.length - 1 && /^(?:hr|h[123])$/.test(p.blocks[p.blocks.length - 1].type)) throw new Error('Orphan heading: ' + theme.id);
      }
      checkedPages += pages.length;
    }
    return { checkedPages, combinations: articles.length * q.THEME_OPTIONS.length * 3 };
  }, privateArticles);
  // Throttle JavaScript to approximate a slower phone; this is not a physical-device measurement.
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const ruleMs = await page.evaluate(() => {
    const source = ('复习记录\n\n' + '建议先核对报名条件，再整理自己的材料。'.repeat(180)).slice(0, 3000);
    const times = [];
    for (let i = 0; i < 10; i++) {
      const start = performance.now(); window.layoutQA.createBlocksFromText(source); times.push(performance.now() - start);
    }
    return { characters: source.length, max: Math.max(...times), mean: times.reduce((a,b) => a+b) / times.length };
  });
  assert(ruleMs.max < 1000, 'Rule processing exceeds one second');
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  // Editing the source leaves manual edits until the user explicitly formats again.
  const editor = page.getByRole('textbox', { name: '排版块文本', exact: true }).first();
  await editor.fill('手工保留内容'); await ready();
  await page.getByRole('textbox', { name: '文章正文', exact: true }).fill('');
  assert(await page.getByRole('button', { name: '排版文章', exact: true }).isDisabled());
  assert.equal(await editor.inputValue(), '手工保留内容');
  await page.getByRole('textbox', { name: '文章正文', exact: true }).fill('改动后的输入\n\n正文保持完整。');
  assert.equal(await editor.inputValue(), '手工保留内容');
  await layout('改动后的输入\n\n正文保持完整。');
  // Force a PNG failure and verify independent preview retry.
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function(callback) { callback(null); };
    window.restoreBlob = () => { HTMLCanvasElement.prototype.toBlob = original; };
  });
  await page.getByRole('button', { name: '刷新预览', exact: true }).click();
  await page.getByText('预览生成失败，请再刷新一次。', { exact: true }).waitFor();
  await page.evaluate(() => window.restoreBlob());
  await page.getByRole('button', { name: '刷新预览', exact: true }).click(); await ready();
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' }); await ready();
  await layout(privateArticles[0]?.text || cases[0].text);
  const downloadEvent = page.waitForEvent('download');
  await page.locator('.download-link').first().click();
  const download = await downloadEvent;
  await download.saveAs(path.join(output, 'offline-download.png'));
  assert((await fs.stat(path.join(output, 'offline-download.png'))).size > 1000);
  const networkAfterLoad = [];
  page.on('request', request => { if (/^https?:/.test(request.url())) networkAfterLoad.push(request.url()); });
  await layout('断网重试\n\n- 身份证\n- 毕业证\n\n老师说：“别着急。先看清楚。”之后继续。');
  await page.getByRole('button', { name: '刷新预览', exact: true }).click(); await ready();
  assert.deepEqual(networkAfterLoad, []);
  assert.deepEqual(forbidden, []);
  assert.deepEqual(errors, []);
  const report = { url, results, measurements, ruleMs, offlineLayout: true, offlineDownload: true, manualEdits: true,
    previewRetry: true, noAiRequests: true, pageErrors: errors, output };
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
  if (server) await new Promise(resolve => server.httpServer.close(resolve));
}
