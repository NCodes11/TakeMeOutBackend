// Ads are configured for the iOS App Store build. Metro resolves
// admob.ios.ts on iOS and uses these no-op exports on other platforms.
export const initializeMobileAds = async (): Promise<void> => undefined;

export const preloadEndOfTripInterstitial = async (): Promise<void> => undefined;

export const showEndOfTripInterstitial = async (planId: string): Promise<void> => {
  void planId;
};

export const hasAdPrivacyOptions = async (): Promise<boolean> => false;

export const showAdPrivacyOptions = async (): Promise<void> => undefined;
