import { StyleSheet, View } from 'react-native';
import { Button, useTheme } from 'react-native-paper';
import { spacing } from '@/theme/appTheme';

type ChoiceOption<T extends string> = {
  value: T;
  label: string;
};

type ChoiceButtonGroupProps<T extends string> = {
  value: T;
  onValueChange: (value: T) => void;
  options: readonly ChoiceOption<T>[];
};

export const ChoiceButtonGroup = <T extends string,>({
  value,
  onValueChange,
  options,
}: ChoiceButtonGroupProps<T>) => {
  const theme = useTheme();

  return (
    <View style={styles.grid}>
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <Button
            key={option.value}
            mode={selected ? 'contained' : 'outlined'}
            onPress={() => onValueChange(option.value)}
            contentStyle={styles.buttonContent}
            style={[
              styles.button,
              selected
                ? { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
                : { backgroundColor: theme.colors.surface, borderColor: theme.colors.outline },
            ]}
            labelStyle={[
              styles.label,
              { color: selected ? theme.colors.onPrimary : theme.colors.onSurface },
            ]}
          >
            {option.label}
          </Button>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  button: {
    flexBasis: '48%',
    flexGrow: 1,
    borderRadius: 14,
    borderWidth: 1,
  },
  buttonContent: {
    minHeight: 48,
    paddingHorizontal: spacing.sm,
  },
  label: {
    fontSize: 15,
    lineHeight: 20,
    textAlign: 'center',
  },
});
