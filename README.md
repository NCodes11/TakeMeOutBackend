# TakeMeOut (Expo + TypeScript)

Take Me Out is an iPhone-ready itinerary planner for dates/family/friends with local-first persistence.

## Features
- Expo React Native + expo-router + React Native Paper
- SQLite local DB for plans/stops/checklists/cache
- Location detection (expo-location) with manual city fallback
- Places provider interface + Nominatim/Overpass implementation with simple rate limiting and caching
- Routing provider interface + OSRM demo implementation
- Generated timeline/list plans, map markers/polyline, lock/reorder/regenerate actions
- Today mode with Apple Maps deep link + offline-friendly local data
- Share JSON, Plan Code + QR, and `.ics` export
- Local reminders via expo-notifications
- Figma workflow (`/design` JSON + `/figma-plugin` generator)

## Scripts
- `npm run start`
- `npm run ios`
- `npm run test`
- `npm run test:e2e`
- `npm run lint`
- `npm run format`

## Figma plugin usage
1. Build plugin TS to JS (e.g. via `tsc` in `figma-plugin`) so output is `figma-plugin/dist/code.js`.
2. Open Figma → Plugins → Development → Import plugin from manifest.
3. Select `figma-plugin/manifest.json`.
4. Run **DayDate Generator**.
5. The plugin reads:
   - `design/design-tokens.json`
   - `design/components.json`
   - `design/screens.json`
6. Click run again any time after JSON edits for one-click Generate/Update behavior.

## Notes
- OSRM and Overpass are public demo APIs for MVP and can throttle.
- Cached plans remain available offline.
