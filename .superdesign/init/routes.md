# Routes

Framework: Expo Router 6 with file-based routes. The root `Stack` is defined in `app/_layout.tsx` and wraps every screen in React Native Paper, preferences, and location providers.

| URL | File | Layout | Purpose |
| --- | --- | --- | --- |
| `/` | `app/index.tsx` | `app/_layout.tsx` (header hidden) | Landing screen, recent plans, and primary plan-building entry point. |
| `/wizard` | `app/wizard.tsx` | `app/_layout.tsx` | Multi-section day-plan preferences form and plan generation flow. |
| `/generated/[id]` | `app/generated/[id].tsx` | `app/_layout.tsx` | Newly generated itinerary with map, timeline/list views, stop actions, and save controls. |
| `/plan/[id]` | `app/plan/[id].tsx` | `app/_layout.tsx` | Saved itinerary detail with route map, sharing, feedback, and navigation actions. |
| `/today/[id]` | `app/today/[id].tsx` | `app/_layout.tsx` | Turn-by-turn day companion with current stop and Apple Maps directions. |
| `/saved` | `app/saved.tsx` | `app/_layout.tsx` | Searchable saved-plan library. |
| `/settings` | `app/settings.tsx` | `app/_layout.tsx` | Theme, time format, travel, and notification preferences. |
| `/feature-request` | `app/feature-request.tsx` | `app/_layout.tsx` | Feature request feedback form. |

## Router configuration

There is no separate router config. `app/_layout.tsx` is the authoritative route declaration and is included in full in `layouts.md`.
