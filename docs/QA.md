# How to QA Guzzler

Read this first: **the logic is tested, the UI has never been seen.** Nobody has
run this app on a device. `npm run verify` proves the math is right and the
bundle builds; it proves nothing about whether the map draws or the permission
prompt works.

So the order below matters. Step 0 is not optional.

## Step 0 — Run it

```bash
npm install
npm start
```

Scan the QR code with Expo Go (iOS App Store / Play Store). The map works in
Expo Go without API keys; a standalone build needs the `REPLACE_WITH_*` keys in
`app.json` filled in.

Until someone does this, everything below is theoretical.

## Layer 1 — Automated checks (run these constantly)

```bash
npm run verify      # typecheck + 84 tests
npm test -- --watch # while working
```

CI runs the same three gates on every push: typecheck, tests, and an Android
bundle. The bundle step matters — it catches import and native-module wiring
that TypeScript can't see, and a failure there means the app wouldn't start.

What's covered: pricing math, value scoring, range and reserve, route
projection, corridor filtering, the trip planner, and the mock feed's behavior.
Including regression tests for the four real bugs found so far.

**Not covered: any component renders.** Adding
`@testing-library/react-native` and a few render tests is the next obvious
increment.

## Layer 2 — Manual device QA

The things most likely to be broken, roughly in order:

**Permissions and location**
- [ ] Grant location → map centers on you, blue dot appears
- [ ] **Deny location** → app still works, falls back to Austin, notice shows
- [ ] Revoke permission in Settings mid-session → no crash
- [ ] Airplane mode → feed failure surfaces as an error, not a blank screen

**Map**
- [ ] Pins render with prices legible at normal zoom
- [ ] Pan quickly across a city → one fetch, not fifty (debounce works)
- [ ] Zoom way out → no hang (the cell guard should return nothing)
- [ ] Range rings draw and scale with the vehicle level
- [ ] Pins are tappable where they *look* tappable

**Vehicle and range**
- [ ] Enter a vehicle → rings appear; preview matches the rings
- [ ] Set level to Empty → no rings, no crash, no NaN
- [ ] Enter garbage in the numeric fields → validation catches it
- [ ] Force-quit and reopen → vehicle persisted

**Trip planning**
- [ ] Plan to Dallas → route draws, stops listed in order
- [ ] Plan with no vehicle → asks for one instead of failing oddly
- [ ] Plan somewhere unreachable → explains why, doesn't fake a plan
- [ ] Tap a stop → station sheet opens for it

**Submissions**
- [ ] Report a price → map updates, pin recolors
- [ ] Rate a stop in pumps → review count increments

**Platform and accessibility**
- [ ] iOS *and* Android — map providers differ meaningfully
- [ ] Small phone (SE) and large (Pro Max) — the top card stacks a lot
- [ ] Notch/dynamic island doesn't overlap the top card
- [ ] VoiceOver/TalkBack reads pins, ratings, and the deal banner
- [ ] Largest system font size doesn't break layouts
- [ ] Verdicts are distinguishable without color (they carry text labels — verify)

## Layer 3 — The QA that actually matters

Everything above tests that the code does what I intended. This layer tests
whether what I intended is *true*, and it's where the real risk lives — because
several numbers in this codebase are reasoned estimates, not measured ones.

**Validate the assumptions against reality:**

| Assumption | Where | How to check |
| --- | --- | --- |
| Circuity 1.25 | `lib/range.ts` | Compare straight-line vs actual driving distance for 20 real trips |
| Reserve 12.5% | `lib/range.ts` | Does an eighth-tank warning match real fuel lights? |
| Stop cost $4 | `lib/tripPlanner.ts` | Time yourself at a real fill-up |
| Rating worth $1.50/point | `lib/tripPlanner.ts` | Ask drivers: how much extra would you pay for a clean restroom? |
| Value split 65/35 | `lib/value.ts` | Do users agree with the "best value" pick? |

**Drive a planned route.** Take a real trip, follow the plan, and record
predicted vs actual: range remaining at each stop, whether prices matched the
pump, whether the stops made sense to someone who knows the road. This single
exercise will teach you more than the rest of this document.

**Show a plan to someone who knows the route.** "Would you have stopped there?"
catches things no assertion can.

## The failure mode to fear

Not a crash — **stranding someone.** Everything else is an annoyance; this is a
person on a shoulder at night.

Current guards: reserve is never spent, unreachable stations can't be ranked
best, `findRangeDeal` only considers comfortable stops, and infeasible trips
report as infeasible. All are tested.

But they all rest on the range estimate being roughly right, and **the range
estimate is a circle where reality is an isochrone** (see `docs/RANGE.md`).
Before this ships anywhere rural, the circle needs to become a real isochrone
and the circuity factor needs measuring, not guessing.

Any change to `lib/range.ts` or `lib/tripPlanner.ts` deserves a second look
specifically for this.

## Known holes, honestly

- **No component or E2E tests.** [Maestro](https://maestro.mobile.dev/) is the
  lightest way to get real device flows under test.
- **Ratings can be farmed.** No rate limiting, no location plausibility check,
  no outlier rejection. A station could rate itself to the top today.
- **The trip planner only sees loaded stations**, so long trips miss stops near
  the far end (`docs/ROUTING.md`).
- **All data is fabricated.** `MockPriceFeed` invents everything. No amount of
  QA on mock data tells you whether real prices are accurate — that starts when
  a real feed lands.
- **No error reporting.** Sentry or similar should go in before real users, or
  you'll never hear about the crashes.
