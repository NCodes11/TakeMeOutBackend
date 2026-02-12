import { ComponentProps } from 'react';
import { Insets, StyleSheet } from 'react-native';
import { Button } from 'react-native-paper';
import { palette, spacing } from '@/theme/appTheme';

type ButtonProps = ComponentProps<typeof Button>;

const hitSlop: Insets = { top: 8, right: 8, bottom: 8, left: 8 };

export const PrimaryButton = ({ children, contentStyle, ...props }: ButtonProps) => (
  <Button mode="contained" contentStyle={[styles.content, contentStyle]} style={styles.primary} hitSlop={hitSlop} {...props}>
    {children}
  </Button>
);

export const SecondaryButton = ({ children, contentStyle, ...props }: ButtonProps) => (
  <Button mode="outlined" contentStyle={[styles.content, contentStyle]} style={styles.secondary} hitSlop={hitSlop} {...props}>
    {children}
  </Button>
);

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
    backgroundColor: palette.primary,
  },
  secondary: {
    borderRadius: 12,
    borderColor: palette.border,
  },
});
