// Edge Function "tarjetas" (C3): genera de 3 a 5 tarjetas de repaso a partir de la conversación del chat.
// Salida estructurada: generateText + Output.object con un esquema de zod.
import { withSupabase } from 'npm:@supabase/server@1';
import { createGoogleGenerativeAI } from 'npm:@ai-sdk/google@4';
import { APICallError, Output, RetryError, convertToModelMessages, generateText, type UIMessage } from 'npm:ai@7';
import { z } from 'npm:zod@4';

const google = createGoogleGenerativeAI({ apiKey: Deno.env.get('GEMINI_API_KEY') });
const MODELO = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.8-flash';
const LIMITE_DIARIO = Number(Deno.env.get('LIMITE_DIARIO') ?? '20');

const Tarjetas = z.object({
  tarjetas: z
    .array(z.object({ pregunta: z.string().min(1).max(200), respuesta: z.string().min(1).max(400) }))
    .min(3)
    .max(5),
});

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
      return json(output);
    } catch (error) {
      console.error(error);
      const real = RetryError.isInstance(error) ? error.lastError : error;
      if (APICallError.isInstance(real) && real.statusCode === 429) {
        return json({ error: 'Se agotó la cuota gratuita de Gemini. Espera un minuto.' }, 429);
      }
      return json({ error: 'No se pudieron generar las tarjetas. Intenta de nuevo.' }, 502);
    }
  }),
};
