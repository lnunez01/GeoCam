import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js';

/** C4: los tipos de falla que la UI distingue, cada uno con su mensaje y su acción. */
export type AiErrorKind = 'session' | 'limit' | 'quota' | 'network' | 'other';

export class AiError extends Error {
  constructor(
    readonly kind: AiErrorKind,
    message: string
  ) {
    super(message);
    this.name = 'AiError';
  }
}

const MENSAJES: Record<AiErrorKind, string> = {
  session: 'Tu sesión venció. Vuelve a iniciar sesión.',
  limit: 'Llegaste al límite diario de peticiones de IA. Vuelve mañana.',
  quota: 'Se agotó la cuota gratuita de Gemini. Espera un minuto e intenta de nuevo.',
  network: 'Sin conexión. Revisa tu internet e intenta de nuevo.',
  other: 'La IA no pudo responder. Intenta de nuevo.',
};

/** Clasifica un texto de error (de useChat o del servidor). El servidor ya manda mensajes en español. */
export function classifyMessage(message: string, status?: number): AiErrorKind {
  const m = message.toLowerCase();
  if (status === 401 || /jwt|unauthori|no hay sesión|invalid.*token|expired/.test(m)) return 'session';
  if (/límite|limite/.test(m)) return 'limit';
  if (status === 429 || /cuota|quota|resource_exhausted|too many/.test(m)) return 'quota';
  if (/network request failed|failed to fetch|network|timed out|sin conexión/.test(m)) return 'network';
  return 'other';
}

/** Mensaje para el usuario: el del servidor si lo trae (ya es claro), o el genérico de su tipo. */
export function messageFor(kind: AiErrorKind, serverMessage?: string): string {
  if (kind === 'session' || kind === 'network') return MENSAJES[kind];
  return serverMessage?.trim() || MENSAJES[kind];
}

/**
 * Convierte el error de supabase.functions.invoke en un AiError.
 * Con 4xx/5xx invoke devuelve FunctionsHttpError y el mensaje del servidor está en error.context.json().
 */
export async function fromInvokeError(error: unknown): Promise<AiError> {
  if (error instanceof FunctionsHttpError) {
    const response = error.context as Response;
    const body = (await response.json().catch(() => null)) as { error?: string; msg?: string } | null;
    const serverMessage = body?.error ?? body?.msg;
    const kind = classifyMessage(serverMessage ?? '', response.status);
    return new AiError(kind, messageFor(kind, serverMessage));
  }
  if (error instanceof FunctionsFetchError || error instanceof FunctionsRelayError) {
    return new AiError('network', MENSAJES.network);
  }
  const message = error instanceof Error ? error.message : String(error);
  const kind = classifyMessage(message);
  return new AiError(kind, messageFor(kind, kind === 'other' ? undefined : message));
}
