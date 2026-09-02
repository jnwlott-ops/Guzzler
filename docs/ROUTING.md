# Trip planning

Enter a destination and Guzzler picks the fuel stops: cheapest overall once
detours and stop quality are priced in, and never dipping below reserve.

## Propose, don't hijack

The plan is computed and **presented for the driver to accept**. Nothing changes
their navigation on its own, and the sheet shows its work — every stop with its
price, gallons, cost, and remaining range on arrival.

This is deliberate. Automating the *suggestion* is useful; automating the
*decision* means one wrong call strands someone at 11pm, and the driver always
knows things the app doesn't (a closed station, a construction detour, a kid who
needs a bathroom now). An automated planner that says "trust me" earns exactly
one wrong recommendation before nobody uses it again.

## Off the beaten path needs a yes

There are two kinds of stop, split at `ON_THE_WAY_DETOUR_MILES` (3 miles round
trip, roughly four minutes):

- **On the way** — the station at the exit, a block off the highway. Goes into
  the plan without ceremony. It's a detail.
- **Off the beaten path** — anything beyond that. Marked
  `requiresApproval`, shown with the detour distance and an explicit
  Approve / Skip, and **the plan is not a live suggestion until every one is
  resolved**. `isPlanLive()` gates the Start button on exactly this.

Taking someone meaningfully off their route is a decision, not a detail, and
it isn't the app's to make quietly. A driver who discovers mid-trip that
"best value" meant eight miles through a town they didn't want to visit stops
trusting the planner — reasonably.

### A no stays a no

Rejected stations go into `excludedStationIds` and the trip is **re-planned
around them**, not spliced. Dropping a stop can make everything after it
unreachable, so the whole chain has to be recomputed — and a rejection must
never resurface on the next recalculation.

If rejections leave nothing workable, the plan comes back infeasible with
`'Every usable stop on this route has been turned down.'`, distinct from the
no-sellers-of-this-grade case, and the sheet offers to reconsider them.

The same principle governs the "don't fill up yet" banner on the map: it carries
an explicit **No thanks**, and a dismissed deal stays dismissed for the session.
A standing suggestion the driver can't refuse is a nudge, not a suggestion.

## It's not "find the highest-rated stop"

That framing produces bad plans. The real problem is a constrained
optimization: **never run below reserve**, and among the plans that satisfy
that, spend the least once detours and stop quality are priced in. A 4.8-rated
stop fifteen miles off the interstate is usually worse than a 4.2 at the exit.

Solved as a shortest-path DP over stations ordered along the route:

```
cost[j] = min over reachable i of  cost[i] + stopCost(j, milesFrom(i, j))
```

where a transition `i → j` exists only if that leg fits in a tank, and

```
stopCost = STOP_DOLLARS
         + fuel bought (miles burned ÷ efficiency × price)
         + detourMiles × DETOUR_DOLLARS_PER_MILE
         − (rating − 3) × RATING_DOLLARS × fillFraction
```

DP rather than greedy on purpose: greedily taking the cheapest reachable
station can leave you unable to reach anything from there. Corridors hold
dozens to low hundreds of stations, so O(n²) is comfortably fast.

### The knobs

| Constant | Default | What it controls |
| --- | --- | --- |
| `STOP_DOLLARS` | $4 | What making a stop costs at all — roughly ten minutes |
| `RATING_DOLLARS` | $1.50 | Dollars per rating point traded against price |
| `DETOUR_DOLLARS_PER_MILE` | $0.25 | Time cost of leaving the route, beyond fuel |
| `RESERVE_FRACTION` | 0.125 | Untouchable reserve, matching `lib/range.ts` |

At $1.50/point a 5-star stop carries a $3 advantage — enough to break a
near-tie, not enough to override a 40¢/gal gap on a full tank. That's the knob
for how hard "highest rated" should push against "cheapest."

### Two bugs the tests caught

Both were real and both would have shipped:

1. **Gratuitous stops.** With no fixed cost per stop, the planner chained a
   second station one mile after the first, buying 0.03 gallons purely to
   collect a well-rated stop's bonus. Fixed by `STOP_DOLLARS`.
2. **Bonus farming.** The rating bonus applied in full regardless of how much
   fuel you bought. Now scaled by `fillFraction`, so a stop that gets a third
   of your business earns a third of the goodwill.

## Infeasible trips say so

When there's a stretch longer than a full tank, `planTrip` returns
`{ feasible: false }` with how far the driver can actually get and why — not a
best-effort plan that quietly runs the tank dry. "You can get 210 miles and then
you're stuck" is actionable; a plan that strands you is not.

## Swapping in a real routing provider

`RouteProvider` in `src/data/routeProvider.ts` is the seam, same pattern as
`PriceFeed`. Geocoding lives behind `getRoute` because real APIs bundle the two.

Candidates: [Mapbox Directions](https://docs.mapbox.com/api/navigation/directions/)
(generous free tier), Google Directions (best data, pay per call), or
self-hosted [Valhalla](https://valhalla.github.io/valhalla/) (free, you run it).

For EV trips, [NREL's Alternative Fuel Stations API](https://developer.nlr.gov/docs/transportation/alt-fuel-stations-v1/)
has a **stations-along-a-route** endpoint that does the corridor query
server-side, for free. Note the domain moved from `developer.nrel.gov` on
2026-05-29.

## Known gaps

- **The corridor only sees loaded stations.** `useTrip` plans against whatever
  the feed loaded for the visible map region, so a long trip won't see stops
  near the far end. A real provider must fetch along the whole polyline. This is
  the most important gap — the planner is only as good as its candidate set.
- **One route, no alternatives.** Real providers return several; we take the
  first. Comparing total cost across alternatives is a natural feature.
- **Fill-to-full is assumed.** Partial fills at a cheap station can beat full
  fills, and the DP could model it, but it complicates the cost function for
  modest gain.
- **Prices are assumed static** for the trip's duration. Fine for a day trip,
  wrong for a multi-day drive.
- **Traffic and elevation are ignored** in both range and duration. Elevation in
  particular hits EVs hard.
