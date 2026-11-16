// Semana 10 (T2): describir una foto de GeoCam con IA.
// La app nunca habla con Gemini: llama a la Edge Function describir-foto, que guarda la key.
import { supabase } from '@/lib/supabase';
import { reducirFoto } from '@/lib/foto';
import { fromInvokeError } from '@/services/aiErrors';

/**
 * Reduce la foto a 1024 px y JPEG 0.7 (~150 KB en vez de varios MB) y pide la descripción.
 * supabase.functions.invoke envía solo el token de la sesión.
 * Lanza AiError con un mensaje listo para mostrar.
 */
export async function describirFoto(uri: string): Promise<string> {
  const foto = await reducirFoto(uri);
  if (__DEV__) console.log(`[vision] la foto viaja con ${Math.round(foto.url.length / 1024)} KB`);

  const { data, error } = await supabase.functions.invoke<{ descripcion: string }>('describir-foto', {
    body: { imagen: foto.url },
  });
  if (error) throw await fromInvokeError(error);
  if (!data?.descripcion) throw await fromInvokeError(new Error('Respuesta vacía de la IA.'));
  return data.descripcion;
}
