import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { FileUIPart, UIMessage } from 'ai';
import { MarkdownText } from '@/components/MarkdownText';
import { TarjetasModal } from '@/components/TarjetasModal';
import { colors } from '@/constants/theme';
import { useTutorChat } from '@/hooks/useTutorChat';
import { elegirFoto } from '@/lib/foto';
import { AiError } from '@/services/aiErrors';
import { generarTarjetas, type Tarjeta } from '@/services/tarjetas';

/** Pinta un mensaje recorriendo sus parts: texto como <Text>, foto como <Image>. */
function Burbuja({ message }: { message: UIMessage }) {
  const mine = message.role === 'user';
  return (
    <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
      {message.parts.map((part, i) => {
        if (part.type === 'text') {
          // Lo que escribe el usuario se muestra tal cual; la respuesta de la IA viene en Markdown
          return mine ? (
            <Text key={i} style={styles.bubbleText} selectable>
              {part.text}
            </Text>
          ) : (
            <MarkdownText key={i} text={part.text} style={styles.bubbleText} />
          );
        }
        if (part.type === 'file' && part.mediaType.startsWith('image/')) {
          return <Image key={i} source={{ uri: part.url }} style={styles.bubbleImage} />;
        }
        return null;
      })}
    </View>
  );
}

export default function TutorScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const chat = useTutorChat();
  const [texto, setTexto] = useState('');
  const [foto, setFoto] = useState<FileUIPart | null>(null);
  const [preparandoFoto, setPreparandoFoto] = useState(false);
  const listRef = useRef<FlatList<UIMessage>>(null);

  const [tarjetasVisible, setTarjetasVisible] = useState(false);
  const [tarjetas, setTarjetas] = useState<Tarjeta[]>([]);
  const [tarjetasLoading, setTarjetasLoading] = useState(false);
  const [tarjetasError, setTarjetasError] = useState<string | null>(null);

  const puedeEnviar = chat.isOnline && !preparandoFoto && (texto.trim().length > 0 || foto !== null);

  const adjuntar = () => {
    const tomar = async (origen: 'camara' | 'galeria') => {
      setPreparandoFoto(true);
      try {
        const reducida = await elegirFoto(origen); // 1024 px, JPEG 0.7
        if (reducida) setFoto(reducida);
      } catch (e) {
        Alert.alert('No se pudo adjuntar la foto', e instanceof Error ? e.message : String(e));
      } finally {
        setPreparandoFoto(false);
      }
    };
    Alert.alert('Adjuntar foto', 'La foto se enviará a Google (Gemini) para responderte.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cámara', onPress: () => tomar('camara') },
      { text: 'Galería', onPress: () => tomar('galeria') },
    ]);
  };

  const enviar = () => {
    if (chat.busy) {
      void chat.stop(); // el botón ■ detiene la respuesta
      return;
    }
    if (!puedeEnviar) return;
    chat.send(texto, foto);
    setTexto('');
    setFoto(null);
  };

  const pedirTarjetas = async () => {
    setTarjetasVisible(true);
    setTarjetasLoading(true);
    setTarjetasError(null);
    try {
      setTarjetas(await generarTarjetas(chat.messages));
    } catch (e) {
      setTarjetasError(e instanceof AiError ? e.message : 'No se pudieron generar las tarjetas.');
    } finally {
      setTarjetasLoading(false);
    }
  };

  const confirmarNueva = () =>
    Alert.alert('Nueva conversación', 'Se borrará la conversación actual de este teléfono.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Empezar de nuevo', style: 'destructive', onPress: chat.newConversation },
    ]);

  return (
    <KeyboardAvoidingView
      style={[styles.fill, { paddingTop: insets.top + 12 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Tutor IA</Text>
        <View style={styles.headerActions}>
          <Pressable onPress={() => router.push('/perfil')} style={styles.smallButton} hitSlop={8}>
            <Text style={styles.smallText}>Perfil</Text>
          </Pressable>
          <Pressable
            onPress={pedirTarjetas}
            disabled={!chat.isOnline || chat.messages.length < 2 || chat.busy}
            style={[styles.smallButton, (!chat.isOnline || chat.messages.length < 2) && styles.disabled]}
            hitSlop={8}
          >
            <Text style={styles.smallText}>Tarjetas</Text>
          </Pressable>
          <Pressable onPress={confirmarNueva} style={styles.smallButton} hitSlop={8}>
            <Text style={styles.smallText}>Nueva</Text>
          </Pressable>
        </View>
      </View>

      {/* C4: sin conexión el chat se puede leer, pero no enviar */}
      {!chat.isOnline && <Text style={styles.offline}>Sin conexión. Puedes leer la conversación; para enviar necesitas internet.</Text>}

      <FlatList
        ref={listRef}
        data={chat.messages}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => <Burbuja message={item} />}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <Text style={styles.empty}>
            Pregúntale al tutor sobre React Native, Supabase o tu GeoCam. También puedes enviarle una foto de tu código.
          </Text>
        }
        ListFooterComponent={
          chat.status === 'submitted' ? (
            <View style={styles.thinking}>
              <ActivityIndicator color={colors.accent} size="small" />
              <Text style={styles.muted}>Pensando…</Text>
            </View>
          ) : undefined
        }
      />

      {/* C4: error claro según el tipo, con Reintentar */}
      {chat.errorMessage && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{chat.errorMessage}</Text>
          {chat.errorKind !== 'session' && chat.errorKind !== 'limit' && (
            <Pressable onPress={chat.retry} disabled={!chat.isOnline} style={styles.retry}>
              <Text style={styles.retryText}>Reintentar</Text>
            </Pressable>
          )}
        </View>
      )}

      {foto && (
        <View style={styles.preview}>
          <Image source={{ uri: foto.url }} style={styles.previewImage} />
          <Text style={styles.previewText}>Esta foto se enviará a Google (Gemini).</Text>
          <Pressable onPress={() => setFoto(null)} hitSlop={8}>
            <Text style={styles.previewRemove}>✕</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.inputRow}>
        <Pressable onPress={adjuntar} disabled={chat.busy || preparandoFoto} style={styles.attach} hitSlop={8}>
          {preparandoFoto ? <ActivityIndicator color={colors.accent} /> : <Text style={styles.attachText}>📷</Text>}
        </Pressable>
        <TextInput
          value={texto}
          onChangeText={setTexto}
          placeholder={chat.isOnline ? 'Escribe tu pregunta…' : 'Sin conexión'}
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          multiline
          editable={!chat.busy}
        />
        <Pressable
          onPress={enviar}
          disabled={!chat.busy && !puedeEnviar}
          style={[styles.send, !chat.busy && !puedeEnviar && styles.disabled]}
          accessibilityLabel={chat.busy ? 'Detener respuesta' : 'Enviar'}
        >
          <Text style={styles.sendText}>{chat.busy ? '■' : '➤'}</Text>
        </Pressable>
      </View>

      <TarjetasModal
        visible={tarjetasVisible}
        loading={tarjetasLoading}
        error={tarjetasError}
        tarjetas={tarjetas}
        onClose={() => setTarjetasVisible(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  title: { color: colors.text, fontSize: 28, fontWeight: '800' },
  headerActions: { flexDirection: 'row', gap: 8 },
  smallButton: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  smallText: { color: colors.text, fontSize: 12, fontWeight: '600' },
  disabled: { opacity: 0.4 },
  offline: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 8,
    borderRadius: 8,
    backgroundColor: colors.warning,
    color: '#171717',
    fontWeight: '600',
    textAlign: 'center',
  },
  list: { padding: 16, gap: 10, flexGrow: 1 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 48, paddingHorizontal: 24 },
  bubble: { maxWidth: '85%', borderRadius: 14, padding: 10, gap: 6 },
  mine: { alignSelf: 'flex-end', backgroundColor: '#065f46' },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.surface },
  bubbleText: { color: colors.text, fontSize: 15, lineHeight: 21 },
  bubbleImage: { width: 200, height: 200, borderRadius: 10 },
  thinking: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  muted: { color: colors.textMuted },
  errorBox: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.danger,
    gap: 8,
  },
  errorText: { color: colors.danger },
  retry: { alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.accent, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  retryText: { color: colors.accent, fontWeight: '700' },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 8 },
  previewImage: { width: 48, height: 48, borderRadius: 8 },
  previewText: { flex: 1, color: colors.warning, fontSize: 12 },
  previewRemove: { color: colors.text, fontSize: 18 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  attach: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  attachText: { fontSize: 22 },
  input: {
    flex: 1,
    maxHeight: 120,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 15,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: { color: colors.background, fontSize: 18, fontWeight: '800' },
});
