// Edge Function "tutor": chat con streaming. Es uno de los ÚNICOS lugares donde se usa la key de Gemini.
// La key vive como secreto de Supabase (GEMINI_API_KEY), nunca en la app ni en el repositorio.
import { withSupabase } from 'npm:@supabase/server@1';
import { createGoogleGenerativeAI } from 'npm:@ai-sdk/google@4';
import {
  APICallError,
  RetryError,
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from 'npm:ai@7';
import { z } from 'npm:zod@4';

const google = createGoogleGenerativeAI({ apiKey: Deno.env.get('GEMINI_API_KEY') });
const MODELO = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.8-flash';
// C5: máximo de peticiones de IA por usuario cada 24 horas (todas las funciones suman)
const LIMITE_DIARIO = Number(Deno.env.get('LIMITE_DIARIO') ?? '20');

// C2: el perfil llega del teléfono y NO es confiable. Cada campo inválido cae a un valor seguro con .catch(),
// así un perfil falso o un tema inventado nunca llega tal cual a las instrucciones del modelo.
const Perfil = z.object({
  nombre: z
    .string()
    .trim()
    .max(40)
    .regex(/^[\p{L} .'-]*$/u)
    .catch(''),
  tema: z.enum(['react-native', 'supabase', 'sqlite', 'ia', 'general']).catch('general'),
  nivel: z.enum(['basico', 'intermedio', 'avanzado']).catch('intermedio'),
});
const TEMAS = {
  'react-native': 'React Native con Expo y TypeScript',
  supabase: 'Supabase (Auth, base de datos, Storage y Edge Functions)',
  sqlite: 'SQLite con Drizzle ORM y apps offline-first',
  ia: 'IA generativa en apps móviles',
  general: 'Programación Móvil Avanzada en general',
} as const;
const NIVELES = {
  basico: 'Explica desde cero, sin jerga y con ejemplos cortos.',
  intermedio: 'Asume que conoce lo básico de React Native.',
  avanzado: 'Puedes ir directo a detalles técnicos y buenas prácticas.',
} as const;

function texto(mensaje: string, status: number) {
  // useChat muestra el cuerpo de una respuesta de error como error.message
  return new Response(mensaje, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

export default {
  // auth: 'user' => sin un token de sesión válido responde 401 y nunca llega a Gemini.
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') return texto('Usa POST', 405);

    // C5: se cuenta con el cliente DEL USUARIO (ctx.supabase): RLS solo le deja ver e insertar sus filas.
    const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await ctx.supabase
      .from('uso_ia')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', desde);
    if (countError) return texto('No se pudo comprobar tu límite de uso. Intenta de nuevo.', 500);
    if ((count ?? 0) >= LIMITE_DIARIO) {
      return texto(`Llegaste al límite de ${LIMITE_DIARIO} peticiones de IA en 24 horas. Vuelve mañana.`, 429);
    }
    await ctx.supabase.from('uso_ia').insert({ funcion: 'tutor' });

    const { messages, perfil: perfilCrudo }: { messages: UIMessage[]; perfil?: unknown } = await req.json();
    const perfil = Perfil.parse(perfilCrudo ?? {});

    const result = streamText({
      model: google(MODELO),
      // v7: el prompt de sistema se llama instructions (no system)
      instructions: [
        'Eres "Tutor IA", el asistente de GeoCam y tutor de Programación Móvil Avanzada de la Universidad de La Guajira.',
        'Respondes en español, claro y breve (máximo 8 líneas salvo que pidan código). Si no sabes algo, dilo; no inventes APIs.',
        'Si te envían una foto, descríbela y relaciónala con la pregunta.',
        `Tema preferido del estudiante: ${TEMAS[perfil.tema]}. ${NIVELES[perfil.nivel]}`,
        perfil.nombre ? `Llámalo por su nombre: ${perfil.nombre}.` : '',
        `Correo del estudiante: ${ctx.userClaims?.email ?? 'desconocido'}.`,
      ].join('\n'),
      // La API no tiene memoria: se reenvía el historial. Solo los últimos 20 mensajes para cuidar tokens.
      messages: await convertToModelMessages(messages.slice(-20)),
      temperature: 0.4,
      maxRetries: 1,
      maxOutputTokens: 1024,
    });

    return createUIMessageStreamResponse({
      stream: toUIMessageStream({
        stream: result.stream,
        // Lo que devuelve onError es lo que ve el usuario: nunca el error crudo de Google.
        onError: (error) => {
          console.error(error);
          const real = RetryError.isInstance(error) ? error.lastError : error;
          if (APICallError.isInstance(real) && real.statusCode === 429) {
            return 'Se agotó la cuota gratuita de Gemini. Espera un minuto e intenta de nuevo.';
          }
          return 'El tutor no pudo responder. Intenta de nuevo.';
        },
      }),
      headers: { 'Content-Type': 'application/octet-stream', 'Content-Encoding': 'none' },
    });
  }),
};
