import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';

export function Card({ children, style }: ViewProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

interface StatCardProps extends ViewProps {
  label: string;
  value: string;
  valueColor?: string;
  gradient?: readonly [string, string, ...string[]];
  hints?: string[];
}

export function StatCard({
  label,
  value,
  valueColor,
  gradient,
  hints,
  style,
}: StatCardProps) {
  return (
    <View style={[styles.statCard, style]}>
      {gradient && gradient.length >= 2 ? (
        <LinearGradient
          colors={[...gradient]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      ) : null}
      <ThemedText style={styles.statLabel}>{label}</ThemedText>
      <ThemedText style={[styles.statValue, { color: valueColor ?? Colors.text }]}>
        {value}
      </ThemedText>
      {hints?.map((h) => <ThemedText key={h} style={styles.statHint}>{h}</ThemedText>)}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 14,
  },
  statCard: {
    flex: 1,
    borderRadius: 18,
    padding: 18,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    gap: 8,
  },
  statLabel: {
    fontSize: 13,
    color: Colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  statValue: { fontSize: 19, fontWeight: '700' },
  statHint: { fontSize: 11, color: Colors.muted },
});