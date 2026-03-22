import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Vibration,
  View,
} from 'react-native';
import { Modal, Portal, Text, TextInput, useTheme } from 'react-native-paper';
import { PrimaryButton, SecondaryButton } from '@/components/ui';
import { Plan, Stop } from '@/types/models';
import { submitTripFeedback } from '@/services/feedback';
import { spacing } from '@/theme/appTheme';

interface FeedbackModalProps {
  visible: boolean;
  plan: Plan;
  stops: Stop[];
  onDismiss: () => void;
  onSubmitted: () => void;
}

export const FeedbackModal = ({ visible, plan, stops, onDismiss, onSubmitted }: FeedbackModalProps) => {
  const theme = useTheme();
  const [thumbsUp, setThumbsUp] = useState<boolean | null>(null);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const upScale = useRef(new Animated.Value(1)).current;
  const downScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Reset local modal state every time it closes so each session starts clean.
    if (!visible) {
      setThumbsUp(null);
      setMessage('');
      setPending(false);
      setSubmitted(false);
      upScale.setValue(1);
      downScale.setValue(1);
    }
  }, [downScale, upScale, visible]);

  const animateChoice = (isUp: boolean) => {
    Vibration.vibrate(10);
    Animated.spring(isUp ? upScale : downScale, {
      toValue: 1.08,
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

  const selectedHint = useMemo(() => {
    if (thumbsUp == null) return null;
    return thumbsUp ? 'Great. What worked best?' : 'Thanks. What should be improved?';
  }, [thumbsUp]);

  const onSend = async () => {
    if (thumbsUp == null || pending) return;
    setPending(true);
    Vibration.vibrate(10);
    await submitTripFeedback({
      plan,
      stops,
      thumbsUp,
      feedbackText: message,
    });
    setPending(false);
    setSubmitted(true);
  };

  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }]}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {submitted ? (
            <View style={styles.content}>
              <Text variant="titleMedium" style={[styles.title, { color: theme.colors.onSurface }]}>
                Thanks! Your feedback helps make Take Me Out better.
              </Text>
              <PrimaryButton onPress={onSubmitted}>Done</PrimaryButton>
            </View>
          ) : (
            <View style={styles.content}>
              <Text variant="titleLarge" style={[styles.title, { color: theme.colors.onSurface }]}>
                How was your day?
              </Text>
              <View style={styles.choiceRow}>
                <Animated.View style={{ transform: [{ scale: upScale }], flex: 1 }}>
                  <Pressable
                    style={[
                      styles.choice,
                      {
                        borderColor: theme.colors.outline,
                        backgroundColor: theme.colors.surfaceVariant,
                      },
                      thumbsUp === true && {
                        borderColor: theme.colors.primary,
                        backgroundColor: theme.colors.primaryContainer,
                      },
                    ]}
                    onPress={() => {
                      setThumbsUp(true);
                      animateChoice(true);
                    }}
                  >
                    <Text style={styles.emoji}>👍</Text>
                    <Text style={[styles.choiceLabel, { color: theme.colors.onSurface }]}>Loved it</Text>
                  </Pressable>
                </Animated.View>
                <Animated.View style={{ transform: [{ scale: downScale }], flex: 1 }}>
                  <Pressable
                    style={[
                      styles.choice,
                      {
                        borderColor: theme.colors.outline,
                        backgroundColor: theme.colors.surfaceVariant,
                      },
                      thumbsUp === false && {
                        borderColor: theme.colors.primary,
                        backgroundColor: theme.colors.primaryContainer,
                      },
                    ]}
                    onPress={() => {
                      setThumbsUp(false);
                      animateChoice(false);
                    }}
                  >
                    <Text style={styles.emoji}>👎</Text>
                    <Text style={[styles.choiceLabel, { color: theme.colors.onSurface }]}>Could be better</Text>
                  </Pressable>
                </Animated.View>
              </View>
              {thumbsUp != null ? (
                <>
                  <Text variant="bodySmall" style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}>
                    {selectedHint}
                  </Text>
                  <TextInput
                    mode="outlined"
                    multiline
                    numberOfLines={4}
                    label="Tell us what worked or what didn't (optional)"
                    placeholder={'Stops were too far apart\nLoved the outdoor suggestions\nWish there were more attractions'}
                    value={message}
                    onChangeText={setMessage}
                    style={[styles.input, { backgroundColor: theme.colors.surface }]}
                  />
                  <PrimaryButton onPress={onSend} loading={pending} disabled={pending}>
                    Send Feedback
                  </PrimaryButton>
                </>
              ) : null}
              <SecondaryButton onPress={onDismiss} disabled={pending}>
                Not now
              </SecondaryButton>
            </View>
          )}
        </KeyboardAvoidingView>
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  modal: {
    margin: spacing.lg,
    padding: spacing.lg,
    borderRadius: 16,
  },
  content: {
    gap: spacing.md,
  },
  title: {
    fontWeight: '700',
  },
  choiceRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  choice: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  emoji: {
    fontSize: 30,
  },
  choiceLabel: {
    fontWeight: '600',
  },
  hint: {},
  input: {},
});
