# Take Me Out — Light iOS design system

## Product and scope

Take Me Out is a consumer Expo/React Native iOS app that turns a location, time window, group, transport, budget, interests, and practical constraints into a timed local itinerary. Preserve the working planner, live location/manual city entry, generation engine, maps, rerolls, saved plans, navigation, feedback, settings, and accessibility.

The supplied `takemeout-light.html` is the authoritative UI reference. It replaces the dark hotel-pilot direction. The native app should reproduce its Home, Plan your day, Stops/Trip settings, and Ready route language across all existing screens. Do not add hotel branding, QR table tents, presenter scripts, manager controls, sales-offer content, or setup screens.

## Brand invariant

- Use the exact original Take Me Out logo from `src/assets/images/tmo-logo.png` anywhere the reference shows a brand mark.
- Never substitute the reference's inline placeholder SVG, initials, emoji, a generic pin, an invented mark, or text alone.
- Preserve the logo's transparent background and purple/indigo gradient pixels.

## Light color ramp

Light mode is a deliberately built ramp, not an inversion of the previous dark palette.

- `paper`: `#EFEDF7` — surrounding/background material where visible on wide screens.
- `canvas`: `#F7F6FC` — default app screen; faintly violet, never pure white.
- `surfaceRaised`: `#FFFFFF` — the only pure-white surface and the primary elevation step.
- `surfaceRecessed`: `#EDEAF6` — inputs, segmented-control track, subdued rows.
- `surfacePressed`: `#E3DFF1` — pressed controls and off switch tracks.
- `line`: `rgba(29,23,64,0.09)`; practical native fallback `#E6E2EF`.
- `lineStrong`: `rgba(29,23,64,0.18)`; practical native fallback `#D3CDDF`.
- `violetText`: `#4A34C4` — links, icons, labels, and accent text; WCAG-safe on the canvas.
- `violetFill`: `#5B48E8` — buttons, selected chips, switch-on track.
- `violetDecorative`: `#7C6BFF` — decorative rules, glow, and map routes only.
- `violetWash`: `#E6E1FB` — quiet selected backgrounds and tint blocks.
- `signal`: `#8F4E06` — time and duration only.
- `signalWash`: `#FBEEDC`.
- `danger`: `#B32B1E`; `dangerWash`: `#FDEDEA`.
- `textHigh`: `#171232`.
- `textMid`: `#57516F`.
- `textLow`: `#847EA0`.

Do not use the decorative `#7C6BFF` or pale amber as text on light surfaces. Time values use bronze so they remain legible.

## Typography

- Display and prominent UI: Bricolage Grotesque, weights 600–800.
- Body and functional controls: Inter, weights 400–700.
- Metadata, overlines, times, section labels, and compact actions: IBM Plex Mono, weights 400–600.
- Home wordmark: 36–38 px, Bricolage 800, tight tracking.
- Large screen title: 31–33 px, Bricolage 800, tight tracking.
- Section heading / stop name: 18–20 px, Bricolage 600.
- Body: 13.5–16 px, Inter, 1.45–1.62 line height.
- Metadata: 9–12.5 px, IBM Plex Mono, uppercase with 0.08–0.2 em letter spacing where used as a label.

## Elevation, spacing, and geometry

- Light mode separates levels with true-white raised surfaces and shadows; recessed controls go darker/violet-tinted.
- Raised shadow: `0 1px 2px rgba(29,23,64,.05), 0 2px 8px rgba(29,23,64,.04)`.
- Strong shadow: `0 2px 6px rgba(29,23,64,.06), 0 10px 26px -8px rgba(29,23,64,.10)`.
- CTA shadow: `0 6px 18px -6px rgba(74,52,196,.42)`.
- Screen gutter: 24 px in the reference; use 20–24 px where device width permits.
- Section separation: 26–30 px with a small monospaced label and trailing hairline.
- Controls: 11–12 px radius. Primary CTA: 16 px radius. Media/map: 16 px radius. Chips: pill radius.
- Prefer open sections and horizontal rules over stacking every field group inside a large card.

## Components

### Home

- Full-height tinted canvas with quiet violet radial halo and two thin concentric rings behind the logo.
- Exact logo centered around 108–112 px.
- TAKE ME OUT in a large Bricolage wordmark beneath it; OUT uses violet text.
- Tagline: “Tell us when you're free. We'll build the whole day.”
- Starting-point row separated by thin rules, with violet location icon, compact mono label, city, and Change action.
- Full-width violet gradient Start plan CTA, then Saved plans and Settings as quiet mono uppercase links.

### Navigation and large titles

- Translucent light canvas stack header with a compact white bordered back button.
- Large title lives in the scroll content. The compact title is used in the native header.
- Optional right action uses violet monospaced uppercase text.

### Form sections

- Use open sections on the canvas with 30 px top separation rather than large filled cards.
- Section label is 10–11 px monospaced uppercase in `textLow`, followed by a flexible hairline.
- Inputs are transparent with a bottom border, not filled boxes. Focus thickens the underline from 1 px to 2 px without shifting layout.
- Group choices are white pill chips with a subtle border; selected chips use violet fill with white text.
- Segmented controls sit in `surfaceRecessed`; the selected segment is white with violet text and a subtle shadow.
- Off switch track is `surfacePressed` with a white shadowed knob; on uses violet fill.
- Stop count is a bordered white stepper with violet plus/minus and mono value.
- Slider track is recessed and its thumb is violet with a small violet halo.
- Validation warnings use `dangerWash`, a light red border, and `danger` heading.

### CTA dock

- Primary actions remain available near the bottom of long planning/route screens.
- Native implementation may use sticky positioning where reliable; otherwise preserve the visual gradient fade/dock and clear bottom spacing.
- VioletFill → VioletText gradient where supported; solid VioletFill is acceptable natively.

### Ready route

- Open route header with monospaced READY ROUTE label, 31 px city, and a three-column metadata strip separated by hairlines.
- Map/List segmented control follows.
- Map base is pale lavender `#EAE7F4`. Route uses a wide white casing below a 2–3 px violet route stroke. POI labels stay subdued.
- Stops are de-boxed groups separated by horizontal rules.
- Time range and duration use IBM Plex Mono; time uses bronze.
- Stop index is a compact violet mono number.
- Media has 16 px corners; fallback category tiles use soft pastels with a top-down white scrim and dark captions.
- Stop reasoning is text with a thin decorative violet left rule. Facts are quiet mono metadata. Info/Reroll are equal white bordered actions.

### Secondary screens

- Saved plans: large-title shell, search underline, de-boxed plan rows with date/location/count metadata and a restrained open affordance.
- Plan detail: same route header, map/list selector, map treatment, stop groups, save/share/finish actions.
- Today: large-title shell, current-stop emphasis, bronze time metadata, progress divider, white bordered map/navigation actions.
- Settings and feature request: open labeled sections, recessed segmented tracks, white raised rows, underline inputs, and the same title/navigation shell.

## Motion and accessibility

- Transitions: 160–220 ms for control state; native stack navigation remains platform-standard.
- Honor reduced motion.
- Minimum interactive target: 44×44 px.
- Maintain WCAG AA contrast; do not use decorative violet or pale amber for small text.
- Preserve text labels and accessibility state alongside color for selections and switches.
- Support Dynamic Type wherever React Native text components allow it.
