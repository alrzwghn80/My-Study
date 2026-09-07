// One-off manual browser smoke test for the critical timer flow — not part
// of the automated test suite (no test runner integration, no assertions
// library) — just a quick real-browser walk-through before calling the UI
// done. Run with: node scripts/e2e-smoke.mjs
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const EMAIL = process.env.SEED_USER_EMAIL ?? "maryam.rednight.1@gmail.com";
const PASSWORD = process.env.SEED_USER_PASSWORD ?? "ChangeMe123!";

function log(msg) {
  console.log(`[e2e] ${msg}`);
}

async function main() {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));

  log("Navigating to /login");
  await page.goto(`${BASE}/login`);
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 10000 });
  log("Logged in, on Study page");

  await page.waitForSelector("text=Start studying", { timeout: 10000 });
  log("Start studying button visible");

  await page.click("text=Start studying");
  await page.waitForSelector("text=Pause", { timeout: 10000 });
  log("Session started — focused overlay visible with Pause button");

  await page.waitForTimeout(2200);
  const clockText1 = await page.textContent('[aria-live="polite"]');
  log(`Clock after ~2s: ${clockText1?.trim()}`);
  if (clockText1?.trim() === "00:00:00") throw new Error("Timer did not advance");

  await page.click("text=Pause");
  await page.waitForSelector("text=Resume", { timeout: 10000 });
  log("Paused — Resume button visible");

  await page.click("text=Resume");
  await page.waitForSelector("text=Pause", { timeout: 10000 });
  log("Resumed — Pause button visible again");

  await page.click("text=Finish");
  await page.waitForSelector("text=recorded", { timeout: 10000 });
  log("Completion confirmation shown");

  await page.waitForSelector("text=Start studying", { timeout: 10000 });
  log("Back to idle — Start studying visible again, overlay dismissed");

  await page.goto(`${BASE}/history`);
  await page.waitForSelector("text=All sessions", { timeout: 10000 });
  const historyBody = await page.textContent("body");
  if (!/\d+[hm]/.test(historyBody)) throw new Error("History page shows no recorded duration");
  log("History page shows the completed session");

  if (consoleErrors.length > 0) {
    console.error("[e2e] Console errors detected:");
    for (const e of consoleErrors) console.error("  " + e);
    process.exitCode = 1;
  } else {
    log("No console errors. PASS");
  }

  await browser.close();
}

main().catch((err) => {
  console.error("[e2e] FAILED:", err);
  process.exitCode = 1;
});
