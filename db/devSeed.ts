import { like } from 'drizzle-orm';
import * as Crypto from 'expo-crypto';
import { db } from '@/db/client';
import { photos, type NewPhoto } from '@/db/schema';
import { photosRepo } from '@/db/repositories/photos';

// Solo para desarrollo: datos ficticios para medir el rendimiento de la lista.
const SEED_PREFIX = 'file:///dev-seed/';
const BATCH_SIZE = 100;
// Riohacha, La Guajira
const CENTER = { latitude: 11.5444, longitude: -72.9072 };
const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

function fakePhoto(i: number, ownerId: string): Omit<NewPhoto, 'id'> {
  return {
    ownerId,
    uri: `${SEED_PREFIX}${i}.jpg`,
    clientId: Crypto.randomUUID(),
    latitude: CENTER.latitude + (Math.random() - 0.5) * 0.1,
    longitude: CENTER.longitude + (Math.random() - 0.5) * 0.1,
    accuracy: Math.round(Math.random() * 30),
    source: Math.random() < 0.7 ? 'camera' : 'gallery',
    // Fechas desordenadas para que el ORDER BY tenga trabajo real
    createdAt: new Date(Date.now() - Math.floor(Math.random() * YEAR_MS)),
    note: i % 5 === 0 ? `Foto de prueba ${i}` : null,
  };
}

/** Inserta `count` fotos ficticias en lotes, todo dentro de una sola transacción. */
export function seedFakePhotos(ownerId: string, count = 1000): void {
  db.transaction((tx) => {
    for (let start = 0; start < count; start += BATCH_SIZE) {
      const batch = Array.from({ length: Math.min(BATCH_SIZE, count - start) }, (_, k) => fakePhoto(start + k, ownerId));
      tx.insert(photos).values(batch).run();
    }
  });
}

/** Ejecuta la consulta de la lista `runs` veces y devuelve el promedio en ms. */
export async function measureList(ownerId: string, runs = 5): Promise<{ rows: number; avgMs: number }> {
  let rows = 0;
  let total = 0;
  for (let i = 0; i < runs; i++) {
    console.time('listar 1000 fotos');
    const start = performance.now();
    const result = await photosRepo.listQuery(ownerId);
    total += performance.now() - start;
    console.timeEnd('listar 1000 fotos');
    rows = result.length;
  }
  return { rows, avgMs: total / runs };
}

export function clearFakePhotos(): void {
  db.delete(photos).where(like(photos.uri, `${SEED_PREFIX}%`)).run();
}
