import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, Vibration, View } from 'react-native';
import {
  AppScreen,
  ChipGroup,
  Dock,
  Notice,
  PrimaryButton,
  SectionLabel,
  UnderlineInput,
} from '@/components/ui';
import { submitFeatureRequest } from '@/services/feedback';
import { FeatureRequestCategory } from '@/types/models';
import { fonts, useAppPalette } from '@/theme/appTheme';

type Category = 'none' | FeatureRequestCategory;

const categories: readonly { value: Category; label: string }[] = [
  { value: 'none', label: 'No category' },
  { value: 'New Feature', label: 'New feature' },
  { value: 'Bug Report', label: 'Bug' },
  { value: 'UI Improvement', label: 'UI improvement' },
  { value: 'Other', label: 'Other' },
];

export default function FeatureRequestScreen() {
  const p = useAppPalette();
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState<Category>('none');
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  const canSend = message.trim().length > 0 && !pending;

  const onSubmit = async () => {
    if (!canSend) return;
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
    setSent(true);
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <AppScreen
        title="Suggest a feature"
        subtitle="Product ideas, rough edges, or anything that would make a day out better."
        dockSpace
      >
        <SectionLabel first>Your idea</SectionLabel>
        <UnderlineInput
          placeholder="What would you love to see in Take Me Out?"
          value={message}
          onChangeText={(next) => {
            setMessage(next);
            if (sent) setSent(false);
          }}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
          style={styles.textarea}
        />
        <Text style={[styles.hint, { color: p.textLow }]}>
          Examples: group planning, weather-aware days, budget estimates.
        </Text>

        <SectionLabel>Category</SectionLabel>
        <ChipGroup options={categories} value={category} onChange={setCategory} />

        {sent ? (
          <View style={styles.sent}>
            <Notice tone="violet" title="Sent — thank you">
              Your suggestion helps shape what comes next.
            </Notice>
          </View>
        ) : null}
      </AppScreen>

      <Dock>
        <PrimaryButton icon="send-outline" onPress={onSubmit} loading={pending} disabled={!canSend}>
          Send suggestion
        </PrimaryButton>
      </Dock>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  textarea: {
    minHeight: 120,
    paddingTop: 10,
  },
  hint: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 10,
  },
  sent: {
    marginTop: 24,
  },
});
