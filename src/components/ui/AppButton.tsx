import { ComponentProps } from 'react';
import { Insets, StyleSheet } from 'react-native';
import { Button, useTheme } from 'react-native-paper';
import { spacing } from '@/theme/appTheme';

type ButtonProps = ComponentProps<typeof Button>;

const hitSlop: Insets = { top: 8, right: 8, bottom: 8, left: 8 };

export const PrimaryButton = ({ children, contentStyle, ...props }: ButtonProps) => {
  const theme = useTheme();

  return (
    <Button
      mode="contained"
      contentStyle={[styles.content, contentStyle]}
      style={[styles.primary, { backgroundColor: theme.colors.primary }]}
      hitSlop={hitSlop}
      {...props}
    >
      {children}
    </Button>
  );
};

export const SecondaryButton = ({ children, contentStyle, ...props }: ButtonProps) => {
  const theme = useTheme();

  return (
    <Button
      mode="outlined"
      contentStyle={[styles.content, contentStyle]}
      style={[styles.secondary, { borderColor: theme.colors.outline }]}
      textColor={theme.colors.onSurface}
      hitSlop={hitSlop}
      {...props}
    >
      {children}
    </Button>
  );
};

export const GhostButton = ({ children, contentStyle, ...props }: ButtonProps) => (
  <Button mode="text" contentStyle={[styles.content, contentStyle]} hitSlop={hitSlop} {...props}>
    {children}
  </Button>
);

const styles = StyleSheet.create({
  content: {
    minHeight: 44,
    paddingHorizontal: spacing.sm,
  },
  primary: {
    borderRadius: 12,
  },
  secondary: {
    borderRadius: 12,
  },
});
