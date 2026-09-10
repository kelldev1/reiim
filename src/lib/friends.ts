import { supabase } from '@/lib/supabase';

export interface FriendUser {
  id: string;
  name: string;
  tag: string;
  avatar?: string;
}

export interface Friend extends FriendUser {
  since: string;
}

export interface FriendRequest extends FriendUser {
  reqId: string;
  direction: 'in' | 'out';
  createdAt: string;
}

/** "Pseudo#TAG" affiché partout. */
export const handleOf = (name: string, tag: string) => `${name}#${tag}`;

/** Analyse une saisie "Pseudo#TAG" (le pseudo est optionnel : "#TAG" marche aussi). */
export function parseHandle(input: string): { name: string; tag: string } | null {
  const m = input.trim().match(/^(.*?)#\s*([A-Za-z0-9]{3,6})$/);
  if (!m) return null;
  return { name: m[1].trim(), tag: m[2].toUpperCase() };
}

type RawUser = { id: string; name: string; tag: string; avatar: string | null };
const toUser = (r: RawUser): FriendUser => ({
  id: r.id,
  name: r.name,
  tag: r.tag,
  avatar: r.avatar ?? undefined,
});

export interface PublicProfile {
  id: string;
  name: string;
  tag: string;
  avatar?: string;
  banner?: string;
  bio?: string;
  createdAt: string;
}

/** Profil public d'un ami (jamais l'e-mail ni les crédits). `null` si non ami. */
export async function getPublicProfile(id: string): Promise<PublicProfile | null> {
  const { data, error } = await supabase.rpc('public_profile', { p_user: id });
  const row = (data as Record<string, unknown>[] | null)?.[0];
  if (error || !row) return null;
  return {
    id: row.id as string,
    name: row.name as string,
    tag: row.tag as string,
    avatar: (row.avatar as string | null) ?? undefined,
    banner: (row.banner as string | null) ?? undefined,
    bio: (row.bio as string | null) ?? undefined,
    createdAt: row.created_at as string,
  };
}

export async function findUser(input: string): Promise<FriendUser | null> {
  const p = parseHandle(input);
  if (!p) return null;
  const { data, error } = await supabase.rpc('find_user_by_tag', {
    p_name: p.name || null,
    p_tag: p.tag,
  });
  if (error || !data || (data as RawUser[]).length === 0) return null;
  return toUser((data as RawUser[])[0]);
}

export type SendResult = 'sent' | 'accepted' | 'already-friends' | 'self' | 'auth';

export async function sendRequest(targetId: string): Promise<SendResult> {
  const { data, error } = await supabase.rpc('send_friend_request', { p_target: targetId });
  if (error) throw new Error(error.message);
  return data as SendResult;
}

export async function respondRequest(reqId: string, accept: boolean): Promise<void> {
  const { error } = await supabase.rpc(
    accept ? 'accept_friend_request' : 'dismiss_friend_request',
    { p_req: reqId },
  );
  if (error) throw new Error(error.message);
}

export async function removeFriend(friendId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_friend', { p_friend: friendId });
  if (error) throw new Error(error.message);
}

export async function listFriends(): Promise<Friend[]> {
  const { data } = await supabase.rpc('list_friends');
  return ((data ?? []) as (RawUser & { since: string })[]).map((r) => ({
    ...toUser(r),
    since: r.since,
  }));
}

export async function listRequests(): Promise<FriendRequest[]> {
  const { data } = await supabase.rpc('list_friend_requests');
  return (
    (data ?? []) as {
      id: string;
      direction: 'in' | 'out';
      other_id: string;
      name: string;
      tag: string;
      avatar: string | null;
      created_at: string;
    }[]
  ).map((r) => ({
    reqId: r.id,
    direction: r.direction,
    createdAt: r.created_at,
    id: r.other_id,
    name: r.name,
    tag: r.tag,
    avatar: r.avatar ?? undefined,
  }));
}
