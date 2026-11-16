import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Chip } from '@/components/Chip';
import { colors } from '@/constants/theme';
import { usePerfil } from '@/hooks/usePerfil';
import { NIVELES, TEMAS, type Perfil } from '@/types/ai';

const headerOptions = {
  headerShown: true,
  title: 'Perfil del tutor',
  headerTransparent: false, // SDK 58: en iOS 26+ sería transparente por defecto
  headerStyle: { backgroundColor: colors.background },
  headerTintColor: colors.text,
  contentStyle: { backgroundColor: colors.background },
} as const;

/** C2: datos con los que el servidor adapta las instrucciones del Tutor IA (los valida con zod). */
export default function PerfilScreen() {
  const router = useRouter();
  const { perfil, save } = usePerfil();
  const [draft, setDraft] = useState<Perfil>(perfil);

  const guardar = () => {
    save(draft);
    Alert.alert('Perfil guardado', 'El tutor usará estos datos desde tu próximo mensaje.');
    router.back();
  };

  return (
    <ScrollView style={styles.fill} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={headerOptions} />

      <View style={styles.section}>
        <Text style={styles.label}>¿Cómo te llamas?</Text>
        <TextInput
          value={draft.nombre}
          onChangeText={(nombre) => setDraft((d) => ({ ...d, nombre }))}
          placeholder="Tu nombre"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          maxLength={40}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Tema que más te interesa</Text>
        <View style={styles.chips}>
          {TEMAS.map((t) => (
            <Chip
              key={t.value}
              label={t.label}
              active={draft.tema === t.value}
              onPress={() => setDraft((d) => ({ ...d, tema: t.value }))}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Tu nivel</Text>
        <View style={styles.chips}>
          {NIVELES.map((n) => (
            <Chip
              key={n.value}
              label={n.label}
              active={draft.nivel === n.value}
              onPress={() => setDraft((d) => ({ ...d, nivel: n.value }))}
            />
          ))}
        </View>
      </View>

      <Text style={styles.hint}>
        Se guarda solo en este teléfono y viaja con cada mensaje. El servidor revisa cada dato: si algo no es
        válido, usa un valor por defecto.
      </Text>

      <Pressable onPress={guardar} style={styles.button}>
        <Text style={styles.buttonText}>Guardar</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 20 },
  section: { gap: 8 },
  label: { color: colors.text, fontWeight: '700', fontSize: 15 },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hint: { color: colors.textMuted, fontSize: 12 },
  button: { backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  buttonText: { color: colors.background, fontWeight: '700', fontSize: 16 },
});
