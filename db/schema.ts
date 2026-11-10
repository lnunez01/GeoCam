import { index, sqliteTable, integer, real, text } from 'drizzle-orm/sqlite-core';

// albums va antes que photos porque photos la referencia
export const albums = sqliteTable('albums', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
});

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

    // --- Semana 8: sincronización con Supabase ---
    // Las cuatro son opcionales: SQLite no permite agregar una columna obligatoria
    // sin valor constante a una tabla que ya tiene filas.
    // Identidad compartida con la nube: el id autoincremental solo vale en este teléfono.
    // El UUID lo genera photosRepo.create con expo-crypto: este archivo lo lee drizzle-kit
    // en Node, y ahí no se pueden importar módulos nativos de Expo.
    clientId: text('client_id').unique(),
    // Última modificación hecha por el usuario
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
    // Ruta del archivo en el bucket y momento de la última sincronización
    remotePath: text('remote_path'),
    syncedAt: integer('synced_at', { mode: 'timestamp_ms' }),

    // --- C5: datos locales por usuario ---
    // id de Supabase Auth del dueño. Opcional por la misma razón que las anteriores;
    // las fotos viejas sin dueño se asignan con photosRepo.claimUnowned al iniciar sesión.
    ownerId: text('owner_id'),

    // --- Semana 9 (C1): borrado lógico ---
    // Borrar = marcar con la hora. La fila se conserva para que push suba la marca y pull la
    // aplique en los demás teléfonos; la UI filtra las marcadas.
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
  },
  // Las listas se ordenan por fecha descendente: el índice evita ordenar toda la tabla
  (t) => [
    index('photos_created_at_idx').on(t.createdAt),
    // Todas las consultas filtran por dueño
    index('photos_owner_id_idx').on(t.ownerId),
  ]
);

// --- Semana 9 (T3): datos de la sincronización, p. ej. el cursor de bajada por usuario ---
export const syncMeta = sqliteTable('sync_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export type Album = typeof albums.$inferSelect;
export type NewAlbum = typeof albums.$inferInsert;
export type Photo = typeof photos.$inferSelect;
export type NewPhoto = typeof photos.$inferInsert;
