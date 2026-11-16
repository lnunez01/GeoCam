import { index, sqliteTable, integer, real, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * drizzle-kit ejecuta este archivo en Node, donde expo-crypto (módulo nativo) no carga.
 * Por eso se importa solo cuando se genera el valor, es decir, dentro de la app.
 */
function newClientId(): string {
  const Crypto: typeof import('expo-crypto') = require('expo-crypto');
  return Crypto.randomUUID();
}

// albums va antes que photos porque photos la referencia
export const albums = sqliteTable(
  'albums',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    // Usuario de Supabase dueño del álbum (null = creado antes de la Semana 8, sin reclamar)
    ownerId: text('owner_id'),
  },
  // Único por dueño: dos usuarios del mismo teléfono pueden tener un álbum con el mismo nombre
  (t) => [uniqueIndex('albums_owner_name_unique').on(t.ownerId, t.name)]
);

export const photos = sqliteTable(
  'photos',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    uri: text('uri').notNull(),
    latitude: real('latitude'),
    longitude: real('longitude'),
    accuracy: real('accuracy'),
    source: text('source', { enum: ['camera', 'gallery'] }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    // Si se borra el álbum, la foto queda sin álbum (no se borra)
    albumId: integer('album_id').references(() => albums.id, { onDelete: 'set null' }),
    note: text('note'),
    favorite: integer('favorite', { mode: 'boolean' }).notNull().default(false),
    // Identidad compartida con la nube: el id autoincremental solo vale en este teléfono
    clientId: text('client_id').unique().$defaultFn(newClientId),
    // Última modificación hecha por el usuario
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
    // Ruta del archivo en el bucket y momento de la última sincronización
    remotePath: text('remote_path'),
    syncedAt: integer('synced_at', { mode: 'timestamp_ms' }),
    // Usuario de Supabase dueño de la foto (null = tomada antes de la Semana 8, sin reclamar)
    ownerId: text('owner_id'),
    // Semana 9 (C1): borrado lógico. La fila queda marcada hasta que la marca llega a la nube;
    // después se borra de verdad (fila + archivo). Ninguna consulta de la UI muestra filas marcadas.
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
    // Semana 10 (T3): descripción sugerida por la IA y editable por el usuario. Viaja con la sincronización.
    aiDescription: text('ai_description'),
  },
  // Las listas se ordenan por fecha descendente: el índice evita ordenar toda la tabla
  (t) => [index('photos_created_at_idx').on(t.createdAt)]
);

/**
 * Semana 9: pares clave-valor de la sincronización. Ej.: `lastPulledAt:<userId>` guarda
 * el cursor de bajada (server_updated_at de la última fila remota aplicada) de cada usuario.
 */
export const syncMeta = sqliteTable('sync_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export type Album = typeof albums.$inferSelect;
export type NewAlbum = typeof albums.$inferInsert;
export type Photo = typeof photos.$inferSelect;
export type NewPhoto = typeof photos.$inferInsert;

// Semana 10 (C1): historial del chat del Tutor IA. Cada fila es un UIMessage completo en JSON
// (texto, fotos y demás partes), en el orden en que se mostró. Solo vive en este teléfono.
export const chatMessages = sqliteTable(
  'chat_messages',
  {
    id: text('id').primaryKey(), // id del UIMessage: guardar dos veces el mismo mensaje lo actualiza (upsert)
    ownerId: text('owner_id').notNull(),
    conversationId: text('conversation_id').notNull(),
    position: integer('position').notNull(),
    message: text('message').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index('chat_messages_conversation_idx').on(t.ownerId, t.conversationId, t.position)]
);

export type ChatMessageRow = typeof chatMessages.$inferSelect;
