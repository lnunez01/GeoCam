import * as Crypto from 'expo-crypto';
import { and, asc, eq } from 'drizzle-orm';
import type { UIMessage } from 'ai';
import { db } from '@/db/client';
import { chatMessages } from '@/db/schema';
import { syncMetaRepo } from '@/db/repositories/syncMeta';
import { PERFIL_INICIAL, type Perfil } from '@/types/ai';

const conversationKey = (ownerId: string) => `chat:conversacion:${ownerId}`;
const perfilKey = (ownerId: string) => `perfil:${ownerId}`;

/** Semana 10 (C1): historial del Tutor IA en SQLite. Una conversación activa por usuario. */
export const chatRepo = {
  /** Id de la conversación activa; si no hay, se crea una. */
  currentConversation(ownerId: string): string {
    const saved = syncMetaRepo.get(conversationKey(ownerId));
    if (saved) return saved;
    const id = Crypto.randomUUID();
    syncMetaRepo.set(conversationKey(ownerId), id);
    return id;
  },

  /** Mensajes guardados, en el orden en que se mostraron. */
  load(ownerId: string, conversationId: string): UIMessage[] {
    return db
      .select()
      .from(chatMessages)
      .where(and(eq(chatMessages.ownerId, ownerId), eq(chatMessages.conversationId, conversationId)))
      .orderBy(asc(chatMessages.position))
      .all()
      .map((row) => JSON.parse(row.message) as UIMessage);
  },

  /** Guarda la conversación completa con upsert por id: volver a guardar un mensaje lo actualiza, no lo duplica. */
  save(ownerId: string, conversationId: string, messages: UIMessage[]) {
    db.transaction((tx) => {
      messages.forEach((message, position) => {
        const values = { id: message.id, ownerId, conversationId, position, message: JSON.stringify(message) };
        tx.insert(chatMessages)
          .values(values)
          .onConflictDoUpdate({ target: chatMessages.id, set: { position, message: values.message } })
          .run();
      });
    });
  },

  /** "Nueva conversación": borra la anterior (puede tener fotos en base64) y empieza otra. */
  newConversation(ownerId: string): string {
    const previous = syncMetaRepo.get(conversationKey(ownerId));
    if (previous) {
      db.delete(chatMessages)
        .where(and(eq(chatMessages.ownerId, ownerId), eq(chatMessages.conversationId, previous)))
        .run();
    }
    const id = Crypto.randomUUID();
    syncMetaRepo.set(conversationKey(ownerId), id);
    return id;
  },
};

/** Semana 10 (C2): perfil del estudiante, guardado en el teléfono. */
export const perfilRepo = {
  get(ownerId: string): Perfil {
    const saved = syncMetaRepo.get(perfilKey(ownerId));
    if (!saved) return PERFIL_INICIAL;
    try {
      return { ...PERFIL_INICIAL, ...(JSON.parse(saved) as Partial<Perfil>) };
    } catch {
      return PERFIL_INICIAL;
    }
  },

  set(ownerId: string, perfil: Perfil) {
    syncMetaRepo.set(perfilKey(ownerId), JSON.stringify(perfil));
  },
};
