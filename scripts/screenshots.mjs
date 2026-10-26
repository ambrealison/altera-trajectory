// Screenshots of every screen in French and English at 1280, 1440 and 1920 px, with automatic checks:
// the "illustrative data" badge is visible and nothing overflows horizontally.
// Usage: npm run dev (in another terminal), then npm run screenshots. Uses the installed Google Chrome.
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:5173/altera-trajectory/";
const OUT = process.env.OUT ?? "screenshots";
const SIZES = [[1280, 800], [1440, 900], [1920, 1080]];
const LABELS = {
  fr: { matrix: "Matrice impact / effort", time: "Dans le temps" },
  en: { matrix: "Impact / effort matrix", time: "Over time" },
};
const VIEWS = [
  { name: "0-cover", hash: "v=baseline&sc=committed", cover: true },
  { name: "1-baseline", hash: "v=baseline&sc=committed" },
  { name: "1-baseline-fg1", hash: "v=baseline&sc=committed&m=fg1" },
  { name: "2-levers-list", hash: "v=levers&sc=committed" },
  { name: "2-levers-matrix", hash: "v=levers&sc=committed", click: "matrix" },
  { name: "3-trajectory-by-lever", hash: "v=trajectory&sc=ambitious" },
  { name: "3-trajectory-over-time", hash: "v=trajectory&sc=ambitious", click: "time" },
  { name: "3-trajectory-2030", hash: "v=trajectory&sc=ambitious&h=2030", click: "time" },
  { name: "3-lever-sheet", hash: "v=trajectory&sc=ambitious", lever: true },
  { name: "4-with-your-data", hash: "v=data&sc=committed" },
];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
const problems = [];
for (const lang of ["fr", "en"]) {
  for (const [w, h] of SIZES) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    await page.addInitScript(() => { try { localStorage.setItem("altera-trajectory:tour", "seen"); } catch {} });
    for (const v of VIEWS) {
      await page.goto(`${BASE}#${v.hash}&lang=${lang}`);
      await page.reload();
      await page.waitForSelector(".cover-page");
      if (!v.cover) {
        await page.getByRole("button", { name: "Let's go" }).click();
        await page.waitForSelector(".shead h1");
      }
      if (v.click) await page.getByRole("button", { name: LABELS[lang][v.click], exact: true }).click();
      if (v.lever) await page.locator(".lever-mini .lname").first().click();
      await page.waitForTimeout(v.cover ? 900 : 450);
      const check = await page.evaluate(() => {
        const badge = document.querySelector(".demo-badge")?.getBoundingClientRect();
        const main = document.getElementById("main");
        const wide = [...document.querySelectorAll("body *")]
          .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.right > window.innerWidth + 1; })
          .map((el) => el.className?.baseVal ?? el.className).slice(0, 5);
        return {
          badge: !!badge && badge.width > 0 && badge.right <= window.innerWidth && badge.top >= 0,
          docOverflow: document.documentElement.scrollWidth > window.innerWidth,
          mainOverflow: main ? main.scrollWidth > main.clientWidth : false,
          wide,
        };
      });
      const file = `${OUT}/${lang}-${w}-${v.name}.png`;
      await page.screenshot({ path: file });
      if (!check.badge || check.docOverflow || check.mainOverflow || check.wide.length) problems.push({ file, ...check });
    }
    await page.close();
  }
}
// first visit: cover, then the guided tour starts by itself after "Let's go"
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`${BASE}?lang=fr`);
await page.getByRole("button", { name: "Let's go" }).click();
await page.waitForSelector(".tour-bubble");
await page.screenshot({ path: `${OUT}/fr-1440-0-guided-tour.png` });
await browser.close();

console.log(`${VIEWS.length * SIZES.length * 2 + 1} screenshots in ${OUT}/`);
if (problems.length) {
  console.error("Problems:", JSON.stringify(problems, null, 2));
  process.exit(1);
}
console.log("Badge visible everywhere, no horizontal overflow.");
