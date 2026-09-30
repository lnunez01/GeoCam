import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/theme';
import type { PermissionState } from '@/types/geo';

interface SecondaryAction {
  label: string;
  onPress: () => void;
}

interface Props {
  title: string;
  description: string;
  state: PermissionState;
  onRequest: () => void;
  onOpenSettings: () => void;
  /** Acción alternativa para degradar con elegancia (p. ej. importar de galería). */
  secondaryAction?: SecondaryAction;
}

/**
 * Pantalla previa de explicación. El diálogo del sistema SOLO se muestra
 * cuando el usuario toca "Permitir acceso" (pedir en contexto).
 */
export function PermissionPrimer({
  title,
  description,
  state,
  onRequest,
  onOpenSettings,
  secondaryAction,
}: Props) {
  const isBlocked = state === 'blocked';
  const isDenied = state === 'denied';

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{isBlocked ? '🔒' : '📷'}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>
        {isBlocked
          ? 'Desactivaste este permiso. Puedes habilitarlo desde los Ajustes del sistema.'
          : description}
      </Text>
      {isDenied && (
        <Text style={styles.hint}>
          Rechazaste el permiso. Puedes volver a intentarlo cuando quieras.
        </Text>
      )}

      <Pressable
        onPress={isBlocked ? onOpenSettings : onRequest}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>{isBlocked ? 'Abrir Ajustes' : 'Permitir acceso'}</Text>
      </Pressable>

      {secondaryAction && (
        <Pressable
          onPress={secondaryAction.onPress}
          style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryText}>{secondaryAction.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    backgroundColor: colors.background,
    paddingHorizontal: 32,
  },
  icon: { fontSize: 48 },
  title: { color: colors.text, fontSize: 24, fontWeight: '700', textAlign: 'center' },
  description: { color: colors.textMuted, fontSize: 16, textAlign: 'center' },
  hint: { color: colors.warning, fontSize: 14, textAlign: 'center' },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  buttonText: { color: colors.background, fontWeight: '600', fontSize: 16 },
  secondary: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  secondaryText: { color: colors.text, fontWeight: '500' },
  pressed: { opacity: 0.8 },
});
