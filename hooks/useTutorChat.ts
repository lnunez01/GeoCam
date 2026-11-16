import { useCallback, useEffect, useMemo, useState } from 'react';
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
