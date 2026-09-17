# Extractable components

## AppScreen

- Source: `src/components/ui/AppScreen.tsx`
- Category: layout
- Description: Safe-area-aware screen shell with scrolling, heading/subheading, landing header, optional logo, and menu action.
- Extractable props: `variant` (`default` or `landing`), `title`, `subtitle`, `logoSource`, `onMenuPress`, `scroll`
- Hardcoded: layout widths, page gutters, typography weights, title accent, safe-area behavior

## PrimaryButton

- Source: `src/components/ui/AppButton.tsx`
- Category: basic
- Description: Full-height filled CTA backed by the active Paper theme.
- Extractable props: `children`, `disabled`, `loading`, `icon`, `onPress`
- Hardcoded: minimum height, radius, typography, elevation

## SecondaryButton

- Source: `src/components/ui/AppButton.tsx`
- Category: basic
- Description: Outlined action button backed by the active Paper theme.
- Extractable props: `children`, `disabled`, `icon`, `onPress`
- Hardcoded: minimum height, radius, typography, border treatment

## GhostButton

- Source: `src/components/ui/AppButton.tsx`
- Category: basic
- Description: Text-only tertiary action.
- Extractable props: `children`, `disabled`, `icon`, `onPress`
- Hardcoded: typography and primary-theme color

## AppCard

- Source: `src/components/ui/AppCard.tsx`
- Category: basic
- Description: Shared bordered Paper card with theme-aware surface and shadow.
- Extractable props: `children`
- Hardcoded: border, radius, shadow, and elevation

## ChoiceButtonGroup

- Source: `src/components/ui/ChoiceButtonGroup.tsx`
- Category: basic
- Description: Wrapping two-column selection grid for wizard choices.
- Extractable props: `value`, `options`, `onValueChange`
- Hardcoded: selected/unselected component styles and two-column sizing
