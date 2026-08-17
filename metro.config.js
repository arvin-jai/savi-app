/**
 * Metro config.
 *
 * This file exists for exactly one reason, and it is worth stating so nobody
 * deletes it as boilerplate.
 *
 * ── Why: `expo run:android` poisons the file watcher ────────────────────────
 *
 * A local Android build makes Gradle write its intermediates *inside*
 * `node_modules`, as `node_modules/<package>/android/build/…`. It reached 8.7 GB
 * across twelve packages here — reanimated alone was 3 GB — and Metro walks and
 * watches every directory it finds.
 *
 * Two failures come out of that, and neither error message says "Gradle":
 *
 *   1. `ENOENT: no such file or directory, watch '…/mergeReleaseResources/out/single'`
 *      — a hard crash on startup. Gradle deletes and recreates these paths, so
 *      one can vanish between Metro's walk and its watch. The FallbackWatcher
 *      (Windows, no watchman) throws rather than skipping it.
 *
 *   2. `EMFILE: too many open files`, seen when a second Metro instance starts
 *      on the same tree. Tens of thousands of extra directories, each costing a
 *      watch handle.
 *
 * Blocking them here keeps both out of the file map. **This is a belt; the
 * braces are deleting the directories**, since a blocked path that still exists
 * is still 8.7 GB of disk. If Metro starts crashing on a watch path again:
 *
 *     Get-ChildItem node_modules -Recurse -Depth 3 -Directory -Filter build |
 *       Where-Object { $_.Parent.Name -eq 'android' } |
 *       Remove-Item -Recurse -Force
 *
 * Nothing is lost — they are build outputs, and the next `expo run:android`
 * regenerates them (slowly, once).
 *
 * ── Why nothing else is in here ─────────────────────────────────────────────
 *
 * There was no `metro.config.js` before this, and the default was correct.
 * `nativewind` is a dependency but is *not* wired up: `src/global.css` is plain
 * CSS with no Tailwind directives and there is no `tailwind.config.js`, so this
 * deliberately does NOT call `withNativeWind`. Adding it would start a
 * PostCSS/Tailwind pipeline nothing is asking for.
 */

const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Both separators: the same config is read on Windows and in CI.
const GRADLE_INTERMEDIATES = /node_modules[\\/].*[\\/]android[\\/]build[\\/].*/;

config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList)
    ? config.resolver.blockList
    : config.resolver.blockList
      ? [config.resolver.blockList]
      : []),
  GRADLE_INTERMEDIATES,
];

module.exports = config;
