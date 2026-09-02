# Favorites and approach alerts

Star a station or restaurant and Guzzler tells you when you're coming up on it.

## Lead time is the whole feature

The trigger is `APPROACH_MILES` (2.2), not a round number — it's about two
minutes of warning at highway speed. **An alert that fires as you pass the exit
is worse than no alert**, because it's the same interruption with none of the
usefulness.

## Hysteresis, and why the two distances differ

Alerts trigger at 2.2 miles and clear at 3.5 (`CLEAR_MILES`). The gap is not
sloppiness — it's what stops the alert flapping.

With a single threshold, a driver stopped at a light near the boundary gets the
alert switched on and off repeatedly as GPS noise pushes the computed distance
back and forth across the line. Clearing at a longer distance than triggering
means an alert ends only once the driver has genuinely moved past.

`updateApproaches()` is pure — it takes the previously-alerting ids and returns
the new set — so the caller owns the state and the behavior is directly
testable. There are tests for the boundary, the gap, and independent tracking
of several favorites.

Dismissing a favorite silences it for that approach only; it re-arms once the
driver leaves and clears.

## The real limitation: this is foreground only, and that's close to fatal

Alerts fire while the app is open and receiving location updates. **With the app
backgrounded or closed, nothing happens.**

Do not read that as an edge case. Drivers run turn-by-turn navigation for the
whole trip, which means **backgrounded is Guzzler's normal state during exactly
the window these alerts exist for.** A foreground-only approach alert is close
to decorative: it fires when the driver is already looking at the app, and stays
silent when they aren't.

So background delivery is not a later enhancement for this feature. It is the
feature.

Closing it means background geofencing, which has real costs worth knowing
before committing:

- **`expo-location`'s `startGeofencingAsync` plus `expo-task-manager`.**
- **iOS caps monitored regions at 20 per app.** More favorites than that and you
  have to dynamically swap which regions are registered based on where the
  driver is — a real piece of engineering, not a config change.
- **iOS requires "Always" location permission.** That's a harder prompt to get
  accepted than "While Using", it draws App Store review scrutiny, and it needs
  a clear justification string.
- **Battery.** Geofencing is cheaper than continuous tracking, but it isn't free,
  and users blame the app that drains their phone.

A reasonable middle path is geofencing only the handful of favorites nearest the
driver's current position, refreshed as they travel.

**Both background geofencing and background tasks require a development build —
they do not work in Expo Go.** That's a workflow change (EAS Build or `expo
prebuild`), not just a dependency.

## The surface question this raises

If the driver has navigation up for the entire trip, Guzzler is never the app on
screen while moving. That's a constraint to design around, not a failure, and it
implies three distinct surfaces:

| When | Surface | State today |
| --- | --- | --- |
| Before the drive | Phone, app open — the trip planner | Built |
| During, on the phone | Background notification | Missing |
| During, on the car screen | CarPlay / Android Auto | Missing |

**CarPlay has a Fueling app category** (added in iOS 16) that is close to
purpose-built for this. Notably, Apple requires Fueling apps to have "meaningful
functionality" rather than just listing nearby stations — price-against-median,
range, and stop planning is exactly that; a station list would not qualify.

React Native paths exist but are third-party and need native code:
[`@g4rb4g3/react-native-carplay`](https://www.npmjs.com/package/@g4rb4g3/react-native-carplay)
(Expo-compatible, New Architecture) and
[`@iternio/react-native-auto-play`](https://github.com/Iternio-Planning-AB/react-native-auto-play)
for both platforms. Expo has no first-party support —
[see the discussion](https://github.com/expo/expo/discussions/24354).

## Why favorites store coordinates, not just ids

A `Favorite` carries name, address, and coordinate rather than referencing a
station by id. Ids would be smaller, but an approach alert has to work when the
driver is 200 miles from home and the feed hasn't loaded that region — it can't
wait for a station to come back into view before knowing where it is.

The tradeoff: a saved favorite's *prices* go stale, since only its identity is
stored. That's correct — prices should always come from the live feed — but it
means the favorite row shows no price until that station loads.
