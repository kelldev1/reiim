// reiim — recherche de vidéos explicatives (YouTube Data API v3).
//
// Le navigateur ne parle pas à YouTube directement : la clé vit ici
// (`supabase secrets set YT_API_KEY=...`, clé gratuite console.cloud.google.com →
// API "YouTube Data API v3"). La fonction vérifie le JWT Supabase de l'appelant,
// interroge YouTube (résultats FR), récupère les durées, et remonte une liste
// nettoyée. Pas de crédit débité (le quota YouTube = 10 000 u/jour, recherche = 100 u).
//
// deno-lint-ignore-file no-explicit-any

import { createClient } from 'npm:@supabase/supabase-js@2';

const SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';
const VIDEOS_URL = 'https://www.googleapis.com/youtube/v3/videos';
const MAX_RESULTS = 15;

// Chaînes pédagogiques FR connues → remontées en tête des résultats.
const TRUSTED = [
  'maths et tiques', // Yvan Monka
  'yvan monka',
  'les bons profs',
  'le prof',
  'physique-chimie facile',
  'hans amell',
  'optimal sup spé',
  'superbac',
  'studytracks',
  'jamy',
  'c est pas sorcier',
  "c'est pas sorcier",
  'nota bene',
  'la prof de philo',
  'schoolmouv',
  'annabac',
  'kartable',
  'lelivrescolaire',
  'français avec pierre',
  'espagnol pas à pas',
  'anglais cours',
];

const cors: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

/** ISO 8601 "PT1H2M3S" → "1:02:03" / "2:03". */
const fmtDuration = (iso: string): string => {
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso ?? '');
  if (!m) return '';
  const h = Number(m[1] ?? 0);
  const min = Number(m[2] ?? 0);
  const s = Number(m[3] ?? 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(min)}:${pad(s)}` : `${min}:${pad(s)}`;
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method-not-allowed' }, 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
  // .trim() : un espace / retour-ligne collé avec la clé la rend invalide.
  const YT_API_KEY = (Deno.env.get('YT_API_KEY') ?? '').trim();
  if (!SUPABASE_URL || !ANON_KEY || !YT_API_KEY) {
    return json({ error: 'server-misconfigured' }, 500);
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'auth' }, 401);

  const asUser = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: userErr,
  } = await asUser.auth.getUser();
  if (userErr || !user) return json({ error: 'auth' }, 401);

  const body = (await req.json().catch(() => ({}))) as {
    query?: unknown;
    subject?: unknown;
  };
  const query = String(body.query ?? '').trim().slice(0, 200);
  const subject = String(body.subject ?? '').trim().slice(0, 60);
  if (!query) return json({ error: 'empty-query' }, 400);

  const q = [subject, query].filter(Boolean).join(' ');

  try {
    // 1. recherche
    const sp = new URLSearchParams({
      key: YT_API_KEY,
      part: 'snippet',
      type: 'video',
      order: 'relevance',
      maxResults: String(MAX_RESULTS),
      relevanceLanguage: 'fr',
      regionCode: 'FR',
      safeSearch: 'strict',
      videoEmbeddable: 'true',
      q,
    });
    const searchRes = await fetch(`${SEARCH_URL}?${sp}`);
    const searchData: any = await searchRes.json().catch(() => ({}));

    if (!searchRes.ok) {
      const reason = searchData?.error?.errors?.[0]?.reason ?? '';
      const message = searchData?.error?.message ?? '';
      if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') {
        return json({ error: 'quota' }, 429);
      }
      console.error('yt-search-error', searchRes.status, reason, message);
      return json(
        { error: 'yt-failed', status: searchRes.status, reason, detail: String(message).slice(0, 300) },
        502,
      );
    }

    const items: any[] = Array.isArray(searchData?.items) ? searchData.items : [];
    const ids = items.map((it) => it?.id?.videoId).filter(Boolean);
    if (ids.length === 0) return json({ videos: [] });

    // 2. durées + stats
    const vp = new URLSearchParams({
      key: YT_API_KEY,
      part: 'contentDetails,snippet,statistics',
      id: ids.join(','),
    });
    const detRes = await fetch(`${VIDEOS_URL}?${vp}`);
    const detData: any = await detRes.json().catch(() => ({}));
    const details = new Map<string, any>();
    for (const v of detData?.items ?? []) details.set(v.id, v);

    const videos = ids
      .map((id: string) => {
        const det = details.get(id);
        const sn = det?.snippet ?? items.find((it) => it?.id?.videoId === id)?.snippet ?? {};
        const th = sn?.thumbnails ?? {};
        return {
          id,
          title: String(sn?.title ?? '').slice(0, 200),
          channel: String(sn?.channelTitle ?? ''),
          thumb: th?.medium?.url ?? th?.high?.url ?? th?.default?.url ?? '',
          duration: fmtDuration(det?.contentDetails?.duration ?? ''),
          views: Number(det?.statistics?.viewCount ?? 0),
          publishedAt: sn?.publishedAt ?? null,
        };
      })
      .filter((v) => v.title && v.thumb);

    // 3. remonter les chaînes de confiance
    const trusted = (name: string) =>
      TRUSTED.some((t) => name.toLowerCase().includes(t));
    videos.sort((a, b) => Number(trusted(b.channel)) - Number(trusted(a.channel)));

    return json({ videos });
  } catch (err) {
    const detail = String((err as Error)?.message ?? err).slice(0, 300);
    console.error('yt-failed', detail);
    return json({ error: 'yt-failed', detail }, 502);
  }
});
