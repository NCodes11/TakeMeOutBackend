import { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { Card, useTheme } from 'react-native-paper';

interface AppCardProps {
  children: ReactNode;
}

export const AppCard = ({ children }: AppCardProps) => {
  const theme = useTheme();

  return (
    <Card
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.outline,
        },
      ]}
      mode="contained"
    >
      {children}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
  },
});
