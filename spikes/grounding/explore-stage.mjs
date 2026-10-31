import { chromium } from 'playwright-core';
const FIX = ['video/contacts','video/lily','video/precall','video/calling','video/call-screen','video/ended','video/settings','messages/inbox','messages/scam','messages/scam-parcel','messages/scam-family','messages/genuine/0','messages/genuine/1','settings/display','settings/display/size/0','settings/display/size/2','settings/advanced'];
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
for (const f of FIX) {
  await page.goto(`http://127.0.0.1:5180/index.html?still=1#${f}`);
  await page.reload();
  await page.waitForTimeout(700);
  const info = await page.evaluate(() => {
    const r = window.__stage.rects();
    const out = {};
    for (const [id, b] of Object.entries(r)) {
      const el = document.querySelector(`[data-ground-id="${id}"]`);
      out[id] = { b, t: (el?.innerText || el?.getAttribute('aria-label') || el?.getAttribute('title') || '').replace(/\s+/g, ' ').slice(0, 60) };
    }
    return out;
  });
  console.log('==', f, Object.keys(info).length);
  if (['video/calling','video/call-screen','messages/scam','messages/genuine/0','settings/display'].includes(f)) for (const [id, v] of Object.entries(info)) console.log('  ', id.padEnd(30), JSON.stringify(v.b), '|', v.t);
}
await browser.close();
