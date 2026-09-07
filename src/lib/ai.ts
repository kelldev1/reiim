import { supabase, functionUrl } from '@/lib/supabase';

export type AIErrorKind =
  | 'auth'
  | 'no-credits'
  | 'rate-limit'
  | 'refused'
  | 'network'
  | 'server';

export class AIError extends Error {
  kind: AIErrorKind;
  constructor(kind: AIErrorKind, message: string) {
    super(message);
    this.name = 'AIError';
    this.kind = kind;
  }
}

export interface AIResult {
  answer: string;
  creditsLeft: number;
}

export interface AIRequest {
  /** Which workspace called it — for usage analytics. */
  feature: string;
  /** The exercise / homework statement. */
  prompt: string;
  /** Human-readable subject label, e.g. "Mathématiques". */
  subject?: string;
}

/**
 * Calls the `ai` Edge Function (the proxy that holds the model API key,
 * checks the user's credits, and rate-limits). Never talks to the model
 * provider directly from the browser.
 */
export async function askAI(req: AIRequest): Promise<AIResult> {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session) {
    throw new AIError('auth', 'Connecte-toi pour utiliser l’assistant.');
  }

  let res: Response;
  try {
    res = await fetch(functionUrl('ai'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(req),
    });
  } catch {
    throw new AIError('network', 'Impossible de joindre le service. Réessaie.');
  }

  if (res.status === 401) throw new AIError('auth', 'Session expirée — reconnecte-toi.');
  if (res.status === 402) throw new AIError('no-credits', 'Tu n’as plus de crédits.');
  if (res.status === 429)
    throw new AIError('rate-limit', 'Doucement — attends quelques secondes.');
  if (res.status === 422)
    throw new AIError('refused', 'Le modèle a refusé cette demande.');
  if (!res.ok) throw new AIError('server', 'Le service IA a rencontré une erreur.');

  return (await res.json()) as AIResult;
}
