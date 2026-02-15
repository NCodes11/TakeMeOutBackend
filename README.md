# TakeMeOut (Expo + TypeScript)

Take Me Out is an iPhone-ready itinerary creator/planner for dates/family/friends with local-first persistence.

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

## Notes
- OSRM and Overpass are public demo APIs for MVP and can throttle.
- Cached plans remain available offline.

## Updates Log

### 2026 Improvements
- Reworked place generation to prioritize real nearby places and stricter category matching.
- Added stronger Outdoor filtering to block retail/grocery/gas/pharmacy results from Outdoor plans.
- Added a dedicated Major Attractions pipeline with targeted queries and progressive radius expansion.
- Improved relevance/scoring for attractions using rating, review count, distance, and brand-term boosts.
- Added final itinerary validation/replacement pass so misclassified stops are re-picked before display.
- Fixed map-link handling so Apple Maps opens stop coordinates directly and avoids invalid world-view links.
- Added missing-coordinate safeguards before opening maps actions.
- Improved dynamic location handling:
  - live GPS refresh support
  - manual location set/refresh support
  - planning flow uses freshest available coordinates
- Updated stop count behavior:
  - stop count selector supports 2-8 stops
  - planner and provider now respect requested stop count range
  - search radius scales with requested stop count and travel settings
- Added weighted itinerary sequencing to reduce repetitive plans and improve stop order realism.
- Removed outdated pace mode dependency from planning logic in favor of explicit stop count.
- Added reusable price-tier utility with inclusive budget behavior:
  - `$` allows tier 1
  - `$$` allows tiers 1-2
  - `$$$` allows tiers 1-3
  - unknown price is not hard-excluded
- Updated build-plan UX:
  - stop types default to unselected
  - validation messaging when no stop types are selected
  - start flow consolidated around a single Start Plan action with location fallback handling
- Added project env setup docs for Google API key usage and local secret handling (`.env`, EAS secret guidance).
