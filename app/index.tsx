import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import tmoLogo from '@/assets/images/tmo-logo.png';
import {
  GhostButton,
  MonoLabel,
  Notice,
  PrimaryButton,
  Segmented,
  UnderlineInput,
} from '@/components/ui';
import { useLocation } from '@/context/LocationContext';
import { fonts, spacing, useAppPalette } from '@/theme/appTheme';

type StartMode = 'live' | 'manual';

export default function HomeScreen() {
  const p = useAppPalette();
  const location = useLocation();
  const params = useLocalSearchParams<{ capture?: string }>();
  const captureMode = __DEV__ && params.capture === '1';

  const [editing, setEditing] = useState(false);
  const [draftCity, setDraftCity] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mode: StartMode = location.mode === 'manual' ? 'manual' : 'live';
  const displayPlaceLabel = captureMode ? 'Raymond, NH' : location.placeLabel;
  const liveWaiting = mode === 'live' && !displayPlaceLabel;
  const liveDenied = mode === 'live' && location.permission === 'denied';

  const startLabel = displayPlaceLabel
    ? displayPlaceLabel
    : liveDenied
      ? 'Location access is off'
      : mode === 'live'
        ? 'Finding your location…'
        : 'Enter a city';

  const openEditor = () => {
    setDraftCity(mode === 'manual' ? location.placeLabel : '');
    setError(null);
    setEditing(true);
  };

  const changeMode = async (next: StartMode) => {
    setError(null);
    try {
      if (next === 'live') {
        setBusy(true);
        await location.setMode('live');
        setEditing(false);
      } else {
        await location.setMode('manual');
        setEditing(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update your starting point.');
    } finally {
      setBusy(false);
    }
  };

  const saveManualCity = async () => {
    const trimmed = draftCity.trim();
    if (!trimmed) return;
    Keyboard.dismiss();
    setBusy(true);
    setError(null);
    try {
      await location.setManualLocation(trimmed);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "We couldn't find that place.");
    } finally {
      setBusy(false);
    }
  };

  const startPlan = () => {
    router.push({
      pathname: '/wizard',
      params: {
        city: location.placeLabel,
        locationMode: mode,
        ...(location.coords
          ? {
              originLat: String(location.coords.latitude),
              originLng: String(location.coords.longitude),
            }
          : {}),
      },
    });
  };

  const canStart = Boolean(displayPlaceLabel) && !busy;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: p.canvas }]}>
      {/* Quiet halo + concentric rings behind the logo */}
      <View pointerEvents="none" style={styles.halo}>
        <View style={[styles.haloGlow, { backgroundColor: p.violetDecorative }]} />
        <View style={[styles.haloCore, { backgroundColor: p.violetDecorative }]} />
        <View style={[styles.ring, styles.ringInner, { borderColor: p.line }]} />
        <View style={[styles.ring, styles.ringOuter, { borderColor: p.line }]} />
      </View>

      <View style={styles.body}>
        <View style={styles.brand}>
          <Image
            source={tmoLogo}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="Take Me Out"
          />
          <Text style={[styles.wordmark, { color: p.textHigh }]} accessibilityRole="header">
            TAKE ME <Text style={{ color: p.violetText }}>OUT</Text>
          </Text>
          <Text style={[styles.tagline, { color: p.textMid }]}>
            Tell us when you&apos;re free. We&apos;ll build the whole day.
          </Text>
        </View>

        <View style={styles.spacer} />

        <View style={[styles.startRow, { borderTopColor: p.line, borderBottomColor: p.line }]}>
          <MaterialCommunityIcons name="map-marker-outline" size={22} color={p.violetText} />
          <View style={styles.startCopy}>
            <MonoLabel>Starting point</MonoLabel>
            <View style={styles.startValueRow}>
              <Text style={[styles.startValue, { color: p.textHigh }]} numberOfLines={2}>
                {startLabel}
                {displayPlaceLabel ? (
                  <Text style={[styles.startMode, { color: p.textLow }]}>
                    {mode === 'live' ? '  · current location' : '  · manual'}
                  </Text>
                ) : null}
              </Text>
              {liveWaiting && !liveDenied ? (
                <ActivityIndicator size="small" color={p.violetText} />
              ) : null}
            </View>
          </View>
          <GhostButton onPress={editing ? () => setEditing(false) : openEditor}>
            {editing ? 'Done' : 'Change'}
          </GhostButton>
        </View>

        {editing ? (
          <View style={styles.editor}>
            <Segmented
              value={mode}
              onChange={(v) => void changeMode(v)}
              options={[
                { value: 'live', label: 'My location' },
                { value: 'manual', label: 'Enter a city' },
              ]}
            />
            {mode === 'manual' ? (
              <UnderlineInput
                label="City or address"
                placeholder="Portsmouth, NH"
                value={draftCity}
                onChangeText={setDraftCity}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={saveManualCity}
                right={
                  <Pressable
                    onPress={saveManualCity}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Use this city"
                  >
                    {busy ? (
                      <ActivityIndicator size="small" color={p.violetText} />
                    ) : (
                      <MaterialCommunityIcons
                        name="arrow-right-circle"
                        size={24}
                        color={p.violetText}
                      />
                    )}
                  </Pressable>
                }
              />
            ) : liveDenied ? (
              <Notice tone="signal" title="Location is off for Take Me Out">
                Enable location in Settings, or enter a city instead.
              </Notice>
            ) : null}
            {error ? <Notice>{error}</Notice> : null}
          </View>
        ) : null}

        <PrimaryButton onPress={startPlan} disabled={!canStart} style={styles.cta}>
          Start plan
        </PrimaryButton>

        <View style={styles.links}>
          <GhostButton onPress={() => router.push('/saved')}>Saved plans</GhostButton>
          <GhostButton onPress={() => router.push('/settings')}>Settings</GhostButton>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  halo: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
  },
  haloGlow: {
    position: 'absolute',
    top: 60,
    width: 380,
    height: 380,
    borderRadius: 190,
    opacity: 0.04,
  },
  haloCore: {
    position: 'absolute',
    top: 140,
    width: 230,
    height: 230,
    borderRadius: 115,
    opacity: 0.045,
  },
  ring: {
    position: 'absolute',
    borderWidth: 1,
  },
  ringInner: {
    top: 130,
    width: 250,
    height: 250,
    borderRadius: 125,
  },
  ringOuter: {
    top: 75,
    width: 360,
    height: 360,
    borderRadius: 180,
  },
  body: {
    flex: 1,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  brand: {
    alignItems: 'center',
    marginTop: 112,
    gap: 12,
  },
  logo: {
    width: 110,
    height: 110,
    marginBottom: 10,
  },
  wordmark: {
    fontFamily: fonts.display,
    fontSize: 38,
    lineHeight: 42,
    letterSpacing: -1.2,
    textAlign: 'center',
  },
  tagline: {
    fontFamily: fonts.body,
    fontSize: 14.5,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 260,
  },
  spacer: {
    flex: 1,
  },
  startRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  startCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  startValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  startValue: {
    fontFamily: fonts.bodySemi,
    fontSize: 15.5,
    lineHeight: 21,
    flexShrink: 1,
  },
  startMode: {
    fontFamily: fonts.body,
    fontSize: 14,
  },
  editor: {
    marginTop: 14,
    gap: 14,
  },
  cta: {
    marginTop: 22,
  },
  links: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 10,
  },
});
