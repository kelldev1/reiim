import { supabase, functionUrl } from '@/lib/supabase';

export interface Video {
  id: string;
  title: string;
  channel: string;
  thumb: string;
  duration: string;
  views: number;
  publishedAt: string | null;
}

export type VideoErrorKind = 'auth' | 'quota' | 'network' | 'server';

export class VideoError extends Error {
  kind: VideoErrorKind;
  constructor(kind: VideoErrorKind, message: string) {
    super(message);
    this.name = 'VideoError';
    this.kind = kind;
  }
}

/**
 * Recherche de vidéos explicatives via l'Edge Function `videos`
 * (proxy YouTube Data API — la clé reste côté serveur). Ne coûte pas de crédit.
 */
export async function searchVideos(query: string, subject?: string): Promise<Video[]> {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session) throw new VideoError('auth', 'Connecte-toi pour chercher des vidéos.');

  let res: Response;
  try {
    res = await fetch(functionUrl('videos'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ query, subject }),
    });
  } catch {
    throw new VideoError('network', 'Impossible de joindre le service. Réessaie.');
  }

  if (res.status === 401) throw new VideoError('auth', 'Session expirée — reconnecte-toi.');
  if (res.status === 429) {
    const kind = await res
      .json()
      .then((b) => (b as { error?: string }).error)
      .catch(() => undefined);
    if (kind === 'rate-limit')
      throw new VideoError('quota', 'Doucement — attends quelques secondes.');
    throw new VideoError('quota', 'Trop de recherches pour aujourd’hui — réessaie demain.');
  }
  if (!res.ok) throw new VideoError('server', 'La recherche de vidéos a échoué.');

  const body = (await res.json()) as { videos?: Video[] };
  return body.videos ?? [];
}
