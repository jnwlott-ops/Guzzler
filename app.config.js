/**
 * Extends app.json with values that depend on where the build is going.
 *
 * The only such value today is the web base URL. GitHub Pages serves a project
 * site from `/<repo>/`, not from the root, so the exported asset paths have to
 * be prefixed — but only for that deploy. Local `npm run web` and native builds
 * leave it empty and serve from the root.
 */
module.exports = ({ config }) => ({
  ...config,
  experiments: {
    ...config.experiments,
    baseUrl: process.env.EXPO_WEB_BASE_URL ?? '',
  },
});
