import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import type { FileUIPart } from 'ai';
import { useAuth } from '@/context/AuthContext';
import { chatRepo, perfilRepo } from '@/db/repositories/chat';
import { useOwnerId } from '@/hooks/useOwnerId';
import { crearTransporte } from '@/lib/chatTransport';
import { useIsOnline } from '@/lib/queryClient';
import { classifyMessage, messageFor, type AiErrorKind } from '@/services/aiErrors';

/**
 * Chat del Tutor IA con streaming.
 * - C1: la conversación se carga de SQLite al abrir y se guarda al terminar cada respuesta.
 * - C2: el perfil viaja en el body de cada mensaje (crearTransporte lo lee en cada envío).
 * - C4: errores clasificados (sesión, límite, cuota, red) y envío apagado sin conexión.
 */
export function useTutorChat() {
  const ownerId = useOwnerId();
  const { signOut } = useAuth();
  const isOnline = useIsOnline();
  const [conversationId, setConversationId] = useState(() => chatRepo.currentConversation(ownerId));

  // Mensajes iniciales: los guardados de esta conversación (useChat los toma al crear el chat)
  const initialMessages = useMemo(() => chatRepo.load(ownerId, conversationId), [ownerId, conversationId]);
  const transport = useMemo(() => crearTransporte('tutor', () => perfilRepo.get(ownerId)), [ownerId]);

  const chat = useChat({
    id: conversationId, // al cambiar de conversación, useChat crea un chat nuevo con sus mensajes
    messages: initialMessages,
    transport,
    // Se guarda también si el usuario detuvo la respuesta con ■ (isAbort)
    onFinish: ({ messages }) => chatRepo.save(ownerId, conversationId, messages),
  });

  const errorKind: AiErrorKind | null = chat.error ? classifyMessage(chat.error.message) : null;
  const errorMessage = chat.error && errorKind ? messageFor(errorKind, chat.error.message) : null;

  // Token vencido: no sirve reintentar, se cierra la sesión y Stack.Protected lleva al login
  useEffect(() => {
    if (errorKind === 'session') void signOut();
  }, [errorKind, signOut]);

  const busy = chat.status === 'submitted' || chat.status === 'streaming';

  // Solo desarrollo: mide si la respuesta llega por partes (streaming) o de golpe.
  // En la terminal de Metro se ve "[tutor] … llegó en N partes".
  const streamLog = useRef({ start: 0, first: 0, updates: 0 });
  const lastMessage = chat.messages[chat.messages.length - 1];
  const lastLength = lastMessage?.parts.reduce((n, p) => n + (p.type === 'text' ? p.text.length : 0), 0) ?? 0;
  useEffect(() => {
    if (!__DEV__) return;
    const log = streamLog.current;
    if (chat.status === 'submitted') {
      streamLog.current = { start: Date.now(), first: 0, updates: 0 };
    } else if (chat.status === 'streaming' && lastMessage?.role === 'assistant') {
      if (log.first === 0) log.first = Date.now();
      log.updates++;
    } else if (chat.status === 'ready' && log.start > 0) {
      console.log(
        `[tutor] primera palabra a los ${log.first ? log.first - log.start : '?'} ms; ` +
          `respuesta completa a los ${Date.now() - log.start} ms; llegó en ${log.updates} partes (${lastLength} caracteres)`
      );
      log.start = 0;
    }
  }, [chat.status, lastLength, lastMessage?.role]);

  const send = useCallback(
    (text: string, photo: FileUIPart | null) => {
      if (!isOnline) return;
      chat.sendMessage({ text: text.trim() || '¿Qué ves en esta foto?', files: photo ? [photo] : undefined });
    },
    [chat, isOnline]
  );

  const retry = useCallback(() => {
    chat.clearError();
    void chat.regenerate();
  }, [chat]);

  const newConversation = useCallback(() => {
    void chat.stop();
    setConversationId(chatRepo.newConversation(ownerId));
  }, [chat, ownerId]);

  return {
    messages: chat.messages,
    status: chat.status,
    busy,
    isOnline,
    errorKind,
    errorMessage,
    send,
    stop: chat.stop,
    retry,
    newConversation,
  };
}
