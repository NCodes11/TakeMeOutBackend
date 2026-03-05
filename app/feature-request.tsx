import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Vibration, View } from 'react-native';
import { SegmentedButtons, Snackbar, Text, TextInput } from 'react-native-paper';
import { AppCard, AppScreen, PrimaryButton } from '@/components/ui';
import { submitFeatureRequest } from '@/services/feedback';
import { FeatureRequestCategory } from '@/types/models';
import { palette, spacing } from '@/theme/appTheme';

const categories: { value: 'none' | FeatureRequestCategory; label: string }[] = [
  // Lightweight beta categories for quick triage in exports/backends.
  { value: 'none', label: 'No category' },
  { value: 'New Feature', label: 'New Feature' },
  { value: 'Bug Report', label: 'Bug Report' },
  { value: 'UI Improvement', label: 'UI Improvement' },
  { value: 'Other', label: 'Other' },
];

export default function FeatureRequestScreen() {
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState<'none' | FeatureRequestCategory>('none');
  const [pending, setPending] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);

  const onSubmit = async () => {
    if (pending) return;
    // Submissions are async + tolerant: local save first, optional remote sync in background.
    setPending(true);
    Vibration.vibrate(10);
    await submitFeatureRequest({
      message: message.trim(),
      category: category === 'none' ? undefined : category,
    });
    setMessage('');
    setCategory('none');
    setPending(false);
    setToastVisible(true);
  };

  return (
    <AppScreen title="Suggest a Feature">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <AppCard>
          <View style={styles.content}>
            <TextInput
              label="What would you love to see added to Take Me Out?"
              placeholder={'Group planning\nSaved trips\nFilters by vibe\nWeather-aware trips\nBudget estimates'}
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={6}
              mode="outlined"
              style={styles.input}
            />
            <View>
              <Text variant="titleSmall" style={styles.label}>
                Optional category
              </Text>
              <SegmentedButtons
                value={category}
                onValueChange={(next) => setCategory(next as 'none' | FeatureRequestCategory)}
                buttons={categories}
                style={styles.segmented}
              />
            </View>
            <PrimaryButton onPress={onSubmit} loading={pending} disabled={pending}>
              Send Suggestion
            </PrimaryButton>
          </View>
        </AppCard>
      </KeyboardAvoidingView>
      <Snackbar visible={toastVisible} onDismiss={() => setToastVisible(false)} duration={2200}>
        Thanks for helping shape Take Me Out!
      </Snackbar>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    padding: spacing.md,
  },
  input: {
    backgroundColor: palette.surface,
  },
  segmented: {
    marginTop: spacing.sm,
  },
  label: {
    color: palette.text,
    fontWeight: '600',
  },
});
