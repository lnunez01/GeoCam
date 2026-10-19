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
  },
  // Las listas se ordenan por fecha descendente: el índice evita ordenar toda la tabla
  (t) => [index('photos_created_at_idx').on(t.createdAt)]
);

export type Album = typeof albums.$inferSelect;
export type NewAlbum = typeof albums.$inferInsert;
export type Photo = typeof photos.$inferSelect;
export type NewPhoto = typeof photos.$inferInsert;
