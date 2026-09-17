import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Portal, Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { spacing } from '@/theme/appTheme';

type Props = {
  visible: boolean;
  progress: number;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const POUR_VARIANTS = {
  softCascade: {
    shakerTop: -10,
    shakerLeft: 80,
    showStream: true,
    shellTop: 26,
    shellLeft: 102,
    shellWidth: 14,
    shellHeight: 78,
    shellRotate: '0deg',
    bodyWidth: 7,
    bodyHeight: 60,
    highlightLeft: 2,
    flowStart: -48,
    flowMid: -10,
    flowEnd: 20,
  },
  centerCascade: {
    shakerTop: -10,
    shakerLeft: 80,
    showStream: true,
    shellTop: 28,
    shellLeft: 102,
    shellWidth: 14,
    shellHeight: 84,
    shellRotate: '0deg',
    bodyWidth: 7,
    bodyHeight: 70,
    highlightLeft: 2,
    flowStart: -58,
    flowMid: -12,
    flowEnd: 18,
  },
  longCascade: {
    shakerTop: -12,
    shakerLeft: 84,
    showStream: true,
    shellTop: 22,
    shellLeft: 101,
    shellWidth: 16,
    shellHeight: 92,
    shellRotate: '0deg',
    bodyWidth: 8,
    bodyHeight: 78,
    highlightLeft: 3,
    flowStart: -64,
    flowMid: -14,
    flowEnd: 20,
  },
} as const;

const ACTIVE_POUR_VARIANT: keyof typeof POUR_VARIANTS = 'centerCascade';

export function GenerationLoadingOverlay({ visible, progress }: Props) {
  const theme = useTheme();
  const [shouldRender, setShouldRender] = useState(visible);
  const pourVariant = POUR_VARIANTS[ACTIVE_POUR_VARIANT];

  const glassTilt = useRef(new Animated.Value(0)).current;
  const fill = useRef(new Animated.Value(0)).current;
  const pourPhase = useRef(new Animated.Value(0)).current;
  const outflow = useRef(new Animated.Value(0)).current;
  const spill = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(visible ? 1 : 0)).current;

  const pourLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const isExitingRef = useRef(false);

  const targetProgress = clamp(progress, 0, 0.99);

  useEffect(() => {
    const stopPour = () => {
      pourLoopRef.current?.stop();
      pourLoopRef.current = null;
    };

    const resetValues = () => {
      glassTilt.setValue(0);
      fill.setValue(0);
      pourPhase.setValue(0);
      outflow.setValue(0);
      spill.setValue(0);
      fade.setValue(1);
      isExitingRef.current = false;
    };

    const finishHide = () => {
      stopPour();
      fill.stopAnimation();
      outflow.stopAnimation();
      spill.stopAnimation();
      setShouldRender(false);
      resetValues();
    };

    const startPour = () => {
      stopPour();
      pourPhase.setValue(0);
      pourLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pourPhase, {
            toValue: 0.18,
            duration: 260,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(pourPhase, {
            toValue: 0.72,
            duration: 980,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(pourPhase, {
            toValue: 0.84,
            duration: 220,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(pourPhase, {
            toValue: 1,
            duration: 520,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      );
      pourLoopRef.current.start();
    };

    if (visible) {
      setShouldRender(true);
      isExitingRef.current = false;
      glassTilt.setValue(0);
      outflow.setValue(0);
      spill.setValue(0);
      fade.setValue(1);

      Animated.timing(fill, {
        toValue: targetProgress,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();

      startPour();

      return () => {
        stopPour();
      };
    }

    if (!shouldRender || isExitingRef.current) {
      return () => {
        stopPour();
      };
    }

    stopPour();
    isExitingRef.current = true;

    if (targetProgress >= 0.99) {
      Animated.sequence([
        Animated.parallel([
          Animated.timing(outflow, {
            toValue: 1,
            duration: 180,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(glassTilt, {
            toValue: 12,
            duration: 180,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(glassTilt, {
            toValue: 26,
            duration: 260,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(spill, {
            toValue: 1,
            duration: 340,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(fade, {
            toValue: 0,
            duration: 280,
            delay: 90,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ]).start(finishHide);
    } else {
      Animated.timing(fade, {
        toValue: 0,
        duration: 140,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start(finishHide);
    }

    return () => {
      stopPour();
    };
  }, [fade, fill, glassTilt, outflow, pourPhase, shouldRender, spill, targetProgress, visible]);

  useEffect(() => {
    if (!visible || isExitingRef.current) return;

    Animated.timing(fill, {
      toValue: targetProgress,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [fill, targetProgress, visible]);

  if (!shouldRender) return null;

  const glassRotate = glassTilt.interpolate({
    inputRange: [0, 12, 26],
    outputRange: ['0deg', '12deg', '26deg'],
  });

  // The shaker drives the loop so the artwork reads as a real pour, not two static icons.
  const shakerRotate = pourPhase.interpolate({
    inputRange: [0, 0.18, 0.72, 1],
    outputRange: ['-4deg', '9deg', '18deg', '-2deg'],
  });
  const shakerTranslateX = pourPhase.interpolate({
    inputRange: [0, 0.18, 0.72, 1],
    outputRange: [0, 1, 6, 1],
  });
  const shakerTranslateY = pourPhase.interpolate({
    inputRange: [0, 0.18, 0.72, 1],
    outputRange: [0, -1, -5, -1],
  });

  // Keep the stream visually anchored between the shaker mouth and the glass bowl.
  const streamOpacity = pourPhase.interpolate({
    inputRange: [0, 0.18, 0.28, 0.72, 0.84, 1],
    outputRange: [0, 0, 1, 1, 0.15, 0],
  });
  const streamCutoffOpacity = glassTilt.interpolate({
    inputRange: [0, 0.2, 1],
    outputRange: [1, 0, 0],
    extrapolate: 'clamp',
  });
  const visibleStreamOpacity = Animated.multiply(streamOpacity, streamCutoffOpacity);
  const streamTranslateY = pourPhase.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [pourVariant.flowStart, pourVariant.flowMid, pourVariant.flowEnd],
  });
  const splashOpacity = pourPhase.interpolate({
    inputRange: [0, 0.28, 0.38, 0.76, 0.9, 1],
    outputRange: [0, 0, 0.9, 0.8, 0, 0],
  });
  const splashScale = pourPhase.interpolate({
    inputRange: [0, 0.34, 0.76, 1],
    outputRange: [0.7, 1, 1.08, 0.7],
  });

  // Progress still controls the real fill level; the pour loop adds a small active-rise pulse.
  const baseLiquidTranslateY = fill.interpolate({
    inputRange: [0, 0.99],
    outputRange: [28, 0],
  });
  const liquidPulseTranslateY = pourPhase.interpolate({
    inputRange: [0, 0.28, 0.72, 1],
    outputRange: [0, -2, -2, 0],
  });
  const liquidTranslateY = Animated.add(baseLiquidTranslateY, liquidPulseTranslateY);
  const liquidScaleX = spill.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.78],
  });
  const liquidTranslateX = spill.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 18],
  });
  const liquidDumpY = spill.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 34],
  });
  const liquidOpacity = spill.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [1, 0.95, 0],
  });
  const liquidHighlightTranslateX = pourPhase.interpolate({
    inputRange: [0, 1],
    outputRange: [-18, 22],
  });

  const outflowOpacity = outflow.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.95],
  });
  const outflowScaleY = outflow.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const outflowStreamTranslateY = outflow.interpolate({
    inputRange: [0, 1],
    outputRange: [12, 0],
  });
  const outflowPathTranslateX = spill.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 14],
  });
  const outflowDropY = spill.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 78],
  });
  const outflowDropX = spill.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 8],
  });
  const shadowScale = fill.interpolate({
    inputRange: [0, 0.99],
    outputRange: [0.72, 1],
  });

  return (
    <Portal>
      <Animated.View
        style={[
          styles.scrim,
          {
            backgroundColor: theme.colors.backdrop,
            opacity: fade,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.outlineVariant,
              shadowColor: theme.colors.shadow,
              opacity: fade,
              transform: [
                {
                  translateY: fade.interpolate({
                    inputRange: [0, 1],
                    outputRange: [8, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.stage}>
            <Animated.View
              style={[
                styles.shakerWrap,
                {
                  top: pourVariant.shakerTop,
                  left: pourVariant.shakerLeft,
                },
                {
                  transform: [
                    { translateX: shakerTranslateX },
                    { translateY: shakerTranslateY },
                    { rotate: shakerRotate },
                  ],
                },
              ]}
            >
              <View style={styles.shakerIconStack}>
                <MaterialCommunityIcons
                  name="shaker"
                  size={60}
                  color={theme.colors.surfaceVariant}
                  style={styles.shakerIconFill}
                />
                <MaterialCommunityIcons
                  name="shaker-outline"
                  size={72}
                  color={theme.colors.primary}
                  style={styles.shakerIconOutline}
                />
              </View>
            </Animated.View>

            {pourVariant.showStream ? (
              <View
                style={[
                  styles.streamShell,
                  {
                    top: pourVariant.shellTop,
                    left: pourVariant.shellLeft,
                    width: pourVariant.shellWidth,
                    height: pourVariant.shellHeight,
                    transform: [{ rotate: pourVariant.shellRotate }],
                  },
                ]}
              >
                <Animated.View
                  style={[
                    styles.streamBody,
                    {
                      width: pourVariant.bodyWidth,
                      height: pourVariant.bodyHeight,
                      opacity: visibleStreamOpacity,
                      transform: [{ translateY: streamTranslateY }],
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.streamSegmentTop,
                      { backgroundColor: theme.colors.secondary },
                    ]}
                  />
                  <View
                    style={[
                      styles.streamSegmentMiddle,
                      { backgroundColor: theme.colors.secondary },
                    ]}
                  />
                  <View
                    style={[
                      styles.streamSegmentBottom,
                      { backgroundColor: theme.colors.secondary },
                    ]}
                  />
                  <View
                    style={[
                      styles.streamHighlight,
                      {
                        left: pourVariant.highlightLeft,
                        backgroundColor: theme.colors.onPrimary,
                      },
                    ]}
                  />
                </Animated.View>
              </View>
            ) : null}

            <Animated.View style={[styles.glassWrap, { transform: [{ rotate: glassRotate }] }]}>
              <View style={styles.outflowShell}>
                <Animated.View
                  style={[
                    styles.outflowPath,
                    {
                      opacity: outflowOpacity,
                      transform: [
                        { translateX: outflowPathTranslateX },
                        { translateY: outflowStreamTranslateY },
                        { scaleY: outflowScaleY },
                      ],
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.outflowStream,
                      { backgroundColor: theme.colors.secondary },
                    ]}
                  />
                  <Animated.View
                    style={[
                      styles.outflowDrop,
                      {
                        backgroundColor: theme.colors.secondary,
                        transform: [{ translateX: outflowDropX }, { translateY: outflowDropY }],
                      },
                    ]}
                  />
                </Animated.View>
              </View>

              <View
                style={[
                  styles.liquidWindow,
                  { backgroundColor: theme.colors.primaryContainer },
                ]}
              >
                <Animated.View
                  style={[
                    styles.splash,
                    {
                      backgroundColor: theme.colors.secondary,
                      opacity: splashOpacity,
                      transform: [{ scaleX: splashScale }, { scaleY: splashScale }],
                    },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.liquid,
                    {
                      backgroundColor: theme.colors.secondary,
                      opacity: liquidOpacity,
                      transform: [
                        { translateY: liquidTranslateY },
                        { translateX: liquidTranslateX },
                        { translateY: liquidDumpY },
                        { scaleX: liquidScaleX },
                      ],
                    },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.liquidHighlight,
                    {
                      backgroundColor: theme.colors.onPrimary,
                      transform: [{ translateX: liquidHighlightTranslateX }, { rotate: '18deg' }],
                    },
                  ]}
                />
              </View>

              <MaterialCommunityIcons
                name="glass-cocktail"
                size={116}
                color={theme.colors.primary}
              />

              <Animated.View
                style={[
                  styles.shadow,
                  {
                    backgroundColor: theme.colors.primaryContainer,
                    transform: [{ scaleX: shadowScale }],
                  },
                ]}
              />
            </Animated.View>
          </View>

          <Text variant="titleMedium" style={[styles.title, { color: theme.colors.onSurface }]}>
            Making Your Day
          </Text>
          <Text variant="bodySmall" style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
            Finding strong nearby stops and mapping the route.
          </Text>
        </Animated.View>
      </Animated.View>
    </Portal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  stage: {
    width: 208,
    height: 176,
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: spacing.xs,
  },
  shakerWrap: {
    position: 'absolute',
    width: 90,
    height: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shakerIconStack: {
    width: 90,
    height: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shakerIconFill: {
    position: 'absolute',
    top: 14,
    left: 17,
    opacity: 0.95,
  },
  shakerIconOutline: {
    position: 'absolute',
    top: 8,
    left: 10,
  },
  streamShell: {
    position: 'absolute',
    top: 34,
    left: 110,
    width: 28,
    height: 92,
    alignItems: 'center',
    justifyContent: 'flex-start',
    transform: [{ rotate: '18deg' }],
    overflow: 'hidden',
  },
  streamBody: {
    width: 10,
    height: 84,
    borderRadius: 999,
    overflow: 'hidden',
  },
  streamSegmentTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '38%',
    borderTopLeftRadius: 999,
    borderTopRightRadius: 999,
    opacity: 0.92,
  },
  streamSegmentMiddle: {
    position: 'absolute',
    top: '32%',
    left: 0,
    right: 0,
    height: '34%',
    opacity: 0.58,
  },
  streamSegmentBottom: {
    position: 'absolute',
    top: '60%',
    left: 0,
    right: 0,
    bottom: 0,
    borderBottomLeftRadius: 999,
    borderBottomRightRadius: 999,
    opacity: 0.22,
  },
  streamHighlight: {
    position: 'absolute',
    top: 6,
    bottom: 12,
    left: 2,
    width: 2,
    borderRadius: 999,
    opacity: 0.22,
  },
  glassWrap: {
    width: 138,
    height: 148,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outflowShell: {
    position: 'absolute',
    top: 46,
    right: 12,
    width: 28,
    height: 94,
    alignItems: 'center',
    justifyContent: 'flex-start',
    transform: [{ rotate: '22deg' }],
    overflow: 'visible',
  },
  outflowPath: {
    width: 12,
    height: 90,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  outflowStream: {
    width: 6,
    height: 82,
    borderRadius: 999,
  },
  outflowDrop: {
    position: 'absolute',
    top: 70,
    width: 12,
    height: 18,
    borderRadius: 999,
  },
  liquidWindow: {
    position: 'absolute',
    top: 24,
    width: 50,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
  },
  splash: {
    position: 'absolute',
    top: 4,
    left: 13,
    width: 22,
    height: 6,
    borderRadius: 999,
  },
  liquid: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -1,
    height: 30,
    borderRadius: 14,
  },
  liquidHighlight: {
    position: 'absolute',
    top: -8,
    left: -12,
    width: 14,
    height: 48,
    opacity: 0.16,
    borderRadius: 999,
  },
  shadow: {
    position: 'absolute',
    bottom: 8,
    width: 62,
    height: 8,
    borderRadius: 999,
    opacity: 0.45,
  },
  title: {
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    lineHeight: 20,
  },
});
