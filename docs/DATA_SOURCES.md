# Price data sources

Guzzler talks to exactly one interface for prices: `PriceFeed` in
`src/data/priceFeed.ts`. Everything else in the app is written against that
interface, so choosing a provider means writing one class and changing one line
(`activeFeed`).

The app currently ships with `MockPriceFeed`, which invents plausible stations
around the visible map so the UI is demoable. It is not a data source — it must
be replaced before this is useful to anyone.

## Candidate providers

| Provider | Coverage | Access | Tradeoff |
| --- | --- | --- | --- |
| [OPIS](https://www.opis.com/product/pricing/retail-fuel-prices/) | ~150k US outlets, station-level, real-time feed | Enterprise contract, no public pricing | Industry standard (powers GasBuddy and AAA). Highest quality, but a real B2B sales cycle and likely four-to-five-figure monthly minimums before a single user exists. |
| [Zyla Gas Price Locator](https://zylalabs.com/api-marketplace/data/gas+price+locator+api/4808) / [OilPriceAPI](https://docs.oilpriceapi.com/solutions/gas-stations) | US, station-level (Zyla) or wholesale benchmarks (OilPriceAPI) | Self-serve REST, free tiers | Cheap and fast to integrate. Coverage and update freshness are not independently verifiable — fine for a prototype, risky as the basis for an anti-gouging promise. |
| Scraping-as-a-service ([Apify](https://apify.com/stanvanrooy6/gasbuddy-scraper/api/openapi), ScrapingBee) | Whatever GasBuddy has | Pay per result | Station-level and cheap, but it is a competitor's crowdsourced data pulled through their ToS. Not a foundation to build a company on. |
| [GlobalPetrolPrices](https://www.globalpetrolprices.com/data_access.php) | 135 countries, state/country averages | Subscription | Good for macro context and for the "is this region expensive right now" framing. Not per-station, so it cannot answer "which pump on this exit". |
| Own crowdsourced feed | Whatever users report | Build it | No licensing cost, no legal gray zone, and it is the only differentiated asset. Suffers the cold-start problem: no users means no data means no users. |

## Recommended path

Seed the map from a cheap aggregator for day-one coverage, and layer our own
crowdsourced reports on top for freshness. `PriceQuote.source` already carries
`'feed' | 'crowdsourced' | 'station-reported'` so the UI can weight and label
them differently, and `MockPriceFeed` already demonstrates the overlay pattern
(generated prices underneath, user reports on top).

Revisit OPIS once there are enough users that coverage gaps cost more than the
contract does.

## Adding a provider

1. Create `src/data/<name>PriceFeed.ts` exporting a class that implements
   `PriceFeed`.
2. Normalize the provider's response into `Station` / `PriceQuote` from
   `src/types.ts` — the UI never sees provider-shaped data.
3. Implement `submitReport` only if the provider accepts writes. The report
   button hides itself when it is absent.
4. Point `activeFeed` at the new class.

Real providers should also add request coalescing and a short cache behind
`getStationsInRegion`, which is called on every settled map pan.
