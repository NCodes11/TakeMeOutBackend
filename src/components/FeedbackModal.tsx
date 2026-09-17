import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { GhostButton, PrimaryButton } from '@/components/ui';
import { Plan, Stop } from '@/types/models';
import { submitTripFeedback } from '@/services/feedback';
import { fonts, radius, shadows, spacing, useAppPalette } from '@/theme/appTheme';

interface FeedbackModalProps {
  visible: boolean;
  plan: Plan;
  stops: Stop[];
  onDismiss: () => void;
  onSubmitted: () => void;
}

export const FeedbackModal = ({
  visible,
  plan,
  stops,
  onDismiss,
  onSubmitted,
}: FeedbackModalProps) => {
  const p = useAppPalette();

  const [thumbsUp, setThumbsUp] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const upScale = useRef(new Animated.Value(1)).current;
  const downScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) {
      setThumbsUp(null);
      setPending(false);
      setSubmitted(false);
      upScale.setValue(1);
      downScale.setValue(1);
    }
  }, [downScale, upScale, visible]);

  const animateChoice = (isUp: boolean) => {
    Vibration.vibrate(10);
    Animated.spring(isUp ? upScale : downScale, {
      toValue: 1.06,
      useNativeDriver: true,
      speed: 16,
      bounciness: 8,
    }).start(() => {
      Animated.spring(isUp ? upScale : downScale, {
        toValue: 1,
        useNativeDriver: true,
      }).start();
    });
  };

  const onSend = async () => {
    if (thumbsUp == null || pending) return;

    setPending(true);
    Vibration.vibrate(10);

    try {
      await submitTripFeedback({
        plan,
        stops,
        thumbsUp,
      });
      setSubmitted(true);
    } catch (error) {
      console.error('Failed to open trip feedback page', error);
    } finally {
      setPending(false);
    }
  };

  const Choice = ({
    icon,
    label,
    selected,
    scale,
    onPress,
  }: {
    icon: 'thumb-up-outline' | 'thumb-down-outline';
    label: string;
    selected: boolean;
    scale: Animated.Value;
    onPress: () => void;
  }) => (
    <Animated.View style={{ transform: [{ scale }], flex: 1 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected }}
        onPress={onPress}
        style={[
          styles.choice,
          shadows.raised,
          {
            backgroundColor: selected ? p.violetWash : p.surfaceRaised,
            borderColor: selected ? p.violetFill : p.lineStrong,
            shadowColor: p.shadowColor,
          },
        ]}
      >
        <MaterialCommunityIcons name={icon} size={26} color={p.violetText} />
        <Text style={[styles.choiceLabel, { color: selected ? p.violetText : p.textHigh }]}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <Pressable style={[styles.backdrop, { backgroundColor: p.backdrop }]} onPress={onDismiss} />
        <View style={[styles.sheet, { backgroundColor: p.surfaceRaised, borderColor: p.line }]}>
          <View style={[styles.grabber, { backgroundColor: p.lineStrong }]} />
          {submitted ? (
            <View style={styles.content}>
              <Text style={[styles.title, { color: p.textHigh }]}>Thanks for the note</Text>
              <Text style={[styles.body, { color: p.textMid }]}>
                Your feedback helps make Take Me Out better.
              </Text>
              <PrimaryButton onPress={onSubmitted}>Done</PrimaryButton>
            </View>
          ) : (
            <View style={styles.content}>
              <Text style={[styles.title, { color: p.textHigh }]}>How was your day?</Text>

              <View style={styles.choiceRow}>
                <Choice
                  icon="thumb-up-outline"
                  label="Loved it"
                  selected={thumbsUp === true}
                  scale={upScale}
                  onPress={() => {
                    setThumbsUp(true);
                    animateChoice(true);
                  }}
                />
                <Choice
                  icon="thumb-down-outline"
                  label="Could be better"
                  selected={thumbsUp === false}
                  scale={downScale}
                  onPress={() => {
                    setThumbsUp(false);
                    animateChoice(false);
                  }}
                />
              </View>

              <Text style={[styles.hint, { color: p.textLow }]}>
                Tap send to continue to the feedback form.
              </Text>

              <PrimaryButton
                onPress={onSend}
                loading={pending}
                disabled={pending || thumbsUp == null}
              >
                Send feedback
              </PrimaryButton>

              <View style={styles.notNow}>
                <GhostButton onPress={onDismiss} disabled={pending}>
                  Not now
                </GhostButton>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: spacing.gutter,
    paddingBottom: 28,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginTop: 10,
    marginBottom: 16,
  },
  content: {
    gap: spacing.md,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 24,
    letterSpacing: -0.6,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 14.5,
    lineHeight: 21,
  },
  choiceRow: {
    flexDirection: 'row',
    gap: 10,
  },
  choice: {
    borderWidth: 1,
    borderRadius: radius.media,
    paddingVertical: 20,
    alignItems: 'center',
    gap: 8,
  },
  choiceLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 13.5,
  },
  hint: {
    fontFamily: fonts.body,
    fontSize: 12.5,
  },
  notNow: {
    alignItems: 'center',
  },
});
