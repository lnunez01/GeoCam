import { drizzle } from 'drizzle-orm/expo-sqlite';
import { deleteDatabaseSync, openDatabaseSync } from 'expo-sqlite';
import { DevSettings } from 'react-native';
import * as schema from './schema';

// enableChangeListener es lo que permite a useLiveQuery enterarse de los cambios
export const expoDb = openDatabaseSync('geocam.db', { enableChangeListener: true });

// WAL: las lecturas no bloquean el COMMIT de una escritura. Sin esto, una conexión de una
// recarga anterior de Expo Go con una lectura a medias deja "database is locked" al migrar.
// El modo queda guardado en el archivo; si la base está bloqueada al cambiarlo, se sigue
// en el modo anterior y el error aparece en la pantalla de migraciones.
try {
  expoDb.execSync('PRAGMA journal_mode = WAL;');
} catch (e) {
  if (__DEV__) console.warn('[db] no se pudo activar WAL', e);
}

// SQLite no aplica llaves foráneas a menos que se active en cada conexión
expoDb.execSync('PRAGMA foreign_keys = ON;');

export const db = drizzle(expoDb, { schema });

/**
 * Solo desarrollo: borra la base local y recarga la app, que la vuelve a crear desde cero con las
 * migraciones. Sirve cuando el teléfono tiene una base creada con migraciones de otra rama
 * (p. ej. "table `sync_meta` already exists"). Las fotos ya subidas vuelven a bajar de la nube
 * con la sincronización; lo que nunca se subió (y los álbumes) se pierde.
 */
export function resetLocalDatabaseForDev() {
  if (!__DEV__) return;
  expoDb.closeSync();
  deleteDatabaseSync('geocam.db');
  DevSettings.reload();
}
