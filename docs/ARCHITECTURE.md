# We plan, they execute, we notify

Guzzler's shape in one line. Three roles, and the middle one is deliberately not
ours.

| Role | Who | Why |
| --- | --- | --- |
| **Plan** | Guzzler | Nobody answers "where should I stop, and is this price fair" |
| **Execute** | The driver's nav app | Turn-by-turn is solved, free, and already has their muscle memory |
| **Notify** | Guzzler | The plan has to survive contact with a trip we can't see |

## Why not just be the nav app

Waze is Google-owned with well over a hundred million monthly users and fifteen
years of traffic data whose value comes entirely from user density. Competing
there means spending every dollar reaching parity on the part that's already
solved and given away free.

**You don't need to own the nav slot. You need to own the stop decision.**
Different businesses, and only one is winnable. Google *could* add stop
intelligence, but they'd have to earn community restroom and food ratings the
same slow way we would, and it's a rounding error on their roadmap.

## The constraint that shapes everything

You cannot push a multi-stop plan into someone's nav app. Not reliably, and
mostly not at all:

| App | Intermediate stops accepted in a link |
| --- | --- |
| [Google Maps](https://developers.google.com/maps/documentation/urls/get-started) | ~3 on mobile (9 elsewhere) |
| [Waze](https://developers.google.com/waze/api) | 0 via URL — its one in-app stop isn't linkable |
| Apple Maps | 0 — `saddr`/`daddr` only |

Encoded in `src/lib/navHandoff.ts` with tests, so nobody rediscovers Waze's
limit the hard way. `buildDirectionsUrl` returns the stops that *didn't* fit
rather than dropping them silently — a plan that quietly shrinks is worse than
one that fails loudly.

### The constraint is a gift

If the whole route fit in one handoff, Guzzler would be a one-shot tool: open it
in the driveway, hand off, never touch it again. No presence during the eight
hours that matter, and nothing to retain on.

The relay is forced instead — navigate to stop 1, and on leaving, get stop 2
**with fresh prices**. Better on the merits: prices move during a long drive,
and plans change (you weren't hungry at stop 1; now you are). A preloaded route
can't adapt. Per-leg re-planning can.

## Inferring progress without seeing their nav

`src/lib/tripProgress.ts` reads progress from position alone: near a planned
stop means arrived; well clear again means departed, so hand off the next leg.

Arrival (0.3mi) and departure (0.8mi) use different radii for the same reason
approach alerts do — one threshold flaps between states while the driver sits at
the pump with GPS drifting. Losing GPS holds the previous state rather than
inferring movement.

## What counts as a key moment

`src/lib/moments.ts` is a **closed list**, not an open notification API. The
failure mode of a companion app is obvious and fatal: notify too often, get
muted, and every notification-dependent feature dies at once.

The bar — a moment earns an interruption only if it is **time-critical** (the
decision point passes soon) and **materially valuable** (real money, or a
problem avoided):

| Moment | Priority |
| --- | --- |
| `range-warning` | critical |
| `last-chance` (long gap with no fuel ahead) | critical |
| `next-leg` | high |
| `favorite-ahead` | high |
| `better-deal-ahead` | normal |

Only two are critical, and both are outcomes the driver can't undo from the
shoulder. Everything else — however valuable — competes for **three non-critical
interruptions per hour**. Critical moments bypass that budget but still respect
their own cooldown, because a range warning every thirty seconds is noise even
when the underlying fact is urgent.

Three per hour is not a measured number. It's a deliberate ceiling, on the view
that speaking more than once every twenty minutes reads as chatty. Revisit it
against real usage.

## What's built and what isn't

**Built:** the planner, the per-app handoff links, leg progression, and the
moment rules — all pure logic, all tested.

**Not built: delivery.** Nothing here can currently wake the app. Background
tasks and geofencing need a development build (they don't run in Expo Go), which
is a workflow change rather than a dependency. Until that lands, the plan/notify
loop only closes while the app is open — see [FAVORITES.md](FAVORITES.md).

**Also not built: CarPlay / Android Auto**, which is where these same moments
would render on the car screen. CarPlay's Fueling category needs an Apple
entitlement (`com.apple.developer.carplay-fueling`) that is reviewed
case-by-case and requires a substantively built app, so it follows real data
rather than preceding it. See [FAVORITES.md](FAVORITES.md) for the framing that
fits the category.
