// Semana 10 (C3): tarjetas de repaso generadas a partir de la conversación (salida estructurada).
import type { UIMessage } from 'ai';
import { supabase } from '@/lib/supabase';
import { fromInvokeError } from '@/services/aiErrors';

export interface Tarjeta {
  pregunta: string;
  respuesta: string;
}

/** Solo se envía el texto: las fotos ya se explicaron en el chat y gastarían tokens otra vez. */
function soloTexto(messages: UIMessage[]): UIMessage[] {
  return messages
    .map((m) => ({ ...m, parts: m.parts.filter((p) => p.type === 'text') }))
    .filter((m) => m.parts.length > 0);
}

export async function generarTarjetas(messages: UIMessage[]): Promise<Tarjeta[]> {
  const { data, error } = await supabase.functions.invoke<{ tarjetas: Tarjeta[] }>('tarjetas', {
    body: { messages: soloTexto(messages) },
  });
  if (error) throw await fromInvokeError(error);
  return data?.tarjetas ?? [];
}
