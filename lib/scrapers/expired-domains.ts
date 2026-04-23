/**
 * Playwright scraper for GoDaddy Domain Auctions (the /beta UI).
 *
 * Flow:
 *   1. Load https://auctions.godaddy.com/beta
 *   2. Click "Advanced Search" to open the filter panel
 *   3. Under Type, check "Expiring" and "Closeouts"
 *   4. Apply and wait for the results table to populate
 *   5. Scrape every row of the first page along with the column headers
 *      shown in the UI (Name, Time Left, Bids, Price, Estimated Value,
 *      Age, Traffic, Taken TLDs, Exact Match TLDs, Developed TLDs,
 *      Majestic TF, Majestic CF, Majestic Backlinks, Majestic Ref Domains)
 *
 * Anti-bot stack (GoDaddy sits behind Akamai Bot Manager, not just
 * PerimeterX):
 *   - playwright-extra + puppeteer-extra-plugin-stealth applies ~15
 *     fingerprint evasions (webdriver, navigator.plugins, WebGL
 *     vendor, chrome.runtime, permissions, canvas noise, etc.).
 *   - channel: "chrome" drives the *real* installed Chrome so the TLS
 *     fingerprint (JA3/JA4) matches a real user, not bundled Chromium.
 *   - A persistent on-disk profile at auth/browser-data/ carries
 *     Akamai's _abck sensor cookie between runs. `npm run capture-login`
 *     opens the profile headful so you can warm it up manually (pass
 *     any Access Denied challenge, click around for a bit); every
 *     subsequent headless run reuses the earned clearance.
 *   - Jittered delays, hover-then-click, mouse wiggles.
 *
 * Login is optional — browsing + scraping auctions works anonymously.
 * The persistent profile captures the sensor clearance either way.
 */
