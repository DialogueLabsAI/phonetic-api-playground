# Phonetic — API Playground

A Next.js 14 (App Router) playground for monitoring marketplace API access
for the Expired Domains MVP. Based on **Data Layer Proposal v5**, Sections
3 (Marketplace Access), 4.4 (Tagging Strategy), and 6 (Skills Inventory).

## Scope of this build

- **Marketplace sources only** — DomCop, SpamZilla, ExpiredDomains.net,
  DNSChkr, plus the Access-TBD marketplaces (GoDaddy, Afternic, Sedo,
  NameJet, SnapNames, DropCatch).
- **Expired channel**, Traffic & Authority domain types.
- **No API calls wired yet.** Every endpoint is a stub — the "Run"
  buttons are intentionally disabled. This app is the shell the real
  skill layer will drop into.
- **Tagging strategy panel** — the three-stage MVP rule set from
  Section 4.4, with editable thresholds (DR, TF, referring domains,
  traffic, Wayback snapshots).
- **API log monitor panel** — empty state, ready to receive structured
  logs once the first skill goes live.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Structure

```
app/
  layout.tsx           Root layout + global styles
  page.tsx             Playground home — cards, tagging, log panel
components/
  access-status-badge.tsx
  marketplace-card.tsx
  api-log-panel.tsx
  tagging-strategy-panel.tsx
  ui/                  shadcn-style primitives (button, card, badge, input)
data/
  marketplaces.ts      Source definitions — copy pulled from Section 6
lib/
  types.ts             MarketplaceSource, EndpointStub, ApiCallLog, TaggingThresholds
  utils.ts             cn() classname helper
```

## Next steps (out of scope for this commit)

1. Wire the first Tier-1 skill (DomCop inventory).
2. Implement the cache layer + timestamped responses.
3. Point log panel at a real events stream.
4. Verify Access-TBD marketplaces in Step 1 and flip their status.
