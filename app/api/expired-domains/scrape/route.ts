import { NextResponse } from "next/server";
import { scrapeExpiredDomains } from "@/lib/scrapers/expired-domains";

// Playwright needs a full Node runtime (not edge) and plenty of time.
export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

export async function POST() {
  // GoDaddy Auctions is browseable anonymously. Credentials are only
  // used if the user wants to log in programmatically — the scraper
  // otherwise relies on a persistent browser profile at
  // auth/browser-data/ (warmed up via `npm run capture-login`) to carry
  // any PerimeterX clearance across runs.
  const username = process.env.EXPIRED_DOMAINS_USER;
  const password = process.env.EXPIRED_DOMAINS_PASS;

  try {
    // Don't force headless here — the scraper defaults to a visible
    // Chrome window because Akamai Bot Manager blocks headless on
    // sight. Since `npm run dev` runs on the user's Mac, the window
    // pops up on their own display for the duration of the scrape.
    // Override with EXPIRED_DOMAINS_HEADLESS=true if you deploy this
    // somewhere that can't pop a window.
    const result = await scrapeExpiredDomains({
      username,
      password,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
