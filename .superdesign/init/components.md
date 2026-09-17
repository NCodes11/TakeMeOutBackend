# Shared UI components

## `src/components/ui/AppButton.tsx`

Exports the filled primary CTA, outlined secondary action, and text-only ghost action used across app routes.

```tsx
import { ComponentProps } from 'react';
import { Insets, StyleSheet } from 'react-native';
import { Button, useTheme } from 'react-native-paper';
import { spacing } from '@/theme/appTheme';

type ButtonProps = ComponentProps<typeof Button>;

const hitSlop: Insets = { top: 8, right: 8, bottom: 8, left: 8 };

export const PrimaryButton = ({ children, contentStyle, style, ...props }: ButtonProps) => {
  const theme = useTheme();

  return (
    <Button
      mode="contained"
      contentStyle={[styles.content, contentStyle]}
      style={[
        styles.primary,
        {
          backgroundColor: theme.colors.primary,
          shadowColor: theme.colors.primary,
        },
        style,
      ]}
      hitSlop={hitSlop}
      labelStyle={styles.primaryLabel}
      {...props}
    >
      {children}
    </Button>
  );
};

export const SecondaryButton = ({ children, contentStyle, style, ...props }: ButtonProps) => {
  const theme = useTheme();

  return (
    <Button
      mode="outlined"
      contentStyle={[styles.content, contentStyle]}
      style={[
        styles.secondary,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.outline,
        },
        style,
      ]}
      hitSlop={hitSlop}
      labelStyle={[styles.secondaryLabel, { color: theme.colors.onSurface }]}
      {...props}
    >
      {children}
    </Button>
  );
};

export const GhostButton = ({ children, contentStyle, style, ...props }: ButtonProps) => {
  const theme = useTheme();

  return (
    <Button
      mode="text"
      contentStyle={[styles.content, contentStyle]}
      style={style}
      hitSlop={hitSlop}
      labelStyle={[styles.ghostLabel, { color: theme.colors.primary }]}
      {...props}
    >
      {children}
    </Button>
  );
};

const styles = StyleSheet.create({
  content: {
    minHeight: 50,
    paddingHorizontal: spacing.md,
  },

  primary: {
    borderRadius: 12,
    marginTop: spacing.sm,
    shadowOpacity: 0.20,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },

  primaryLabel: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0,
  },

  secondary: {
    borderRadius: 12,
    borderWidth: 1,
  },

  secondaryLabel: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0,
  },

  ghostLabel: {
    fontWeight: '700',
    letterSpacing: 0,
  },
});
```

## `src/components/ui/AppCard.tsx`

Shared theme-aware surface for all card sections.

```tsx
import { ReactNode } from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { Card, useTheme } from 'react-native-paper';

interface AppCardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const AppCard = ({ children, style }: AppCardProps) => {
  const theme = useTheme();

  return (
    <Card
      mode="contained"
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.outline,
          shadowColor: theme.colors.shadow,
        },
        style,
      ]}
    >
      {children}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 8,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
});
```

## `src/components/ui/ChoiceButtonGroup.tsx`

Reusable wrapping choice grid used by the plan wizard.

```tsx
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

export const ChoiceButtonGroup = <T extends string>({
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
                ? {
                    backgroundColor: theme.colors.primaryContainer,
                    borderColor: theme.colors.primary,
                  }
                : {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.outline,
                  },
            ]}
            labelStyle={[
              styles.label,
              {
                color: selected ? theme.colors.onPrimaryContainer : theme.colors.onSurface,
              },
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
    borderRadius: 12,
    borderWidth: 1,
  },
  buttonContent: {
    minHeight: 48,
    paddingHorizontal: spacing.sm,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 20,
    textAlign: 'center',
  },
});
```

## `src/components/ui/index.ts`

Public barrel for the shared UI layer.

```ts
export * from './AppButton';
export * from './AppCard';
export * from './AppScreen';
export * from './ChoiceButtonGroup';
```
