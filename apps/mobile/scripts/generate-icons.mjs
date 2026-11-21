/**
 * Renders the VYBORA brand mark (assets/brand/mark.svg) into every app icon
 * and splash asset Expo needs. Requires Playwright + Chromium:
 *   node apps/mobile/scripts/generate-icons.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const mark = readFileSync(join(root, 'assets/brand/mark.svg'), 'utf8');

// Inner glyph only (white V + spark), for adaptive/monochrome layers.
const glyph = (color, scale) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <g transform="translate(512 512) scale(${scale}) translate(-512 -512)">
    <path d="M292 318 L468 700 Q512 790 556 700 L700 388" fill="none" stroke="${color}" stroke-width="100" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="752" cy="268" r="62" fill="${color}"/>
  </g>
</svg>`;
const gradientBg = mark.replace(/<path[\s\S]*<\/svg>/, '</svg>');
const rounded = mark.replace('<rect width="1024" height="1024"', '<rect width="1024" height="1024" rx="230"');

const outputs = [
  { file: 'assets/images/icon.png', svg: mark, size: 1024 },
  { file: 'assets/images/android-icon-foreground.png', svg: glyph('#FFFFFF', 0.62), size: 1024, transparent: true },
  { file: 'assets/images/android-icon-background.png', svg: gradientBg, size: 1024 },
  { file: 'assets/images/android-icon-monochrome.png', svg: glyph('#000000', 0.62), size: 1024, transparent: true },
  { file: 'assets/images/splash-icon.png', svg: rounded, size: 512, transparent: true },
  { file: 'assets/images/favicon.png', svg: rounded, size: 48, transparent: true },
];

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const o of outputs) {
  await page.setViewportSize({ width: o.size, height: o.size });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${o.svg.replace('<svg ', `<svg width="${o.size}" height="${o.size}" `)}</body></html>`,
  );
  await page.locator('svg').screenshot({ path: join(root, o.file), omitBackground: !!o.transparent });
  console.log('wrote', o.file);
}
await browser.close();
