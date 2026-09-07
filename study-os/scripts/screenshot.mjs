import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const EMAIL = process.env.SEED_USER_EMAIL ?? "maryam.rednight.1@gmail.com";
const PASSWORD = process.env.SEED_USER_PASSWORD ?? "ChangeMe123!";
const path = process.argv[2] ?? "/";
const width = Number(process.argv[3] ?? 1280);
const height = Number(process.argv[4] ?? 900);
const out = process.argv[5] ?? "/tmp/screenshot.png";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width, height } });
await page.goto(`${BASE}/login`);
await page.fill("#email", EMAIL);
await page.fill("#password", PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/`, { timeout: 10000 });
await page.goto(`${BASE}${path}`);
await page.waitForTimeout(600);
await page.screenshot({ path: out, fullPage: true });
console.log("saved", out);
await browser.close();
