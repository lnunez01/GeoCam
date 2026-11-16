// Edge Function "tarjetas" (C3): genera de 3 a 5 tarjetas de repaso a partir de la conversación del chat.
// Salida estructurada: generateText + Output.object con un esquema de zod.
import { withSupabase } from 'npm:@supabase/server@1';
import { createGoogleGenerativeAI } from 'npm:@ai-sdk/google@4';
import { APICallError, Output, RetryError, convertToModelMessages, generateText, type UIMessage } from 'npm:ai@7';
import { z } from 'npm:zod@4';

const google = createGoogleGenerativeAI({ apiKey: Deno.env.get('GEMINI_API_KEY') });
const MODELO = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.8-flash';
const LIMITE_DIARIO = Number(Deno.env.get('LIMITE_DIARIO') ?? '20');

// El esquema que se le pide al modelo es flexible a propósito: si se le exige "entre 3 y 5" y longitudes
// máximas, basta con que Gemini devuelva 6 tarjetas o una respuesta larga para que toda la petición falle
// (al probar pasó). Las reglas se aplican después, en el código.
const Tarjetas = z.object({
  tarjetas: z
    .array(
      z.object({
        pregunta: z.string().describe('Pregunta corta de repaso'),
        respuesta: z.string().describe('Respuesta de 1 o 2 frases'),
      })
    )
    .describe('Entre 3 y 5 tarjetas'),
});

const recortar = (texto: string, max: number) =>
  texto.trim().length > max ? `${texto.trim().slice(0, max - 1)}…` : texto.trim();

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') return json({ error: 'Usa POST' }, 405);

    const { messages } = (await req.json().catch(() => ({}))) as { messages?: UIMessage[] };
    if (!Array.isArray(messages) || messages.length < 2) {
      return json({ error: 'Conversa un poco con el tutor antes de generar tarjetas.' }, 400);
    }

    // C5: límite diario contado con el cliente del usuario (RLS)
    const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await ctx.supabase
      .from('uso_ia')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', desde);
    if (countError) return json({ error: 'No se pudo comprobar tu límite de uso.' }, 500);
    if ((count ?? 0) >= LIMITE_DIARIO) {
      return json({ error: `Llegaste al límite de ${LIMITE_DIARIO} peticiones de IA en 24 horas.` }, 429);
    }
    await ctx.supabase.from('uso_ia').insert({ funcion: 'tarjetas' });

    try {
      const { output } = await generateText({
        model: google(MODELO),
        instructions:
          'A partir de la conversación entre un estudiante y su tutor, crea de 3 a 5 tarjetas de repaso en ' +
          'español. Cada tarjeta tiene una pregunta corta y una respuesta de 1 o 2 frases, basadas SOLO en lo ' +
          'que se habló.',
        messages: await convertToModelMessages(messages.slice(-20)),
        output: Output.object({ schema: Tarjetas }),
        temperature: 0.2, // extraer y resumir: respuestas estables
        maxRetries: 1,
      });
      const tarjetas = output.tarjetas
        .filter((t) => t.pregunta.trim() && t.respuesta.trim())
        .slice(0, 5)
        .map((t) => ({ pregunta: recortar(t.pregunta, 200), respuesta: recortar(t.respuesta, 400) }));
      if (tarjetas.length === 0) {
        return json({ error: 'La conversación es muy corta para hacer tarjetas. Pregunta algo más al tutor.' }, 422);
      }
      return json({ tarjetas });
    } catch (error) {
      // El motivo exacto queda en Edge Functions → tarjetas → Logs
      console.error('[tarjetas] falló', error instanceof Error ? `${error.name}: ${error.message}` : error);
      const real = RetryError.isInstance(error) ? error.lastError : error;
      if (APICallError.isInstance(real) && real.statusCode === 429) {
        return json({ error: 'Se agotó la cuota gratuita de Gemini. Espera un minuto.' }, 429);
      }
      // 503: el modelo está saturado en Google ("high demand"). Es temporal.
      if (APICallError.isInstance(real) && real.statusCode === 503) {
        return json({ error: 'Gemini está saturado en este momento. Intenta de nuevo en unos segundos.' }, 503);
      }
      return json({ error: 'No se pudieron generar las tarjetas. Intenta de nuevo.' }, 502);
    }
  }),
};
