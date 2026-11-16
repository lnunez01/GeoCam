import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/theme';
import type { Tarjeta } from '@/services/tarjetas';

interface Props {
  visible: boolean;
  loading: boolean;
  error: string | null;
  tarjetas: Tarjeta[];
  onClose: () => void;
}

/** C3: tarjetas de repaso. Toca una para ver la respuesta. */
export function TarjetasModal({ visible, loading, error, tarjetas, onClose }: Props) {
  const [abiertas, setAbiertas] = useState<Set<number>>(new Set());

  const toggle = (i: number) =>
    setAbiertas((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.title}>Tarjetas de repaso</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.close}>Cerrar</Text>
          </Pressable>
        </View>

        {loading && (
          <View style={styles.center}>
            <ActivityIndicator color={colors.accent} size="large" />
            <Text style={styles.muted}>Generando tarjetas con tu conversación…</Text>
          </View>
        )}
        {!loading && error && <Text style={styles.error}>{error}</Text>}

        {!loading && !error && (
          <ScrollView contentContainerStyle={styles.list}>
            {tarjetas.map((t, i) => (
              <Pressable key={i} onPress={() => toggle(i)} style={styles.card}>
                <Text style={styles.number}>Tarjeta {i + 1}</Text>
                <Text style={styles.question}>{t.pregunta}</Text>
                {abiertas.has(i) ? (
                  <Text style={styles.answer}>{t.respuesta}</Text>
                ) : (
                  <Text style={styles.hint}>Toca para ver la respuesta</Text>
                )}
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: colors.background, padding: 16, gap: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: colors.text, fontSize: 22, fontWeight: '800' },
  close: { color: colors.accent, fontWeight: '700' },
  center: { alignItems: 'center', gap: 12, marginTop: 48 },
  muted: { color: colors.textMuted },
  error: { color: colors.danger, textAlign: 'center', marginTop: 24 },
  list: { gap: 12, paddingBottom: 32 },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 16, gap: 8 },
  number: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  question: { color: colors.text, fontSize: 16, fontWeight: '700' },
  answer: { color: colors.text, fontSize: 15 },
  hint: { color: colors.textMuted, fontSize: 12 },
});
