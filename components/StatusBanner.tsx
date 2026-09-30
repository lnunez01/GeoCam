import { Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '@/constants/theme';

interface Props {
  message: string;
  actionLabel?: string;
  onPress?: () => void;
  tone?: 'warning' | 'danger';
}

/** Banner no bloqueante para comunicar permisos degradados o errores. */
export function StatusBanner({ message, actionLabel, onPress, tone = 'warning' }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={[styles.banner, { backgroundColor: tone === 'warning' ? colors.warning : colors.danger }]}
      accessibilityRole={onPress ? 'button' : 'text'}
    >
      <Text style={styles.text}>{message}</Text>
      {actionLabel && <Text style={styles.action}>{actionLabel}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: { borderRadius: 12, padding: 12, opacity: 0.95 },
  text: { color: '#171717', fontWeight: '500', textAlign: 'center' },
  action: { color: '#171717', fontWeight: '700', textAlign: 'center', marginTop: 4 },
});
