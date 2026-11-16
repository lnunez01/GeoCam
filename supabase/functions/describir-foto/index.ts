// Edge Function "describir-foto" (T1): recibe una foto JPEG como data URL y responde { descripcion }.
// Sin streaming: generateText + Output.object obliga a Gemini a responder un JSON validado con zod.
import { withSupabase } from 'npm:@supabase/server@1';
import { createGoogleGenerativeAI } from 'npm:@ai-sdk/google@4';
import { APICallError, Output, RetryError, generateText } from 'npm:ai@7';
import { z } from 'npm:zod@4';

const google = createGoogleGenerativeAI({ apiKey: Deno.env.get('GEMINI_API_KEY') });
const MODELO = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.8-flash';
const LIMITE_DIARIO = Number(Deno.env.get('LIMITE_DIARIO') ?? '20');
const PREFIJO = 'data:image/jpeg;base64,';
// La app reduce la foto a 1024 px y JPEG 0.7 (~150 KB). Algo mucho más grande no viene de GeoCam.
const MAX_BASE64 = 1_500_000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export default {
  // Sin token de sesión válido: 401 y nunca llega a Gemini
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') return json({ error: 'Usa POST' }, 405);

    const { imagen } = (await req.json().catch(() => ({}))) as { imagen?: unknown };
    if (typeof imagen !== 'string' || !imagen.startsWith(PREFIJO)) {
      return json({ error: 'Envía la foto como data URL JPEG (data:image/jpeg;base64,...).' }, 400);
    }
    const base64 = imagen.slice(PREFIJO.length); // Gemini recibe el base64 sin el prefijo data:
    if (base64.length > MAX_BASE64) return json({ error: 'La foto es demasiado grande.' }, 413);

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
    await ctx.supabase.from('uso_ia').insert({ funcion: 'describir-foto' });

    try {
      const { output } = await generateText({
        model: google(MODELO),
        instructions:
          'Describes fotos para la app GeoCam. Responde en español, en 2 o 3 frases: qué se ve, dónde parece ' +
          'estar tomada y un detalle llamativo. No inventes lugares exactos ni nombres de personas.',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Describe esta foto.' },
              { type: 'file', mediaType: 'image/jpeg', data: base64 },
            ],
          },
        ],
        // v7: generateObject se reemplazó por generateText con output
        output: Output.object({ schema: z.object({ descripcion: z.string().min(1).max(600) }) }),
        temperature: 0.3,
        maxRetries: 1,
      });
      return json({ descripcion: output.descripcion.trim() });
    } catch (error) {
      console.error(error);
      const real = RetryError.isInstance(error) ? error.lastError : error;
      if (APICallError.isInstance(real) && real.statusCode === 429) {
        return json({ error: 'Se agotó la cuota gratuita de Gemini. Espera un minuto.' }, 429);
      }
      // 503: el modelo está saturado en Google ("high demand"). Es temporal.
      if (APICallError.isInstance(real) && real.statusCode === 503) {
        return json({ error: 'Gemini está saturado en este momento. Intenta de nuevo en unos segundos.' }, 503);
      }
      return json({ error: 'No se pudo describir la foto. Intenta de nuevo.' }, 502);
    }
  }),
};
