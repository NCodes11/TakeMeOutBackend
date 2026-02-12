import { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { Card } from 'react-native-paper';
import { palette } from '@/theme/appTheme';

interface AppCardProps {
  children: ReactNode;
}

export const AppCard = ({ children }: AppCardProps) => (
  <Card style={styles.card} mode="contained">
    {children}
  </Card>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: 16,
  },
});
