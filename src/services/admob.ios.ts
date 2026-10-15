import mobileAds, {
  AdEventType,
  AdsConsent,
  AdsConsentPrivacyOptionsRequirementStatus,
  InterstitialAd,
  TestIds,
} from 'react-native-google-mobile-ads';

type InterstitialAdInstance = ReturnType<typeof InterstitialAd.createForAdRequest>;
type ConsentInfo = Awaited<ReturnType<typeof AdsConsent.getConsentInfo>>;

const IOS_INTERSTITIAL_AD_UNIT_ID = 'ca-app-pub-9884050953952460/6246309683';

let initialization: Promise<void> | null = null;
let adsCanBeRequested = false;
let privacyOptionsRequired = false;
let interstitial: InterstitialAdInstance | null = null;
let interstitialReady = false;
let isShowingInterstitial = false;
let interstitialListeners: Array<() => void> = [];
const completedPlanIds = new Set<string>();

const logAdError = (scope: string, error: unknown) => {
  // TestFlight is a release build, so keep load and consent failures available
  // in device logs while the ad integration is being verified.
  console.warn(`[admob] ${scope}`, error);
};

const applyConsentInfo = (consentInfo: ConsentInfo) => {
  privacyOptionsRequired =
    consentInfo.privacyOptionsRequirementStatus ===
    AdsConsentPrivacyOptionsRequirementStatus.REQUIRED;
  adsCanBeRequested = consentInfo.canRequestAds;
};

const clearInterstitial = (ad: InterstitialAdInstance) => {
  if (interstitial !== ad) return;

  interstitialListeners.forEach((unsubscribe) => unsubscribe());
  interstitialListeners = [];
  interstitial = null;
  interstitialReady = false;
  ad.destroy();
};

export const initializeMobileAds = async (): Promise<void> => {
  if (!initialization) {
    initialization = (async () => {
      try {
        let consentInfo: ConsentInfo;

        try {
          consentInfo = await AdsConsent.gatherConsent();
        } catch (error) {
          // UMP can still have usable consent from an earlier session when the
          // current consent refresh fails.
          logAdError('consent refresh failed', error);
          consentInfo = await AdsConsent.getConsentInfo();
        }

        applyConsentInfo(consentInfo);

        if (!adsCanBeRequested) return;

        await mobileAds().initialize();
        adsCanBeRequested = true;
      } catch (error) {
        // If consent or SDK initialization fails, the trip still completes and
        // the app simply skips the optional ad.
        logAdError('initialization failed', error);
      }
    })();
  }

  await initialization;
};

export const preloadEndOfTripInterstitial = async (): Promise<void> => {
  await initializeMobileAds();
  if (!adsCanBeRequested || interstitial) return;

  try {
    const nextInterstitial = InterstitialAd.createForAdRequest(
      __DEV__ ? TestIds.INTERSTITIAL : IOS_INTERSTITIAL_AD_UNIT_ID,
      { requestNonPersonalizedAdsOnly: true },
    );

    interstitial = nextInterstitial;
    interstitialListeners = [
      nextInterstitial.addAdEventListener(AdEventType.LOADED, () => {
        if (interstitial === nextInterstitial) {
          interstitialReady = true;
        }
      }),
      nextInterstitial.addAdEventListener(AdEventType.ERROR, (error) => {
        logAdError('interstitial failed to load', error);
        if (interstitial === nextInterstitial && !isShowingInterstitial) {
          clearInterstitial(nextInterstitial);
        }
      }),
    ];

    nextInterstitial.load();
  } catch (error) {
    logAdError('interstitial setup failed', error);
    if (interstitial) clearInterstitial(interstitial);
  }
};

export const showEndOfTripInterstitial = async (planId: string): Promise<void> => {
  if (!planId || completedPlanIds.has(planId) || isShowingInterstitial) return;

  const activeInterstitial = interstitial;
  if (
    !adsCanBeRequested ||
    !activeInterstitial ||
    !interstitialReady ||
    !activeInterstitial.loaded ||
    isShowingInterstitial
  ) {
    void preloadEndOfTripInterstitial();
    return;
  }

  isShowingInterstitial = true;
  interstitialReady = false;

  await new Promise<void>((resolve) => {
    let settled = false;
    let removeClosed: () => void = () => {};
    let removeError: () => void = () => {};
    let removeOpened: () => void = () => {};

    const finish = () => {
      if (settled) return;
      settled = true;
      removeClosed();
      removeError();
      removeOpened();
      isShowingInterstitial = false;
      clearInterstitial(activeInterstitial);
      void preloadEndOfTripInterstitial();
      resolve();
    };

    removeClosed = activeInterstitial.addAdEventListener(AdEventType.CLOSED, finish);
    removeError = activeInterstitial.addAdEventListener(AdEventType.ERROR, finish);
    removeOpened = activeInterstitial.addAdEventListener(AdEventType.OPENED, () => {
      completedPlanIds.add(planId);
    });

    try {
      void activeInterstitial.show().catch(finish);
    } catch (error) {
      logAdError('interstitial could not be shown', error);
      finish();
    }
  });
};

export const hasAdPrivacyOptions = async (): Promise<boolean> => {
  await initializeMobileAds();
  return privacyOptionsRequired;
};

export const showAdPrivacyOptions = async (): Promise<void> => {
  if (!privacyOptionsRequired) return;

  try {
    await AdsConsent.showPrivacyOptionsForm();
    const consentInfo = await AdsConsent.getConsentInfo();
    privacyOptionsRequired =
      consentInfo.privacyOptionsRequirementStatus ===
      AdsConsentPrivacyOptionsRequirementStatus.REQUIRED;
  } catch (error) {
    logAdError('privacy options could not be shown', error);
  }
};