import { chromium } from "playwright-extra";
import type { BrowserContext, Page, Locator } from "playwright";
// puppeteer-extra-plugin-stealth: bundle of ~15 evasions (webdriver,
// navigator.plugins, WebGL vendor, chrome.runtime, permissions, etc.)
// that plug into playwright-extra and apply on every page in the ctx.
import stealth from "puppeteer-extra-plugin-stealth";
import { mkdtemp, mkdir, writeFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Register the stealth plugin exactly once at module load. playwright-
// extra dedupes internally if this file is re-imported.
chromium.use(stealth());

const AUCTIONS_URL = "https://auctions.godaddy.com/beta";

// Persistent on-disk browser profile. The capture-login script warms
// this up (cookies + PerimeterX fingerprint state + any "Remember me"
// session), and the scraper reuses it headless. PX cares about the
// *browser*, not just cookies, so a plain storageState.json isn't
// enough — we need the whole profile to persist.
const USER_DATA_DIR = join(process.cwd(), "auth", "browser-data");

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

export interface ScrapedAuctionRow {
  name: string;
  // Every column the UI shows — kept as a dict so if GoDaddy adds or
  // removes columns the UI adapts without code changes here.
  fields: Record<string, string>;
}

// Keeping the original export names (ScrapedDomainRow / ScrapeResult)
// so the React component doesn't need to be touched.
export type ScrapedDomainRow = ScrapedAuctionRow & { domain: string };

export interface ScrapeResult {
  domains: ScrapedDomainRow[];
  pageInfo: {
    scrapedAt: string;
    sourceUrl: string;
    finalUrl: string;
    appliedFilters: {
      types: string[];
      timeToEnd: string[];
    };
    filterMethod: string;
    totalResultsOnPage: number;
    columns: string[];
    usedSavedSession: boolean;
    pagination: {
      pageSize: number;
      lastPage: number | null;
      estimateTotal: number | null;
      method: string;
      steps: number;
    };
  };
  elapsedMs: number;
  debug?: {
    title: string;
    screenshotPath?: string;
    htmlPath?: string;
  };
}

const VIEWPORT = { width: 1440, height: 900 };

// Which Type filters to tick. Each entry is a list of synonyms — we
// tick the first label that matches. English first, then Spanish
// fallbacks in case locale cookies didn't take hold.
//   - "Expiring" matches "Expiring Auctions" / "Subastas que expiran"
//   - "Closeout" matches "Closeouts (Buy Now)" / "Liquidación"
const TYPES_TO_SELECT: string[][] = [
  ["Expiring", "Expirando", "Por expirar", "Subastas que expiran"],
  ["Closeout", "Liquidación", "Liquidacion", "Cierre"],
];

// "Time to end" chip. Leave a field undefined to skip it. Currently
// disabled — setTimeToEnd is a no-op when every field is undefined.
// To re-enable: set hours/minutes/days to a number.
const TIME_TO_END: {
  days?: number;
  hours?: number;
  minutes?: number;
} = {};

function jitter(minMs: number, maxMs: number): Promise<void> {
  const delay = Math.floor(minMs + Math.random() * (maxMs - minMs));
  return new Promise((resolve) => setTimeout(resolve, delay));
}

async function wiggleMouse(page: Page): Promise<void> {
  const x = 200 + Math.floor(Math.random() * 800);
  const y = 200 + Math.floor(Math.random() * 400);
  await page.mouse.move(x, y, { steps: 10 + Math.floor(Math.random() * 12) });
}

async function humanClick(loc: Locator): Promise<void> {
  // Hover before clicking so the movement looks organic, then a small
  // pause, then click. Real users don't teleport-click.
  await loc.scrollIntoViewIfNeeded().catch(() => {});
  await loc.hover().catch(() => {});
  await jitter(150, 400);
  await loc.click();
}

async function firstVisible(
  page: Page,
  selectors: string[],
  perSelectorTimeoutMs = 4_000
): Promise<{ loc: Locator; selector: string } | null> {
  for (const sel of selectors) {
    const loc = page.locator(sel).first();
    try {
      await loc.waitFor({ state: "visible", timeout: perSelectorTimeoutMs });
      return { loc, selector: sel };
    } catch {
      /* try next */
    }
  }
  return null;
}

async function saveDebugArtifacts(
  page: Page,
  context: string
): Promise<{ screenshotPath: string; htmlPath: string } | null> {
  try {
    const dir = await mkdtemp(join(tmpdir(), "godaddy-auctions-"));
    const screenshotPath = join(dir, `${context}.png`);
    const htmlPath = join(dir, `${context}.html`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    const html = await page.content();
    await writeFile(htmlPath, html);
    return { screenshotPath, htmlPath };
  } catch {
    return null;
  }
}

/**
 * Click through common cookie/consent/"welcome" overlays so they don't
 * cover the real UI. Safe to call even if none are present.
 */
async function dismissOverlays(page: Page): Promise<string[]> {
  const dismissed: string[] = [];
  const candidates = [
    // OneTrust (GoDaddy uses this)
    "button#onetrust-accept-btn-handler",
    "#onetrust-accept-btn-handler",
    'button:has-text("Accept All")',
    'button:has-text("Accept all")',
    'button:has-text("Accept Cookies")',
    'button:has-text("I Accept")',
    'button:has-text("Agree")',
    // Cookiebot
    "#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll",
    // GoDaddy welcome / region chooser
    'button:has-text("Continue")',
    'button:has-text("Got it")',
    'button:has-text("Dismiss")',
    // Generic close buttons on modals
    '[aria-label="Close"]',
    'button[aria-label="close" i]',
  ];
  for (const sel of candidates) {
    const loc = page.locator(sel).first();
    try {
      if (await loc.isVisible({ timeout: 500 }).catch(() => false)) {
        await loc.click({ timeout: 2_000 });
        dismissed.push(sel);
        await jitter(300, 700);
      }
    } catch {
      /* ignore */
    }
  }
  return dismissed;
}

/**
 * Detect bot-check / challenge pages so we surface a clear error
 * instead of "couldn't find X".
 */
async function detectBotGate(page: Page): Promise<string | null> {
  const title = (await page.title().catch(() => "")) ?? "";
  const body = (await page.textContent("body").catch(() => "")) ?? "";
  if (/perimeterx|px-captcha|access denied|are you a human|verify you are human|pardon our interruption|edgesuite\.net/i.test(body)) {
    return (
      `Bot challenge detected (title: "${title}"). ` +
      `GoDaddy is fronted by Akamai Bot Manager. Run ` +
      `\`npm run capture-login\` and spend 60–90 seconds clicking ` +
      `around the auctions page (scroll, open a listing, come back) ` +
      `before pressing Enter. Akamai's _abck sensor cookie only ` +
      `matures after real interaction; the profile at auth/browser-data/ ` +
      `carries that clearance into every subsequent headless run. If ` +
      `it keeps failing, delete auth/browser-data/ and try again.`
    );
  }
  if (/just a moment|checking your browser/i.test(title + body)) {
    return `Cloudflare-style challenge detected (title: "${title}").`;
  }
  return null;
}

/**
 * Wait until the page is actually interactive for our purposes — we
 * can see either the Type chip (panel already open) or Advanced Search
 * text. Better than networkidle alone, which GoDaddy's analytics
 * beacons defeat.
 */
async function waitForSearchUi(page: Page, timeoutMs: number): Promise<void> {
  await page
    .waitForFunction(
      () => {
        const body = document.body?.innerText || "";
        return (
          /Advanced Search/i.test(body) ||
          /Type\b/.test(body) ||
          // Spanish fallbacks.
          /B[úu]squeda avanzada/i.test(body) ||
          /\bTipo\b/.test(body)
        );
      },
      { timeout: timeoutMs }
    )
    .catch(() => {});
  // Let whatever just rendered settle.
  await new Promise((r) => setTimeout(r, 500));
}

/**
 * Returns true when the Advanced Search panel is on screen. Checks a
 * bundle of signals (Apply Filters button, the filter chips row,
 * "Clear Filters" text) rather than a single literal match, so profile
 * variations and locale drift don't make us misread the state.
 *
 * CRITICAL: this is used as a short-circuit in openAdvancedSearch. If
 * this ever returns false when the panel is actually open, we'll click
 * the Advanced Search toggle to "open" it and instead close it — the
 * user's screenshot caught us doing exactly that. Be generous here.
 */
async function isPanelOpen(page: Page): Promise<boolean> {
  const panelSignals = [
    // The Apply / Clear Filters buttons at the bottom of the panel
    // only exist when the panel is expanded.
    'button:has-text("Apply Filters")',
    'button:has-text("Aplicar filtros")',
    'text=/Clear Filters/i',
    'text=/Borrar filtros/i',
    // Filter chips that only live inside the panel.
    'button:has-text("Keywords")',
    'button:has-text("Palabras clave")',
    'button:has-text("Time to end")',
    'button:has-text("Tiempo restante")',
    'button:has-text("Top Picks")',
    // Type chip — various shapes.
    'button:has-text("Type")',
    'button:has-text("Tipo")',
    '[role="button"]:has-text("Type")',
    '[role="button"]:has-text("Tipo")',
  ];
  for (const sel of panelSignals) {
    if (
      await page
        .locator(sel)
        .first()
        .isVisible({ timeout: 300 })
        .catch(() => false)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Locator for the Type filter chip — the thing you click to drop down
 * the checkbox list. Matches button / role=button / div variants in
 * English and Spanish. `.first()` at the call site.
 */
function typeChipLocator(page: Page): Locator {
  return page
    .locator(
      [
        'button:has-text("Type")',
        'button:has-text("Tipo")',
        '[role="button"]:has-text("Type")',
        '[role="button"]:has-text("Tipo")',
      ].join(", ")
    )
    .first();
}

/**
 * Open the Advanced Search panel.
 *
 * On the /beta UI, "Advanced Search" can be a button, an anchor, or a
 * non-semantic div/span. We detect it by text on ANY element, and we
 * short-circuit via isPanelOpen() so we never toggle an already-open
 * panel closed.
 */
async function openAdvancedSearch(page: Page): Promise<boolean> {
  // Panel already open? Don't touch it.
  if (await isPanelOpen(page)) {
    return true;
  }

  const candidates = [
    // Semantic first in case they upgrade the markup later.
    'button:has-text("Advanced Search")',
    'a:has-text("Advanced Search")',
    '[role="button"]:has-text("Advanced Search")',
    // Non-semantic — the actual /beta markup. Match any clickable
    // container with that text.
    'div:has-text("Advanced Search"):not(:has(div:has-text("Advanced Search")))',
    'span:has-text("Advanced Search")',
    // Last resort: Playwright's text engine.
    "text=Advanced Search",
    // Spanish fallbacks — profile may be serving localized content.
    'button:has-text("Búsqueda avanzada")',
    'a:has-text("Búsqueda avanzada")',
    '[role="button"]:has-text("Búsqueda avanzada")',
    'span:has-text("Búsqueda avanzada")',
    "text=Búsqueda avanzada",
    "text=Busqueda avanzada",
  ];

  for (const sel of candidates) {
    const loc = page.locator(sel).first();
    try {
      await loc.waitFor({ state: "visible", timeout: 2_500 });
      await humanClick(loc);
      await jitter(500, 1000);
      if (await isPanelOpen(page)) {
        return true;
      }
      // If we clicked but the panel didn't open, we may have just
      // toggled something unrelated. Don't keep hammering — move on
      // to the next selector.
    } catch {
      /* try next */
    }
  }

  // Last chance.
  return await isPanelOpen(page);
}

/**
 * Tick the Type checkboxes. The flow on /beta is:
 *   1. Click the "Type" filter chip → dropdown opens with checkboxes.
 *   2. Click each label we want. GoDaddy wires the click to the label
 *      itself, not the hidden real checkbox.
 *   3. Close the dropdown (clicking elsewhere or the chip again) so
 *      it doesn't intercept the Apply Filters click.
 */
async function selectTypes(
  page: Page,
  labelGroups: string[][]
): Promise<string[]> {
  const applied: string[] = [];

  const typeChip = typeChipLocator(page);
  await typeChip.waitFor({ state: "visible", timeout: 10_000 });

  // Is the Type dropdown already expanded? (e.g. from persistent
  // profile state — the user's screenshot showed exactly this.) If
  // Expiring / Closeout checkboxes are already on screen, don't click
  // the chip — that would collapse it.
  const dropdownAlreadyOpen = await page
    .locator(
      [
        "text=/Expiring Auctions/i",
        "text=/Closeouts/i",
        "text=/Public Buy Now/i",
        "text=/Subastas que expira/i",
      ].join(", ")
    )
    .first()
    .isVisible({ timeout: 500 })
    .catch(() => false);

  if (!dropdownAlreadyOpen) {
    await humanClick(typeChip);
    await jitter(500, 1000);
  }

  // Wait for at least one recognizable checkbox label to render.
  await page
    .waitForSelector(
      [
        'label:has-text("Expiring")',
        "text=/Expiring Auctions/i",
        'label:has-text("Expirando")',
        "text=/Subastas\\s+.*expira/i",
      ].join(", "),
      { timeout: 8_000 }
    )
    .catch(() => {});

  for (const synonyms of labelGroups) {
    let toggled = false;
    // Try each synonym in turn. First match wins.
    outer: for (const label of synonyms) {
      const labelCandidates = [
        `label:has-text("${label}")`,
        `label:text-matches("${label}", "i")`,
        `text=/${label}/i`,
      ];
      for (const sel of labelCandidates) {
        const loc = page.locator(sel).first();
        try {
          await loc.waitFor({ state: "visible", timeout: 1_500 });
          // If there's a visible checkbox INSIDE the label element
          // and it's already checked, leave it alone.
          const innerCheckbox = loc.locator('input[type="checkbox"]').first();
          const alreadyChecked = await innerCheckbox
            .isChecked({ timeout: 500 })
            .catch(() => false);
          // Also check "visually checked" via aria-checked or a
          // checked sibling icon — GoDaddy's custom checkbox
          // component doesn't always have a real <input> sibling.
          const visuallyChecked = await loc
            .evaluate((el) => {
              const root = el as HTMLElement;
              // aria-checked on self or ancestors
              let cur: HTMLElement | null = root;
              while (cur) {
                if (cur.getAttribute("aria-checked") === "true") return true;
                cur = cur.parentElement;
              }
              // "checked"-style class on a sibling svg / span
              const siblings = root.parentElement?.querySelectorAll("*") ?? [];
              for (const s of Array.from(siblings)) {
                const cls = (s as HTMLElement).className || "";
                if (typeof cls === "string" && /checked|selected/i.test(cls)) {
                  return true;
                }
              }
              return false;
            })
            .catch(() => false);
          if (alreadyChecked || visuallyChecked) {
            applied.push(label);
            toggled = true;
            break outer;
          }
          await humanClick(loc);
          applied.push(label);
          toggled = true;
          break outer;
        } catch {
          /* try next */
        }
      }
    }
    await jitter(300, 700);
    if (!toggled) {
      continue;
    }
  }

  // Close the Type dropdown so it doesn't overlap Apply Filters. Only
  // click the chip if it's actually still open — avoid re-toggling it
  // back open if something else already closed it.
  const dropdownStillOpen = await page
    .locator("text=/Expiring Auctions/i")
    .first()
    .isVisible({ timeout: 500 })
    .catch(() => false);
  if (dropdownStillOpen) {
    await humanClick(typeChip).catch(() => {});
    await jitter(300, 700);
  }

  return applied;
}

/**
 * Open the "Time to end" dropdown chip and fill in the numeric inputs
 * ("Minutes to end", "Hours to end", "Days to end"). Returns the list
 * of key=value pairs actually written.
 *
 * Layout: each field is a label ("Hours to end") above a text input.
 * We find the input via page.getByLabel-style relative XPath since
 * the <input>s aren't wrapped in <label for="...">.
 */
async function setTimeToEnd(
  page: Page,
  config: { minutes?: number; hours?: number; days?: number }
): Promise<string[]> {
  const applied: string[] = [];

  // Nothing to do?
  const hasAnyValue =
    config.minutes !== undefined ||
    config.hours !== undefined ||
    config.days !== undefined;
  if (!hasAnyValue) return applied;

  const chip = page
    .locator(
      [
        'button:has-text("Time to end")',
        'button:has-text("Tiempo restante")',
        'button:has-text("Tiempo")',
        '[role="button"]:has-text("Time to end")',
      ].join(", ")
    )
    .first();

  try {
    await chip.waitFor({ state: "visible", timeout: 6_000 });
  } catch {
    return applied;
  }

  // Already expanded? Skip the click so we don't collapse it.
  const alreadyOpen = await page
    .locator(
      [
        "text=/Hours to end/i",
        "text=/Days to end/i",
        "text=/Horas/i",
      ].join(", ")
    )
    .first()
    .isVisible({ timeout: 500 })
    .catch(() => false);

  if (!alreadyOpen) {
    await humanClick(chip);
    await jitter(500, 1000);
  }

  // Wait for the inputs to render.
  await page
    .waitForSelector(
      [
        "text=/Hours to end/i",
        "text=/Days to end/i",
        "text=/Horas/i",
      ].join(", "),
      { timeout: 6_000 }
    )
    .catch(() => {});

  const fieldSpecs: Array<{
    key: "minutes" | "hours" | "days";
    labels: string[];
  }> = [
    { key: "minutes", labels: ["Minutes to end", "Minutos"] },
    { key: "hours", labels: ["Hours to end", "Horas"] },
    { key: "days", labels: ["Days to end", "Días", "Dias"] },
  ];

  for (const { key, labels } of fieldSpecs) {
    const value = config[key];
    if (value === undefined) continue;

    // Locate the input by "label text → first following input". Works
    // even if the input isn't associated via a for/id pair.
    let input: Locator | null = null;
    for (const label of labels) {
      // Escape quotes in label just in case.
      const safe = label.replace(/"/g, '\\"');
      const candidate = page
        .locator(
          `xpath=(//*[normalize-space(text())="${safe}"]/following::input)[1]`
        )
        .first();
      if (
        await candidate.isVisible({ timeout: 800 }).catch(() => false)
      ) {
        input = candidate;
        break;
      }
      // Fallback: label text might be inside a nested span.
      const candidate2 = page
        .locator(
          `xpath=(//*[contains(normalize-space(.), "${safe}")]/following::input)[1]`
        )
        .first();
      if (
        await candidate2.isVisible({ timeout: 400 }).catch(() => false)
      ) {
        input = candidate2;
        break;
      }
    }

    if (!input) continue;

    // Focus, clear (React-controlled inputs can resist .fill('')),
    // then type like a human.
    await humanClick(input);
    await jitter(100, 250);
    await input.click({ clickCount: 3 }).catch(() => {}); // select-all
    await page.keyboard.press("Backspace").catch(() => {});
    await jitter(80, 180);
    await input.type(String(value), {
      delay: 70 + Math.floor(Math.random() * 100),
    });
    applied.push(`${key}=${value}`);
    await jitter(250, 500);
  }

  // Close the dropdown so it doesn't overlap Apply Filters. Click
  // somewhere harmless; the chip itself would toggle it open again.
  await page.mouse.click(10, 10).catch(() => {});
  await jitter(300, 600);

  return applied;
}

/**
 * Click the Apply Filters button.
 */
async function applyFilters(page: Page): Promise<string> {
  const candidates = [
    'button:has-text("Apply Filters")',
    'button:has-text("Apply filter")',
    'button:has-text("Apply")',
    'button:has-text("Search"):not(:has-text("Advanced"))',
    // Spanish fallbacks.
    'button:has-text("Aplicar filtros")',
    'button:has-text("Aplicar")',
    'button:has-text("Buscar"):not(:has-text("avanzada"))',
    'button[type="submit"]',
  ];
  const found = await firstVisible(page, candidates, 4_000);
  if (!found) {
    return "no-apply-button-found";
  }
  await humanClick(found.loc);
  await jitter(800, 1600);
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  return `clicked: ${found.selector}`;
}

/**
 * Snapshot the pagination bar: every numeric page button visible,
 * which one is current, and the selected page-size.
 *
 * The /beta UI renders pagination as something like:
 *     <  1 2 3 4 … >   [150 ∨]
 * where the numbers are buttons with numeric textContent. We don't
 * know the exact wrapping element, so we grab every visible button
 * near the bottom of the page and filter to ones whose text is just a
 * number or "…".
 */
async function snapshotPagination(page: Page): Promise<{
  numbers: number[];
  current: number | null;
  hasEllipsis: boolean;
  pageSize: number | null;
}> {
  return await page.evaluate(() => {
    const buttons = Array.from(
      document.querySelectorAll<HTMLElement>(
        'button, a[role="button"], [role="button"]'
      )
    );
    const candidates = buttons.filter((b) => {
      if (!(b instanceof HTMLElement)) return false;
      if (b.offsetParent === null) return false; // not visible
      const txt = (b.textContent || "").trim();
      if (!txt) return false;
      return /^\d+$/.test(txt) || txt === "…" || txt === "...";
    });
    const numbers: number[] = [];
    let current: number | null = null;
    let hasEllipsis = false;
    for (const b of candidates) {
      const txt = (b.textContent || "").trim();
      if (txt === "…" || txt === "...") {
        hasEllipsis = true;
        continue;
      }
      const n = parseInt(txt, 10);
      if (isNaN(n)) continue;
      numbers.push(n);
      // Several UI libs mark the current page via aria-current,
      // aria-selected, or a distinct class.
      const isCurrent =
        b.getAttribute("aria-current") === "page" ||
        b.getAttribute("aria-current") === "true" ||
        b.getAttribute("aria-selected") === "true" ||
        /active|current|selected/i.test(b.className);
      if (isCurrent) current = n;
    }
    numbers.sort((a, b) => a - b);

    // Try to read the page-size selector. It's often a <select> near
    // the pagination, or a button showing "150 ∨".
    let pageSize: number | null = null;
    const selects = Array.from(document.querySelectorAll("select"));
    for (const s of selects) {
      const v = parseInt(s.value || "", 10);
      if (!isNaN(v) && v >= 10 && v <= 500) {
        pageSize = v;
        break;
      }
    }
    if (pageSize === null) {
      // Look for a standalone button whose text is just a number
      // like 25, 50, 100, 150, 200.
      for (const b of buttons) {
        if (!(b instanceof HTMLElement)) continue;
        if (b.offsetParent === null) continue;
        const txt = (b.textContent || "").trim();
        if (/^(25|50|100|150|200|300)$/.test(txt)) {
          pageSize = parseInt(txt, 10);
          break;
        }
      }
    }
    return { numbers, current, hasEllipsis, pageSize };
  });
}

/**
 * Walk the pagination bar to find the highest reachable page number.
 *
 * Strategy: take a snapshot. Find the highest numeric page button.
 * If it's greater than our current max, click it and snapshot again.
 * Repeat until the highest number stops growing (meaning we've hit
 * the actual last page). Bounded iterations to avoid runaway loops.
 *
 * This is O(log N) clicks for typical pagination components that
 * show 3–5 page numbers at a time with "…" to elide the middle: the
 * rightmost-visible number roughly doubles each click.
 */
async function estimateLastPage(
  page: Page,
  maxSteps = 25
): Promise<{
  lastPage: number | null;
  pageSize: number | null;
  method: string;
  steps: number;
}> {
  let highestSeen = 0;
  let pageSize: number | null = null;
  let steps = 0;

  for (let i = 0; i < maxSteps; i++) {
    steps = i + 1;
    const snap = await snapshotPagination(page);
    if (snap.pageSize !== null) pageSize = snap.pageSize;

    if (snap.numbers.length === 0) {
      // No pagination visible — either single page of results or we
      // haven't rendered yet.
      return {
        lastPage: null,
        pageSize,
        method: "no-pagination-found",
        steps,
      };
    }

    const maxVisible = snap.numbers[snap.numbers.length - 1];
    if (maxVisible <= highestSeen && !snap.hasEllipsis) {
      // Highest visible number didn't grow and there's no "…" hiding
      // pages. We've reached the end.
      return {
        lastPage: maxVisible,
        pageSize,
        method: "converged",
        steps,
      };
    }
    highestSeen = Math.max(highestSeen, maxVisible);

    // Don't click if we're already ON the highest page.
    if (snap.current !== null && snap.current === maxVisible) {
      if (!snap.hasEllipsis) {
        return {
          lastPage: maxVisible,
          pageSize,
          method: "current-is-max",
          steps,
        };
      }
      // Current is max AND there's an ellipsis → there are more pages
      // past the visible range. Click the ellipsis.
      const ellipsis = page
        .locator('button:has-text("…"), button:has-text("...")')
        .first();
      try {
        await ellipsis.waitFor({ state: "visible", timeout: 1_500 });
        await humanClick(ellipsis);
      } catch {
        return {
          lastPage: maxVisible,
          pageSize,
          method: "ellipsis-unclickable",
          steps,
        };
      }
    } else {
      // Click the highest visible page-number button.
      const target = page
        .locator(
          `button:text-is("${maxVisible}"), a[role="button"]:text-is("${maxVisible}"), [role="button"]:text-is("${maxVisible}")`
        )
        .first();
      try {
        await target.waitFor({ state: "visible", timeout: 2_000 });
        await humanClick(target);
      } catch {
        return {
          lastPage: maxVisible,
          pageSize,
          method: "button-unclickable",
          steps,
        };
      }
    }

    // Let the page settle. Jitter a bit so we don't hammer.
    await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});
    await jitter(600, 1100);
  }

  return {
    lastPage: highestSeen || null,
    pageSize,
    method: "max-steps-reached",
    steps,
  };
}

async function scrapeResults(page: Page): Promise<{
  rows: ScrapedDomainRow[];
  columns: string[];
}> {
  return await page.evaluate(() => {
    const DOMAIN_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z]{2,})+$/i;

    const tables = Array.from(document.querySelectorAll("table"));
    // Pick the table with the most rows containing a domain-looking
    // token — that's the auctions list.
    let bestTable: HTMLTableElement | null = null;
    let bestScore = 0;
    for (const t of tables) {
      const bodyRows = Array.from(t.querySelectorAll("tbody tr"));
      if (bodyRows.length === 0) continue;
      const score = bodyRows.filter((r) =>
        Array.from(r.querySelectorAll("td, th")).some((c) => {
          const txt = (c.textContent || "").trim().split(/\s+/)[0] || "";
          return DOMAIN_RE.test(txt);
        })
      ).length;
      if (score > bestScore) {
        bestScore = score;
        bestTable = t as HTMLTableElement;
      }
    }

    if (!bestTable || bestScore === 0) {
      return { rows: [], columns: [] };
    }

    const headerCells = Array.from(bestTable.querySelectorAll("thead th"));
    const columnsRaw = headerCells.map((th) => (th.textContent || "").trim());
    // Drop empty leading columns (checkbox / star icon / etc.).
    const columns = columnsRaw.map((c, i) => c || `col_${i}`);

    const rows: ScrapedDomainRow[] = [];
    const bodyRows = Array.from(bestTable.querySelectorAll("tbody tr"));
    for (const row of bodyRows) {
      const cells = Array.from(row.querySelectorAll("td")).map((td) => {
        // Some cells have nested links/images. Prefer a visible link's
        // textContent if present; otherwise the cell's own text.
        const a = td.querySelector("a");
        const txt = ((a ? a.textContent : td.textContent) || "").trim();
        return txt.replace(/\s+/g, " ");
      });
      if (cells.length === 0) continue;
      const fields: Record<string, string> = {};
      for (let i = 0; i < cells.length; i++) {
        const key = columns[i] || `col_${i}`;
        fields[key] = cells[i];
      }
      // Find the column we think holds the domain.
      const nameIdx = columns.findIndex((c) =>
        /^(name|domain)$/i.test(c)
      );
      const pickedName =
        (nameIdx >= 0 ? cells[nameIdx] : "") ||
        cells.find((c) => DOMAIN_RE.test((c.split(/\s+/)[0] || ""))) ||
        "";
      if (!pickedName) continue;
      const domain = (pickedName.split(/\s+/)[0] || pickedName).trim();
      rows.push({
        name: pickedName,
        domain,
        fields,
      });
    }

    return { rows, columns };
  });
}

export async function scrapeExpiredDomains(options: {
  username?: string;
  password?: string;
  headless?: boolean;
  timeoutMs?: number;
}): Promise<ScrapeResult> {
  // Default is *visible* Chrome. Akamai Bot Manager flags headless
  // Chromium aggressively through signals that stealth can't fully
  // mask (TLS timing, sensor-script runtime, CDP globals). Running
  // visible removes that whole class of detection — real TLS, real
  // window dims, real rendering. Set EXPIRED_DOMAINS_HEADLESS=true
  // (or pass options.headless) to opt into headless if you're
  // automating this somewhere without a display.
  const envHeadless = process.env.EXPIRED_DOMAINS_HEADLESS;
  const headless =
    options.headless ??
    (envHeadless === undefined ? false : envHeadless === "true");
  const timeoutMs = options.timeoutMs ?? 60_000;
  const startedAt = Date.now();

  let ctx: BrowserContext | null = null;
  let debugInfo: ScrapeResult["debug"] = undefined;

  try {
    // Make sure the profile directory exists; launchPersistentContext
    // will create it on first use but we want parent dirs in place too.
    await mkdir(USER_DATA_DIR, { recursive: true });
    const hasSavedState = await fileExists(join(USER_DATA_DIR, "Default"));

    // Drive the *real* Chrome the user has installed — not bundled
    // Chromium. Chromium has a distinct TLS fingerprint (JA3/JA4) that
    // Akamai Bot Manager flags immediately; Chrome's is clean. We also
    // leave the userAgent *unset* so the channel's real UA passes
    // through; overriding it creates a mismatch with sec-ch-ua hints
    // that bot managers look for explicitly.
    //
    // Requires Chrome to be installed on the host (which is the normal
    // case on a developer's Mac). If it isn't, Playwright throws a
    // clear "Chrome executable not found" error at launch.
    ctx = await chromium.launchPersistentContext(USER_DATA_DIR, {
      headless,
      channel: "chrome",
      viewport: VIEWPORT,
      locale: "en-US",
      timezoneId: "America/New_York",
      extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9" },
      args: [
        "--disable-blink-features=AutomationControlled",
        "--no-sandbox",
        "--disable-dev-shm-usage",
      ],
    });
    await ctx.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });

    // Force English content even if the persistent profile picked up a
    // Spanish / other locale during capture-login (GoDaddy sets market
    // cookies when you click through certain flows). Without this, the
    // Advanced Search button becomes "Búsqueda avanzada" and our
    // selectors miss. Setting multiple candidate names because GoDaddy
    // has renamed this cookie over time.
    await ctx.addCookies([
      { name: "market", value: "en-US", domain: ".godaddy.com", path: "/" },
      { name: "market_id", value: "en-US", domain: ".godaddy.com", path: "/" },
      { name: "locale", value: "en-US", domain: ".godaddy.com", path: "/" },
      { name: "mcc", value: "en-US", domain: ".godaddy.com", path: "/" },
    ]);

    // launchPersistentContext opens with one blank page already; prefer
    // that over newPage() so we don't end up with two tabs.
    const page = ctx.pages()[0] ?? (await ctx.newPage());
    page.setDefaultTimeout(timeoutMs);
    page.setDefaultNavigationTimeout(timeoutMs);

    // ── Load auctions ──
    await page.goto(AUCTIONS_URL, { waitUntil: "domcontentloaded" });
    await jitter(1200, 2200);
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
    await wiggleMouse(page);

    // Bot gate? (PerimeterX, Cloudflare, etc.) — bail loudly.
    const botGate = await detectBotGate(page);
    if (botGate) {
      const artifacts = await saveDebugArtifacts(page, "bot-gate");
      throw new Error(
        `${botGate}\nScreenshot: ${artifacts?.screenshotPath ?? "n/a"}, HTML: ${artifacts?.htmlPath ?? "n/a"}`
      );
    }

    // If the persistent profile left a modal / dropdown open (e.g.
    // user clicked into a domain listing during capture-login), tap
    // Escape to dismiss. Cheap, idempotent, no-op if nothing's open.
    await page.keyboard.press("Escape").catch(() => {});
    await jitter(200, 500);
    await page.keyboard.press("Escape").catch(() => {});
    await jitter(200, 500);

    // Dismiss cookie banners / modals before they cover Advanced Search.
    const dismissed = await dismissOverlays(page);
    if (dismissed.length > 0) {
      await jitter(400, 900);
      await wiggleMouse(page);
    }

    // Click on an empty area (top-left corner, out of the way of any
    // real UI) to close hover-activated nav dropdowns. The body text
    // we saw in the last failure was the Domains hover menu — the
    // mouse must have been on it from a previous interaction.
    await page.mouse.click(10, 10).catch(() => {});
    await jitter(200, 500);

    // Scroll a bit — some SPAs lazy-mount sections on viewport entry.
    await page.evaluate(() => window.scrollBy(0, 200));
    await jitter(300, 700);
    await page.evaluate(() => window.scrollTo(0, 0));
    await jitter(300, 700);

    // Wait until the search UI text is actually on screen.
    await waitForSearchUi(page, 15_000);

    // ── Open Advanced Search ──
    const opened = await openAdvancedSearch(page);
    if (!opened) {
      const artifacts = await saveDebugArtifacts(page, "no-advanced-search");
      // Sniff the body to give better hints in the error message.
      const bodySnippet = (
        (await page.textContent("body").catch(() => "")) ?? ""
      )
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 400);
      debugInfo = {
        title: await page.title().catch(() => ""),
        screenshotPath: artifacts?.screenshotPath,
        htmlPath: artifacts?.htmlPath,
      };
      throw new Error(
        `Couldn't find the "Advanced Search" toggle.\n` +
          `Dismissed overlays: ${dismissed.length ? dismissed.join(", ") : "none"}\n` +
          `Page title: "${debugInfo.title}"\n` +
          `Body (first 400 chars): "${bodySnippet}"\n` +
          `Screenshot: ${artifacts?.screenshotPath ?? "n/a"}, HTML: ${artifacts?.htmlPath ?? "n/a"}`
      );
    }

    // ── Tick Type = Expiring + Closeouts ──
    const appliedTypes = await selectTypes(page, TYPES_TO_SELECT);
    if (appliedTypes.length === 0) {
      const artifacts = await saveDebugArtifacts(page, "no-type-checkboxes");
      debugInfo = {
        title: await page.title().catch(() => ""),
        screenshotPath: artifacts?.screenshotPath,
        htmlPath: artifacts?.htmlPath,
      };
      throw new Error(
        `Advanced Search opened but couldn't find Type checkboxes for ${TYPES_TO_SELECT.join(" / ")}. Screenshot: ${artifacts?.screenshotPath ?? "n/a"}, HTML: ${artifacts?.htmlPath ?? "n/a"}`
      );
    }

    await wiggleMouse(page);
    await jitter(400, 900);

    // ── Time to end (Hours to end = 12, etc.) ──
    const appliedTime = await setTimeToEnd(page, TIME_TO_END);
    await jitter(300, 700);

    // ── Apply and wait for the results table ──
    const filterMethod = await applyFilters(page);

    // Give the SPA a beat to render rows. Wait until we either see at
    // least one tbody tr that looks like a domain row, or we hit
    // timeout.
    await page
      .waitForFunction(
        () => {
          const tables = Array.from(document.querySelectorAll("table"));
          for (const t of tables) {
            const rows = t.querySelectorAll("tbody tr");
            if (rows.length > 0) {
              for (const r of Array.from(rows)) {
                if (/\b[a-z0-9][a-z0-9-]*\.[a-z]{2,}\b/i.test(r.textContent || "")) {
                  return true;
                }
              }
            }
          }
          return false;
        },
        { timeout: 20_000 }
      )
      .catch(() => {});
    await jitter(500, 1100);

    // ── Scrape ──
    const scraped = await scrapeResults(page);

    if (scraped.rows.length === 0) {
      const artifacts = await saveDebugArtifacts(page, "no-rows");
      debugInfo = {
        title: await page.title().catch(() => ""),
        screenshotPath: artifacts?.screenshotPath,
        htmlPath: artifacts?.htmlPath,
      };
      throw new Error(
        `No auction rows found after applying filters (types=${appliedTypes.join(",")}, filterMethod=${filterMethod}). Screenshot: ${artifacts?.screenshotPath ?? "n/a"}, HTML: ${artifacts?.htmlPath ?? "n/a"}`
      );
    }

    // ── Walk the pagination bar to estimate total record count ──
    // The /beta UI shows pages like "1 2 3 4 … >" with a "150" page size
    // selector. We click the highest visible number, let the page load,
    // snapshot again, repeat until the highest number stops growing.
    // O(log N) clicks because the rightmost-visible number roughly
    // doubles each time ellipsis elides the middle.
    const pagination = await estimateLastPage(page).catch((err) => ({
      lastPage: null,
      pageSize: null,
      method: `error: ${err instanceof Error ? err.message : String(err)}`,
      steps: 0,
    }));
    const effectivePageSize = pagination.pageSize ?? 150;
    const estimateTotal =
      pagination.lastPage !== null
        ? pagination.lastPage * effectivePageSize
        : null;

    const title = await page.title().catch(() => "");

    return {
      domains: scraped.rows,
      pageInfo: {
        scrapedAt: new Date().toISOString(),
        sourceUrl: AUCTIONS_URL,
        finalUrl: page.url(),
        appliedFilters: { types: appliedTypes, timeToEnd: appliedTime },
        filterMethod,
        totalResultsOnPage: scraped.rows.length,
        columns: scraped.columns,
        usedSavedSession: hasSavedState,
        pagination: {
          pageSize: effectivePageSize,
          lastPage: pagination.lastPage,
          estimateTotal,
          method: pagination.method,
          steps: pagination.steps,
        },
      },
      elapsedMs: Date.now() - startedAt,
      debug: { title },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const wrapped = new Error(
      debugInfo
        ? `${message}\n— screenshot: ${debugInfo.screenshotPath ?? "n/a"}\n— html: ${debugInfo.htmlPath ?? "n/a"}`
        : message
    );
    throw wrapped;
  } finally {
    if (ctx) {
      // Closing the persistent context flushes profile state back to
      // disk. Don't kill it any other way.
      await ctx.close().catch(() => {});
    }
  }
}

/*
 * Escalation order if this fails:
 *
 *   1. PerimeterX "Access Denied" → run `npm run capture-login`. Solve
 *      any challenge in the real browser that pops open, close it,
 *      then click Start scrape again. The auth/browser-data/ profile
 *      carries the PX clearance over to the headless run.
 *
 *   2. Open the saved HTML dump from the /tmp/godaddy-auctions-XXX
 *      directory. That's the exact DOM the scraper saw. Drop the
 *      relevant Advanced Search / checkbox snippets in here and I can
 *      lock in selectors.
 *
 *   3. To watch it run live: EXPIRED_DOMAINS_HEADLESS=false npm run dev.
 *
 *   4. If the filter UI changes to use native <select> elements, swap
 *      the checkbox loop in selectTypes() for a selectOption() call.
 *
 *   5. If the profile gets "poisoned" (PX starts blocking it), delete
 *      the auth/browser-data/ directory and re-run capture-login. The
 *      directory is git-ignored under /auth.
 */
