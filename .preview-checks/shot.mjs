import chromium from '@sparticuz/chromium';
import { chromium as pw } from 'playwright-core';
import fs from 'node:fs';

const exe = await chromium.executablePath();
const browser = await pw.launch({
  executablePath: exe,
  args: [...chromium.args, '--font-render-hinting=none'],
  headless: true,
});
const widths = (process.argv[2] || '500,390,768,1280').split(',').map(Number);
const outDir = 'shots-live';
fs.mkdirSync(outDir, { recursive: true });

for (const w of widths) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: w <= 600 ? 760 : 900 },
    deviceScaleFactor: 1,
    isMobile: w <= 600,
    hasTouch: w <= 600,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 160));
  });
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e).slice(0, 160)));
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1200);

  const metrics = await page.evaluate(() => {
    const box = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        x: Math.round(r.x),
        y: Math.round(r.y),
        w: Math.round(r.width),
        h: Math.round(r.height),
        display: cs.display,
        vis: cs.visibility,
        pos: cs.position,
      };
    };
    const txt = (sel) => document.querySelector(sel)?.textContent?.trim().slice(0, 40) ?? null;
    return {
      body: box('body'),
      studio: box('.fiberlab-studio'),
      bodyRow: box('.pu-body'),
      sidebar: box('.fiberlab-sidebar'),
      fab: box('.pu-fab-components'),
      canvas: box('.fiberlab-studio-main'),
      flow: box('.react-flow'),
      empty: box('[class*="pu-empty"]'),
      emptyText: txt('.pu-empty-title'),
      status: box('.pu-status, [class*="status"]'),
      nav: box('[class*="section-nav"], nav'),
      toolbar: box('.pu-toolbar'),
      topbar: box('.pu-topbar'),
      docH: document.documentElement.scrollHeight,
      innerH: window.innerHeight,
    };
  });
  fs.writeFileSync(`shots-live/m-${w}.json`, JSON.stringify(metrics, null, 1));
  fs.writeFileSync(`shots-live/err-${w}.json`, JSON.stringify(errors, null, 1));
  await page.screenshot({ path: `${outDir}/w-${w}.png`, fullPage: false });
  console.log(w, JSON.stringify(metrics), errors.length ? 'errors:' + errors.slice(0, 3).join(' | ') : 'no errors');
  await ctx.close();
}
await browser.close();
