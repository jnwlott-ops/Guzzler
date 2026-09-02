# Guzzler

Find cheap gas and avoid getting gouged. A map of nearby fuel prices that tells
you not just what a station charges, but whether that price is fair for where
you are — the thing a traveler passing through can't know on their own.

> **Status: scaffold.** The UI is real; the prices are not. Guzzler currently
> runs on `MockPriceFeed`, which generates plausible stations around the visible
> map. See [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md) for provider options and
> how to swap one in.

## What's here

- **Price-first map pins.** The price is on the pin, not behind a tap, and pin
  color classifies it against the local median (green below / amber near / red
  above). The cheapest station in view gets a star.
- **Median, not mean.** One $6.00 highway-exit gouger shouldn't drag the
  "normal" price up and make itself look reasonable.
- **Per-tank savings.** "Save about $4.20 on a 14-gallon fill-up" beats a bare
  price delta.
- **Freshness as a trust signal.** Every quote carries a timestamp and a source,
  surfaced as "12m ago · driver report".
- **Crowdsourced reports.** One-field price entry, overlaid on feed prices.
- **One seam for data.** `PriceFeed` in `src/data/priceFeed.ts` is the only
  place the app touches a provider.

## Running it

```bash
npm install
npm start
```

Then open in Expo Go, or `npm run ios` / `npm run android`.

Maps need Google Maps API keys before they'll render on a real build — replace
the `REPLACE_WITH_*` placeholders in `app.json`. The Expo Go client has its own
keys, so the map works there without setup.

```bash
npm run typecheck
```

## Layout

```
src/
  types.ts              Domain types (Station, PriceQuote, FuelGrade)
  theme.ts              Colors, spacing, verdict → color/label
  data/
    priceFeed.ts        The PriceFeed interface + the active provider
    mockPriceFeed.ts    Deterministic generated stations for development
  lib/pricing.ts        Median, verdicts, savings, formatting
  hooks/
    useUserLocation.ts  Foreground location, with denial as a normal path
    useStations.ts      Debounced region → stations, with abort on pan
  components/           Map pin, grade selector, station sheet, report modal
  screens/MapScreen.tsx Composition root
```

## Next

- Pick a data provider and write a real `PriceFeed` (see the docs above).
- Route planning: cheapest stations along a trip, not just near a point.
- Marker clustering — pins collide at metro zoom levels.
- Report trust: rate-limiting, outlier rejection, per-user reputation.
