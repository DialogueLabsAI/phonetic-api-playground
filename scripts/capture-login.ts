/**
 * One-time manual warm-up for GoDaddy Auctions.
 *
 * Opens real Chrome (channel: "chrome") with the playwright-extra
 * stealth plugin applied and an on-disk user-data directory at
 * auth/browser-data/. You interact with the page like a normal human:
 *
 *   • If Akamai / PerimeterX shows "Access Denied" or a challenge,
 *     solve it.
 *   • Click around auctions.godaddy.com/beta for 60–90 seconds:
 *     scroll, open a listing, come back. This lets Akamai's _abck
 *     sensor cookie *mature*. Pressing Enter too early bakes a
 *     half-earned cookie into the profile and the next headless run
 *     will be blocked again.
 *   • (Optional) Sign in to GoDaddy.
 *
 * When you press Enter, the context closes and every cookie, storage
 * bucket, and fingerprint-related artifact is left on disk. The
 * scraper reuses this exact profile headless on every subsequent run.
 *
 * Why not storageState? Modern bot managers (Akamai, PerimeterX,
 * DataDome) fingerprint the browser itself — canvas hash, WebGL
 * vendor, font list, plugin list, TLS signature — not just cookies.
 * A JSON snapshot of cookies alone isn't enough. A full persistent
 * profile + real Chrome + stealth evasions is.
 *
 * Usage:
 *   npm run capture-login
 *
 * The auth/ directory is git-ignored. If the profile ever gets
 * blocked again: `rm -rf auth/browser-data` and re-run this.
 */
import { chromium } from "playwright-extra";
import stealth from "puppeteer-extra-plugin-stealth";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline";

chromium.use(stealth());

const USER_DATA_DIR = join(process.cwd(), "auth", "browser-data");
const START_URL = "https://auctions.godaddy.com/beta";

function prompt(question: string): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, () => {
      rl.close();
      resolve();
    });
  });
}

async function main() {
  await mkdir(USER_DATA_DIR, { recursive: true });

  console.log(`Opening real Chrome with profile: ${USER_DATA_DIR}`);
  console.log("(If Chrome isn't installed this will fail — install it first.)");

  const ctx = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    channel: "chrome",
    viewport: { width: 1440, height: 900 },
    locale: "en-US",
    timezoneId: "America/New_York",
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
      "--disable-dev-shm-usage",
    ],
  });
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });

  const page = ctx.pages()[0] ?? (await ctx.newPage());
  await page.goto(START_URL);

  console.log("");
  console.log("   In the browser window that just opened:");
  console.log("");
  console.log("     1. If you see 'Access Denied' or a challenge, solve it.");
  console.log("     2. Spend 60–90 seconds interacting with the page:");
  console.log("        scroll through auctions, open a listing, click");
  console.log("        through filters, scroll some more. Real human");
  console.log("        behavior — don't just wait.");
  console.log("     3. (Optional) Sign in to GoDaddy.");
  console.log("     4. When the auctions table is fully visible and");
  console.log("        nothing looks challenged, come back here.");
  console.log("");
  console.log("   NOTE: If you press Enter before Akamai's sensor script");
  console.log("   is satisfied (~60s of activity), the scraper will be");
  console.log("   blocked on its next run. Take your time.");
  console.log("");

  await prompt("→ Press Enter when the profile feels warm: ");

  // Closing the persistent context flushes state to disk. No explicit
  // storageState save is needed — that's the whole point of a profile.
  await ctx.close();
  console.log(`Saved browser profile to ${USER_DATA_DIR}`);
  console.log("Done. Click Start scrape in the app.");
}

main().catch((err) => {
  console.error("Capture failed:", err);
  process.exit(1);
});
