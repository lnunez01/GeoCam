import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';

export default function LoginScreen() {
  const { signIn, signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (action: typeof signIn) => {
    if (!email.trim() || password.length < 6) {
      return setMessage('Escribe tu correo y una contraseña de al menos 6 caracteres.');
    }
    setBusy(true);
    setMessage(null);
    // No hay router.replace: al cambiar la sesión, Stack.Protected cambia de pantalla solo
    setMessage(await action(email, password));
    setBusy(false);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.logo}>📷</Text>
      <Text style={styles.title}>GeoCam</Text>
      <Text style={styles.subtitle}>Inicia sesión para respaldar tus fotos en la nube</Text>

      <TextInput
        style={styles.input}
        placeholder="Correo"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Contraseña"
        placeholderTextColor={colors.textMuted}
        secureTextEntry
        textContentType="password"
        value={password}
        onChangeText={setPassword}
      />

      {message && <Text style={styles.message}>{message}</Text>}

      <Pressable
        style={({ pressed }) => [styles.button, (pressed || busy) && { opacity: 0.7 }]}
        disabled={busy}
        onPress={() => submit(signIn)}
      >
        {busy ? (
          <ActivityIndicator color={colors.background} />
        ) : (
          <Text style={styles.buttonText}>Iniciar sesión</Text>
        )}
      </Pressable>
      <Pressable style={styles.link} disabled={busy} onPress={() => submit(signUp)}>
        <Text style={styles.linkText}>Crear cuenta</Text>
      </Pressable>

      <StatusBar style="light" />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    gap: 12,
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  logo: { fontSize: 48, textAlign: 'center' },
  title: { color: colors.text, fontSize: 32, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: colors.textMuted, textAlign: 'center', marginBottom: 12 },
  input: {
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
  },
  message: { color: colors.danger },
  button: {
    backgroundColor: colors.accent,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonText: { color: colors.background, fontWeight: '700', fontSize: 16 },
  link: { alignItems: 'center', padding: 8 },
  linkText: { color: colors.accent, fontWeight: '600' },
});
