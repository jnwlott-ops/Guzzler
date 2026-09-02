# Ranking and monetization

Guzzler's ranking is community-owned. Drivers report prices and rate stops;
stations can buy visibility but never position. This document records that
boundary and where it is enforced in code, because it is the property the whole
business model rests on — and the kind of thing that erodes quietly if nobody
writes it down.

## The two rank modes

- **Cheapest** — lowest price for the selected grade, ignoring everything else.
- **Best value** — a 0-100 score blending price with driver ratings.

Both are computed against *what is currently on screen*, so panning to a new
area re-baselines the comparison instead of carrying a stale sense of normal.

## The value score

```
value = pricePoints * 0.65 + ratingPoints * 0.35
```

- **pricePoints** — where the station falls between the cheapest and priciest in
  view, scaled 0-100. Relative rather than absolute, because "cheap" only means
  anything locally: $4.10 is a steal in one metro and a gouge in another.
- **ratingPoints** — driver ratings for restroom and overall, averaged and
  mapped to 0-100, then damped by review count. Restroom carries equal weight
  with overall because it is what travelers actually choose stops on.

Price stays dominant at 65% on purpose. A spotless restroom should not rescue a
station charging 80 cents over the local median — if it did, "best value" would
stop meaning value.

### Damping low review counts

Ratings shrink toward neutral (50) below `CONFIDENCE_REVIEWS` (5). A 5.0 from
two people lands well short of a 4.6 from fifty. Without this, a handful of
reviews — or a handful of *planted* reviews — would decide the ranking.

### Price comparisons use the median

`medianPrice`, not mean. One $6.00 highway-exit gouger should not drag "normal"
upward and thereby make itself look reasonable.

## What advertisers can and cannot buy

**Can buy:** a labeled offer in the station sheet, a small sponsored dot on the
pin, and (later) verified-listing status and a benchmark dashboard.

**Cannot buy:** position, pin color, pin size, the value score, or the star on
the best station in view.

This is enforced structurally, not by convention:

- `valueScore()` in `src/lib/value.ts` takes a `Station` but never reads
  `station.sponsored`. It cannot be influenced by placement even by mistake.
- `SponsoredPlacement` is a separate field on `Station`, not a modifier on
  `StationRatings` or `PriceQuote`.
- `rankStations()` selects its winner on price or value alone.

There are checks covering exactly this — that an identical station scores the
same with and without sponsorship, and that a sponsored station cannot win a
ranking it would otherwise lose.

## Disclosure

Any rendered offer must carry the `SPONSORED` label. This is not a style
preference: presenting paid placement as an objective ranking without clear
disclosure is deceptive advertising under FTC rules, and "best value" is exactly
the kind of comparative claim that attracts scrutiny.

Ads may be unobtrusive. They may not be unlabeled.

## Open work

- **Rating abuse.** Nothing currently stops a station from farming its own
  ratings. Before launch this needs at minimum: per-account rate limits,
  device/location plausibility checks (you should be near the station), outlier
  rejection, and reviewer reputation weighting.
- **Cold start.** Stations with zero ratings score neutral, which is the honest
  default but means value mode ≈ price mode until ratings accumulate. Seeding
  from an amenities dataset would help.
- **Weight tuning.** The 65/35 split and the 5-review confidence threshold are
  reasoned starting points, not measured ones. They should be revisited against
  real engagement data.
