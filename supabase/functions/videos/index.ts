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

// Origines autorisées : secret ALLOWED_ORIGINS (liste séparée par des virgules).
// Vide ⇒ '*' (dev / avant de fixer le domaine de prod).
const ALLOWED = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const corsFor = (req: Request): Record<string, string> => {
  const origin = req.headers.get('Origin') ?? '';
  const allow = ALLOWED.length === 0 ? '*' : ALLOWED.includes(origin) ? origin : ALLOWED[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
};

// Garde-fou quota YouTube (10 000 u/jour, 100 u/recherche) : throttle 3 s +
// plafond quotidien par utilisateur (loggé dans ai_usage, feature='videos').
const SEARCH_THROTTLE_MS = 3000;
const SEARCH_DAILY_CAP = 40;

const json = (body: unknown, status = 200, cors: Record<string, string> = {}) =>
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
  const cors = corsFor(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method-not-allowed' }, 405, cors);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  // .trim() : un espace / retour-ligne collé avec la clé la rend invalide.
  const YT_API_KEY = (Deno.env.get('YT_API_KEY') ?? '').trim();
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY || !YT_API_KEY) {
    return json({ error: 'server-misconfigured' }, 500, cors);
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'auth' }, 401, cors);

  const asUser = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: userErr,
  } = await asUser.auth.getUser();
  if (userErr || !user) return json({ error: 'auth' }, 401, cors);

  const body = (await req.json().catch(() => ({}))) as {
    query?: unknown;
    subject?: unknown;
  };
  const query = String(body.query ?? '').trim().slice(0, 200);
  const subject = String(body.subject ?? '').trim().slice(0, 60);
  if (!query) return json({ error: 'empty-query' }, 400, cors);

  // Rate-limit : protège le quota YouTube partagé.
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const now = Date.now();
  const dayStart = new Date(now - (now % 86_400_000)).toISOString();
  const [{ count: recent }, { count: today }] = await Promise.all([
    admin
      .from('ai_usage')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('feature', 'videos')
      .gte('created_at', new Date(now - SEARCH_THROTTLE_MS).toISOString()),
    admin
      .from('ai_usage')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('feature', 'videos')
      .gte('created_at', dayStart),
  ]);
  if ((recent ?? 0) > 0) return json({ error: 'rate-limit' }, 429, cors);
  if ((today ?? 0) >= SEARCH_DAILY_CAP) return json({ error: 'quota' }, 429, cors);

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
        return json({ error: 'quota' }, 429, cors);
      }
      console.error('yt-search-error', searchRes.status, reason, message);
      return json({ error: 'yt-failed', status: searchRes.status, reason }, 502, cors);
    }

    // Recherche partie : on la compte pour le rate-limit (best effort).
    void admin.from('ai_usage').insert({ user_id: user.id, feature: 'videos', model: 'youtube' });

    const items: any[] = Array.isArray(searchData?.items) ? searchData.items : [];
    const ids = items.map((it) => it?.id?.videoId).filter(Boolean);
    if (ids.length === 0) return json({ videos: [] }, 200, cors);

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

    return json({ videos }, 200, cors);
  } catch (err) {
    console.error('yt-failed', String((err as Error)?.message ?? err).slice(0, 300));
    return json({ error: 'yt-failed' }, 502, cors);
  }
});
