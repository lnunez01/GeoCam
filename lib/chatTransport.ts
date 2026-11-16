import { DefaultChatTransport } from 'ai';
import { fetch as expoFetch } from 'expo/fetch';
import { supabase, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '@/lib/supabase';

/**
 * Transporte de useChat hacia una Edge Function de GeoCam.
 * - api: URL pública de la función en Supabase.
 * - headers: se calculan EN CADA mensaje, así siempre va el token vigente.
 * - fetch: el de Expo, que sí entrega la respuesta por partes (streaming).
 * - body: datos extra del perfil (C2), leídos en cada envío para que siempre vaya el último guardado.
 */
export function crearTransporte(funcion = 'tutor', perfil?: () => object | null) {
  return new DefaultChatTransport({
    api: `${SUPABASE_URL}/functions/v1/${funcion}`,
    fetch: expoFetch as unknown as typeof globalThis.fetch,
    headers: async (): Promise<Record<string, string>> => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('No hay sesión: vuelve a iniciar sesión.');
      return { Authorization: `Bearer ${token}`, apikey: SUPABASE_PUBLISHABLE_KEY };
    },
    // C2: el perfil viaja en cada mensaje; el servidor lo valida con zod antes de usarlo
    body: async () => ({ perfil: perfil?.() ?? null }),
  });
}
