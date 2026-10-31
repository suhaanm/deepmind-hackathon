import { chromium } from 'playwright-core';
const FIX = ['messages/scam','messages/scam-parcel','messages/scam-family','messages/genuine/0','messages/genuine/1','messages/genuine/2','messages/genuine/3','video/contacts','video/lily','video/precall','video/ended','video/settings','settings/display/size/0','settings/advanced'];
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
for (const f of FIX) {
  await page.goto(`http://127.0.0.1:5180/index.html?still=1#${f}`); await page.reload(); await page.waitForTimeout(600);
  const info = await page.evaluate(() => {
    const r = window.__stage.rects(); const out = {};
    for (const [id, b] of Object.entries(r)) {
      if (id.startsWith('desk.') || id.endsWith('.window') || id.includes('.win.')) continue;
      const el = document.querySelector(`[data-ground-id="${id}"]`);
      out[id] = (el?.innerText || el?.getAttribute('aria-label') || '').replace(/\s+/g, ' ').slice(0, id.startsWith('messages.msg') || id.startsWith('messages.banner') ? 400 : 45);
    }
    return out;
  });
  console.log('==', f);
  for (const [id, t] of Object.entries(info)) console.log('  ', id.padEnd(32), '|', t);
}
await browser.close();
