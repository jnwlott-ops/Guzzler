# Range and vehicle profiles

A driver enters their tank size, efficiency, and current level; Guzzler draws
how far they can get and marks which stations are actually reachable.

The point isn't the circle. It's that highway-exit pricing works precisely
because drivers don't know whether they can safely pass it up. Putting a number
on that turns the price map into a decision — hence the "don't fill up yet"
banner, which only appears when a cheaper station is comfortably within range.

## The math

```
totalMiles       = capacity × level × efficiency
reserveMiles     = capacity × 0.125 × efficiency     (an eighth of a FULL tank)
comfortableMiles = totalMiles − reserveMiles
radius           = miles ÷ 1.25                      (circuity correction)
```

Units switch on `Vehicle.fuelType`: gallons and MPG for gas, kWh and mi/kWh for
electric. The formula is otherwise identical, which is why EV support is a unit
change rather than a second code path.

**Reserve is measured against the full tank, not the current level.** An eighth
of a tank is the same number of gallons whether you're full or nearly empty.
Computing it off the current level would shrink the reserve exactly when it
matters most.

## The circle is a lie (and what we do about it)

**A circle on a map is not a range map.** Real reachable area follows roads, so
it's a lumpy isochrone — dented by mountains, rivers, coastlines, and one-way
interstates. A crow-flies circle systematically overstates where you can get.

Two mitigations, both partial:

1. **Circuity factor of 1.25.** US road distance runs roughly 1.2–1.4× straight
   line distance. Dividing the radius by 1.25 draws a smaller, more honest
   circle, and inflating station distances by the same factor errs toward
   telling drivers things are *further* than they are.
2. **Two rings.** The inner (solid, green) ring is range before reserve; the
   outer (dashed, red) is the absolute limit. Dashed because it's an estimate,
   not a boundary.

Neither makes the circle correct. **A driver planning a desert crossing on our
ring would be trusting it further than it deserves.** The real fix is an
isochrone API — [Mapbox Isochrone](https://docs.mapbox.com/api/navigation/isochrone/),
HERE, or self-hosted Valhalla — which returns the true drivable polygon. That
should land before any messaging promises range accuracy, and certainly before
launching anywhere rural.

`estimateRange()` returns `undefined` rather than zero for an unusable profile,
so "no vehicle set up" is always distinguishable from "genuinely empty," and
`reachabilityOf()` treats everything as reachable when no range is known — the
map should never grey out stations the driver never asked us to filter.

## Unreachable stations can't win

`rankStations()` skips `unreachable` entries when picking the best station. The
cheapest gas in the state is not a recommendation if the driver runs dry forty
miles short of it.

`findRangeDeal()` is stricter still: it only considers `comfortable` stations,
so the app never advises spending someone's reserve to save a few dollars. It
also stays quiet below $1 of savings — a banner for pocket change trains people
to ignore banners.

## Getting vehicle specs

Today the driver types MPG and tank size. That's deliberate for a first pass:
three dropdowns before the map is useful would cost more users than the
precision is worth.

The upgrade is [EPA's fueleconomy.gov Web Services](https://www.fueleconomy.gov/feg/ws/)
— free, no API key, every model year from 1984, and it carries EV range too.
The flow is year → make → model → options → MPG.

One gap: **EPA data doesn't include tank capacity.** That still needs manual
entry or a separate dataset, so a lookup would prefill efficiency but not
capacity.

## Open work

- Real isochrones instead of circles (above).
- Prefill efficiency from the EPA API.
- Range is a lie in other ways too: cold weather, elevation, speed, load, and
  battery degradation all move it, and EVs far more than gas. Worth surfacing a
  confidence band rather than a single number.
- Live level from the vehicle (OBD-II, or a manufacturer API) instead of asking.
- Deals along a *route*, not a radius — the natural convergence of this feature
  with route planning.
