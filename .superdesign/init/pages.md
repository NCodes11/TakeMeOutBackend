# Page dependency trees

## `/` — Home

Entry: `app/index.tsx`

- `app/index.tsx`
  - `src/assets/images/home-hero-composite.png`
  - `src/assets/images/home-hero-composite-dark.png`
  - `src/context/LocationContext.tsx`
    - `src/utils/geocoding.ts`
  - `src/store/usePlanStore.ts`
    - `src/db/sqlite.ts`
    - `src/services/generator.ts`
    - `src/types/models.ts`
  - `src/theme/appTheme.ts`

## `/wizard` — Build Plan

Entry: `app/wizard.tsx`

- `app/wizard.tsx`
  - `src/components/GenerationLoadingOverlay.tsx`
    - `src/components/ui/AppButton.tsx`
    - `src/theme/appTheme.ts`
  - `src/components/ui/AppCard.tsx`
  - `src/components/ui/AppScreen.tsx`
  - `src/components/ui/ChoiceButtonGroup.tsx`
  - `src/constants/groupTypes.ts`
  - `src/constants/stopTypes.ts`
  - `src/context/LocationContext.tsx`
    - `src/utils/geocoding.ts`
  - `src/context/PreferencesContext.tsx`
  - `src/store/usePlanStore.ts`
    - `src/db/sqlite.ts`
    - `src/services/generator.ts`
  - `src/theme/appTheme.ts`
  - `src/types/models.ts`

## `/generated/[id]` — Generated Plan

Entry: `app/generated/[id].tsx`

- `app/generated/[id].tsx`
  - `src/components/RouteMap.tsx`
    - `src/providers/routingProvider.ts`
    - `src/types/models.ts`
    - `src/utils/maps.ts`
  - `src/components/StopCard.tsx`
    - `src/components/StopHeroMedia.tsx`
    - `src/components/StopHeroMedia.native.tsx`
    - `src/components/ui/AppButton.tsx`
    - `src/context/PreferencesContext.tsx`
    - `src/utils/stopMedia.ts`
    - `src/utils/time.ts`
  - `src/components/FeedbackModal.tsx`
    - `src/components/ui/AppButton.tsx`
    - `src/services/feedback.ts`
  - `src/components/PlaceInfoModal.tsx`
    - `src/utils/openMapsOptions.ts`
    - `src/utils/stopMedia.ts`
  - `src/components/GenerationLoadingOverlay.tsx`
  - `src/components/ui/AppCard.tsx`
  - `src/components/ui/AppScreen.tsx`
  - `src/store/usePlanStore.ts`
  - `src/theme/appTheme.ts`
  - `src/types/models.ts`
  - `src/utils/maps.ts`

## `/plan/[id]` — Saved Plan Detail

Entry: `app/plan/[id].tsx`

- `app/plan/[id].tsx`
  - `src/components/RouteMap.tsx`
  - `src/components/StopCard.tsx`
  - `src/components/FeedbackModal.tsx`
  - `src/components/PlaceInfoModal.tsx`
  - `src/components/GenerationLoadingOverlay.tsx`
  - `src/components/ui/AppButton.tsx`
  - `src/components/ui/AppCard.tsx`
  - `src/components/ui/AppScreen.tsx`
  - `src/store/usePlanStore.ts`
  - `src/theme/appTheme.ts`
  - `src/types/models.ts`
  - `src/utils/maps.ts`

## `/today/[id]` — Navigate

Entry: `app/today/[id].tsx`

- `app/today/[id].tsx`
  - `src/components/FeedbackModal.tsx`
  - `src/components/ui/AppButton.tsx`
  - `src/components/ui/AppCard.tsx`
  - `src/components/ui/AppScreen.tsx`
  - `src/context/LocationContext.tsx`
  - `src/store/usePlanStore.ts`
  - `src/theme/appTheme.ts`
  - `src/utils/maps.ts`

## `/saved` — Saved Plans

Entry: `app/saved.tsx`

- `app/saved.tsx`
  - `src/components/ui/AppButton.tsx`
  - `src/components/ui/AppCard.tsx`
  - `src/components/ui/AppScreen.tsx`
  - `src/store/usePlanStore.ts`
  - `src/theme/appTheme.ts`

## `/settings` — Settings

Entry: `app/settings.tsx`

- `app/settings.tsx`
  - `src/components/ui/AppCard.tsx`
  - `src/components/ui/AppScreen.tsx`
  - `src/context/PreferencesContext.tsx`
  - `src/theme/appTheme.ts`

## `/feature-request` — Suggest a Feature

Entry: `app/feature-request.tsx`

- `app/feature-request.tsx`
  - `src/components/ui/AppButton.tsx`
  - `src/components/ui/AppCard.tsx`
  - `src/components/ui/AppScreen.tsx`
  - `src/services/feedback.ts`
  - `src/theme/appTheme.ts`
  - `src/types/models.ts`
