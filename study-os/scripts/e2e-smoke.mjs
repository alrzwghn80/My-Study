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
  log("Logged in, on dashboard");

  await page.waitForSelector("text=Start Studying", { timeout: 10000 });
  log("Start Studying button visible");

  await page.click("text=Start Studying");
  await page.waitForSelector("text=Pause", { timeout: 10000 });
  log("Session started — Pause button visible");

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

  await page.click("text=Complete");
  await page.waitForSelector("text=Session complete", { timeout: 10000 });
  log("Review modal opened");

  await page.selectOption("#review-category", { label: "Grammar" });
  await page.click('button:has-text("4")').catch(() => {}); // productivity rating, best-effort
  await page.fill("#review-notes", "e2e smoke test session");
  await page.click("text=Save Session");
  await page.waitForSelector("text=Session complete", { state: "detached", timeout: 10000 });
  log("Review saved, modal closed");

  await page.waitForSelector("text=Start Studying", { timeout: 10000 });
  log("Back to idle — Start Studying visible again");

  await page.goto(`${BASE}/history`);
  await page.waitForSelector("li:has-text('Grammar')", { timeout: 10000 });
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
