import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { AiError } from '@/services/aiErrors';
import { describirFoto } from '@/services/vision';

interface Props {
  photoUri: string;
  /** Descripción guardada en SQLite (null si nunca se describió). */
  saved: string | null;
  isOnline: boolean;
  onSave: (description: string | null) => Promise<void>;
}

/**
 * Semana 10 (T4, T6): "✨ Describir con IA" en el detalle de la foto.
 * La IA solo SUGIERE: el texto queda en un editor y se guarda cuando el usuario lo confirma.
 * Editar y guardar funciona sin red (es SQLite); describir necesita conexión.
 */
export function AiDescription({ photoUri, saved, isOnline, onSave }: Props) {
  const { signOut } = useAuth();
  const [draft, setDraft] = useState(saved ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = draft.trim() !== (saved ?? '').trim();

  const describir = async () => {
    setLoading(true);
    setError(null);
    try {
      setDraft(await describirFoto(photoUri)); // sugerencia: todavía no se guarda
    } catch (e) {
      const ai = e instanceof AiError ? e : null;
      setError(ai?.message ?? 'No se pudo describir la foto.');
      if (ai?.kind === 'session') void signOut(); // token vencido: de vuelta al login
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.box}>
      <Text style={styles.privacy}>
        🔒 Al describirla, la foto (reducida) se envía a Google Gemini. La descripción se guarda en tu teléfono y
        se sincroniza con tu cuenta.
      </Text>

      <Pressable
        onPress={describir}
        disabled={!isOnline || loading}
        style={[styles.aiButton, (!isOnline || loading) && { opacity: 0.4 }]}
        accessibilityRole="button"
      >
        {loading ? (
          <ActivityIndicator color={colors.background} />
        ) : (
          <Text style={styles.aiButtonText}>✨ Describir con IA</Text>
        )}
      </Pressable>
      {!isOnline && <Text style={styles.warning}>Sin conexión: necesitas internet para describir la foto.</Text>}
      {error && <Text style={styles.error}>{error}</Text>}

      <TextInput
        value={draft}
        onChangeText={setDraft}
        placeholder="Aquí aparece la sugerencia de la IA. Puedes corregirla antes de guardar."
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        multiline
        maxLength={600}
      />
      {dirty && draft.trim() !== '' && (
        <Text style={styles.muted}>La IA puede inventar detalles: revísala antes de guardar.</Text>
      )}
      <Pressable
        onPress={() => onSave(draft.trim() === '' ? null : draft.trim())}
        disabled={!dirty}
        style={[styles.saveButton, !dirty && { opacity: 0.4 }]}
      >
        <Text style={styles.saveText}>{dirty ? 'Guardar descripción' : 'Guardada'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 8 },
  privacy: { color: colors.textMuted, fontSize: 12 },
  aiButton: { backgroundColor: colors.gallery, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  aiButtonText: { color: colors.background, fontWeight: '700', fontSize: 15 },
  warning: { color: colors.warning, fontSize: 12 },
  error: { color: colors.danger, fontSize: 13 },
  input: {
    minHeight: 80,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    color: colors.text,
    textAlignVertical: 'top',
  },
  muted: { color: colors.textMuted, fontSize: 12 },
  saveButton: { backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  saveText: { color: colors.background, fontWeight: '700' },
});
