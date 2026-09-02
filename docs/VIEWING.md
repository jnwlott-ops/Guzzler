# How to look at the app

GitHub can't run a React Native app — there's no preview button for mobile, and
the repo page will only ever show you code. Here are the four real options,
fastest first.

## 1. Web preview (a link, no install)

Every push to the working branch publishes an interface preview to GitHub Pages:

```
https://<owner>.github.io/Guzzler/
```

**Enable it once:** repo → Settings → Pages → Source: **GitHub Actions**. Then
push, or run the *Web preview* workflow manually from the Actions tab.

**What you get:** the real interface — grade selector, rank toggle, amenity
filters, station sheets, vehicle setup, trip planner, all the copy and layout.

**What you don't:** the map. `react-native-maps` is native-only; on web it
renders an honest placeholder instead. So no pins, range rings, or route line,
and you can't tap a station to open its sheet. Good for reviewing layout and
flows, useless for judging the map experience.

## 2. Expo Go on your phone (the real thing, ~2 minutes)

```bash
git clone https://github.com/<owner>/Guzzler.git
cd Guzzler
npm install
npm start
```

Install **Expo Go** ([iOS](https://apps.apple.com/app/expo-go/id982107779) /
[Android](https://play.google.com/store/apps/details?id=host.exp.exponent)),
scan the QR code from the terminal, and the app opens on your phone with a real
map. Expo Go supplies its own Google Maps keys, so the `REPLACE_WITH_*`
placeholders in `app.json` don't matter here — those are only for standalone
builds.

This is the only way to see what the app actually is.

## 3. GitHub Codespaces (no local setup)

From the repo: **Code → Codespaces → Create codespace**. Then:

```bash
npm install
npx expo start --tunnel
```

`--tunnel` is required — a Codespace isn't on your phone's network, so the
default LAN connection can't reach it. Scan the QR with Expo Go as above.

Slower to start than cloning, but nothing to install locally.

## 4. EAS Update (a link you can send other people)

For sharing with someone who won't clone a repo:

```bash
npm install -g eas-cli
eas login          # needs a free Expo account
eas update --branch preview
```

That gives a URL anyone can open in Expo Go, with the real map. This is the
right answer for showing an investor or a tester.

## Which to use

| You want to… | Use |
| --- | --- |
| Glance at the UI from a link | Web preview (1) |
| Actually evaluate the app | Expo Go (2) |
| Avoid installing anything locally | Codespaces (3) |
| Share it with someone else | EAS Update (4) |

For QA, only 2, 3 and 4 count. See [QA.md](QA.md).
