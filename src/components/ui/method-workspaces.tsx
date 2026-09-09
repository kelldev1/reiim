import React, { useEffect, useRef, useState } from 'react';
import {
  Bookmark,
  BookmarkCheck,
  Check,
  Copy,
  ExternalLink,
  FileText,
  FileUp,
  PenLine,
  Play,
  Plus,
  Search,
  Share2,
  Sparkles,
  X,
} from 'lucide-react';
import { useWork } from '@/lib/devoir-work';
import { useAuth } from '@/lib/auth';
import { askAI, AIError } from '@/lib/ai';
import { searchVideos, VideoError, type Video } from '@/lib/videos';
import { Loader } from '@/components/ui/loader';

// Chargé à la demande : react-markdown + KaTeX pèsent ~400 Ko, inutiles tant
// qu'on n'a pas ouvert un espace « Exercices pratiques » avec une réponse.
const Markdown = React.lazy(() =>
  import('@/components/ui/markdown').then((m) => ({ default: m.Markdown })),
);

const uid = () => Math.random().toString(36).slice(2, 9);

const inputCls =
  'w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/25';
const inputStyle: React.CSSProperties = {
  backgroundColor: 'rgb(var(--color-surface))',
  color: 'rgb(var(--color-fg))',
  borderColor: 'rgb(var(--color-fg) / 0.15)',
};

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{children}</p>
);

const PaneHead: React.FC<{ icon: React.ReactNode; children: React.ReactNode }> = ({
  icon,
  children,
}) => (
  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
    {icon}
    {children}
  </div>
);

const CheckBox: React.FC<{ on: boolean; onClick: () => void }> = ({ on, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={on ? 'Décocher' : 'Cocher'}
    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors"
    style={{
      borderColor: 'rgb(var(--color-fg) / 0.3)',
      backgroundColor: on ? 'rgb(var(--color-fg))' : 'transparent',
      color: 'rgb(var(--color-bg))',
    }}
  >
    {on && <Check className="h-3 w-3" />}
  </button>
);

const IconBtn: React.FC<{ label: string; onClick: () => void; children: React.ReactNode }> = ({
  label,
  onClick,
  children,
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    className="shrink-0 text-muted transition-colors hover:text-primary"
  >
    {children}
  </button>
);

const AddField: React.FC<{ placeholder: string; onAdd: (v: string) => void }> = ({
  placeholder,
  onAdd,
}) => {
  const [v, setV] = useState('');
  return (
    <input
      value={v}
      onChange={(e) => setV(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const t = v.trim();
          if (t) {
            onAdd(t);
            setV('');
          }
        }
      }}
      placeholder={placeholder}
      className={inputCls}
      style={inputStyle}
    />
  );
};

type Task = { id: string; text: string; done: boolean };

const TaskList: React.FC<{
  items: Task[];
  placeholder: string;
  onChange: (items: Task[]) => void;
}> = ({ items, placeholder, onChange }) => {
  const done = items.filter((i) => i.done).length;
  return (
    <div className="flex flex-col gap-2">
      {items.length > 0 && (
        <div
          className="h-1 w-full overflow-hidden rounded-full"
          style={{ backgroundColor: 'rgb(var(--color-fg) / 0.1)' }}
        >
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${(done / items.length) * 100}%`,
              backgroundColor: 'rgb(var(--color-fg))',
            }}
          />
        </div>
      )}
      {items.map((it) => (
        <div key={it.id} className="flex items-center gap-2">
          <CheckBox
            on={it.done}
            onClick={() =>
              onChange(items.map((x) => (x.id === it.id ? { ...x, done: !x.done } : x)))
            }
          />
          <input
            value={it.text}
            onChange={(e) =>
              onChange(items.map((x) => (x.id === it.id ? { ...x, text: e.target.value } : x)))
            }
            className={`flex-1 bg-transparent text-sm outline-none ${
              it.done ? 'text-muted line-through' : 'text-primary'
            }`}
          />
          <IconBtn label="Supprimer" onClick={() => onChange(items.filter((x) => x.id !== it.id))}>
            <X className="h-3.5 w-3.5" />
          </IconBtn>
        </div>
      ))}
      <AddField
        placeholder={placeholder}
        onAdd={(t) => onChange([...items, { id: uid(), text: t, done: false }])}
      />
    </div>
  );
};

const TagInput: React.FC<{
  tags: string[];
  placeholder: string;
  onChange: (tags: string[]) => void;
}> = ({ tags, placeholder, onChange }) => (
  <div
    className="flex flex-wrap items-center gap-1.5 rounded-lg border px-2 py-1.5"
    style={{ borderColor: 'rgb(var(--color-fg) / 0.15)' }}
  >
    {tags.map((t, i) => (
      <span
        key={i}
        className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-primary"
        style={{ backgroundColor: 'rgb(var(--color-fg) / 0.08)' }}
      >
        {t}
        <IconBtn label="Retirer" onClick={() => onChange(tags.filter((_, j) => j !== i))}>
          <X className="h-3 w-3" />
        </IconBtn>
      </span>
    ))}
    <input
      onKeyDown={(e) => {
        const el = e.currentTarget;
        if (e.key === 'Enter' && el.value.trim()) {
          e.preventDefault();
          onChange([...tags, el.value.trim()]);
          el.value = '';
        }
      }}
      placeholder={placeholder}
      className="min-w-[7rem] flex-1 bg-transparent text-sm text-primary outline-none"
    />
  </div>
);

/* ---------- Projets concrets ---------- */

type ProjectWork = { steps: Task[] };

const ProjectWorkspace: React.FC<{ workKey: string }> = ({ workKey }) => {
  const [data, set] = useWork<ProjectWork>(workKey, 'projets', { steps: [] });
  return (
    <div>
      <SectionLabel>Étapes du projet</SectionLabel>
      <TaskList
        items={data.steps}
        placeholder="Nouvelle étape, puis Entrée"
        onChange={(steps) => set({ steps })}
      />
    </div>
  );
};

/* ---------- Étude en groupe ---------- */

type GroupWork = { when: string; place: string; members: string[]; topics: Task[] };

const GroupWorkspace: React.FC<{ workKey: string }> = ({ workKey }) => {
  const [d, set] = useWork<GroupWork>(workKey, 'discussion', {
    when: '',
    place: '',
    members: [],
    topics: [],
  });
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <SectionLabel>Quand</SectionLabel>
          <input
            value={d.when}
            onChange={(e) => set((p) => ({ ...p, when: e.target.value }))}
            placeholder="Jeudi 18 h"
            className={inputCls}
            style={inputStyle}
          />
        </div>
        <div>
          <SectionLabel>Où</SectionLabel>
          <input
            value={d.place}
            onChange={(e) => set((p) => ({ ...p, place: e.target.value }))}
            placeholder="Bibliothèque"
            className={inputCls}
            style={inputStyle}
          />
        </div>
      </div>
      <div>
        <SectionLabel>Participants</SectionLabel>
        <TagInput
          tags={d.members}
          placeholder="Ajouter un nom, puis Entrée"
          onChange={(members) => set((p) => ({ ...p, members }))}
        />
      </div>
      <div>
        <SectionLabel>À aborder ensemble</SectionLabel>
        <TaskList
          items={d.topics}
          placeholder="Point à traiter, puis Entrée"
          onChange={(topics) => set((p) => ({ ...p, topics }))}
        />
      </div>
    </div>
  );
};

/* ---------- Cartes mentales : carte radiale ---------- */

type MindNode = { id: string; text: string; children: MindNode[] };
type MindWork = { root: MindNode; topic?: string };

const updateNode = (n: MindNode, id: string, fn: (x: MindNode) => MindNode): MindNode =>
  n.id === id ? fn(n) : { ...n, children: n.children.map((c) => updateNode(c, id, fn)) };

const dropNode = (n: MindNode, id: string): MindNode => ({
  ...n,
  children: n.children.filter((c) => c.id !== id).map((c) => dropNode(c, id)),
});

const BRANCH_COLORS = [
  '#6366f1',
  '#ec4899',
  '#14b8a6',
  '#f59e0b',
  '#8b5cf6',
  '#ef4444',
  '#0ea5e9',
  '#84cc16',
];

type Placed = {
  node: MindNode;
  x: number;
  y: number;
  depth: number;
  color: string;
  px: number;
  py: number;
};

// Rayon cumulé par niveau.
const RINGS = [0, 230, 250, 180, 150];

function placeTree(
  node: MindNode,
  angle: number,
  spread: number,
  depth: number,
  color: string,
  px: number,
  py: number,
  out: Placed[],
) {
  const r = RINGS.slice(0, depth + 1).reduce((s, v) => s + v, 0);
  const x = depth === 0 ? 0 : Math.cos(angle) * r;
  const y = depth === 0 ? 0 : Math.sin(angle) * r;
  out.push({ node, x, y, depth, color, px, py });

  const n = node.children.length;
  if (n === 0) return;

  if (depth === 0) {
    // Niveau 1 : réparti tout autour du centre, une couleur par branche.
    // Décalage d'un demi-pas quand n est pair → 2 branches = gauche/droite, etc.
    const start = -Math.PI / 2 + (n % 2 === 0 ? Math.PI / n : 0);
    for (let i = 0; i < n; i++) {
      const a = start + (i / n) * Math.PI * 2;
      placeTree(
        node.children[i],
        a,
        ((Math.PI * 2) / n) * 0.92,
        1,
        BRANCH_COLORS[i % BRANCH_COLORS.length],
        x,
        y,
        out,
      );
    }
  } else {
    const childSpread = spread * 0.82;
    for (let i = 0; i < n; i++) {
      const a = n === 1 ? angle : angle - childSpread / 2 + (childSpread * (i + 0.5)) / n;
      placeTree(node.children[i], a, childSpread, depth + 1, color, x, y, out);
    }
  }
}

/** Bulle de carte mentale : textarea qui s'adapte en hauteur au texte (retour à la ligne). */
const MindBubble: React.FC<{
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
  onFocus: () => void;
  style: React.CSSProperties;
}> = ({ value, placeholder, onChange, onFocus, style }) => {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${el.scrollHeight}px`;
  }, [value, style.width]);
  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onFocus={onFocus}
      onClick={(e) => e.stopPropagation()}
      className="resize-none overflow-hidden rounded-2xl border-0 text-center leading-snug outline-none transition-shadow focus:ring-2 focus:ring-black/10"
      style={style}
    />
  );
};

const clampTree = (j: any, depth = 0): MindNode => ({
  id: depth === 0 ? 'root' : uid(),
  text:
    String(j?.text ?? j?.name ?? '')
      .trim()
      .slice(0, 60) || (depth === 0 ? 'Idée centrale' : 'Branche'),
  children:
    depth >= 4 || !Array.isArray(j?.children)
      ? []
      : j.children.slice(0, 6).map((c: any) => clampTree(c, depth + 1)),
});

const parseMindmap = (answer: string): MindNode => {
  let s = answer.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  if (a >= 0 && b > a) s = s.slice(a, b + 1);
  return clampTree(JSON.parse(s));
};

const MindMapWorkspace: React.FC<{ workKey: string; subject: string; fill?: boolean }> = ({
  workKey,
  subject,
  fill = false,
}) => {
  const [d, set] = useWork<MindWork>(workKey, 'mindmap', {
    root: { id: 'root', text: subject || 'Idée centrale', children: [] },
  });
  const [sel, setSel] = useState<string | null>(null);
  const topic = d.topic ?? '';
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const generate = async () => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const { answer } = await askAI({ feature: 'mindmap', subject, prompt: topic });
      set((p) => ({ ...p, root: parseMindmap(answer) }));
      setSel(null);
    } catch (e) {
      setErr(e instanceof AIError ? e.message : "La carte n'a pas pu être générée.");
    } finally {
      setBusy(false);
    }
  };

  const change = (id: string, fn: (n: MindNode) => MindNode) =>
    set((p) => ({ root: updateNode(p.root, id, fn) }));
  const addChild = (id: string) => {
    const nid = uid();
    change(id, (n) => ({
      ...n,
      children: [...n.children, { id: nid, text: '', children: [] }],
    }));
    setSel(nid);
  };
  const remove = (id: string) => {
    set((p) => ({ root: dropNode(p.root, id) }));
    setSel(null);
  };

  const placed: Placed[] = [];
  placeTree(d.root, 0, Math.PI * 2, 0, 'rgb(var(--color-fg))', 0, 0, placed);

  const PAD = 190;
  const xs = placed.map((p) => p.x);
  const ys = placed.map((p) => p.y);
  const minX = Math.min(0, ...xs);
  const maxX = Math.max(0, ...xs);
  const minY = Math.min(0, ...ys);
  const maxY = Math.max(0, ...ys);
  const W = maxX - minX + PAD * 2;
  const H = maxY - minY + PAD * 2;
  const ox = PAD - minX;
  const oy = PAD - minY;

  // Centre la vue sur la racine à l'ouverture et après chaque (re)génération.
  useEffect(() => {
    const c = canvasRef.current;
    if (c) {
      c.scrollLeft = ox - c.clientWidth / 2;
      c.scrollTop = oy - c.clientHeight / 2;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [W, H]);

  const bubbleStyle = (p: Placed): React.CSSProperties => {
    if (p.depth === 0)
      return {
        width: 176,
        padding: '10px 16px',
        fontSize: 15,
        fontWeight: 700,
        backgroundColor: 'rgb(var(--color-fg))',
        color: 'rgb(var(--color-bg))',
        boxShadow: '0 8px 24px rgb(0 0 0 / 0.22)',
      };
    if (p.depth === 1)
      return {
        width: 152,
        padding: '8px 14px',
        fontSize: 13.5,
        fontWeight: 600,
        backgroundColor: p.color,
        color: '#ffffff',
        boxShadow: `0 5px 16px ${p.color}59`,
      };
    return {
      width: 148,
      padding: '6px 12px',
      fontSize: 12.5,
      fontWeight: 500,
      backgroundColor: 'rgb(var(--color-surface))',
      color: 'rgb(var(--color-fg))',
      border: `1.5px solid ${p.color}`,
      boxShadow: '0 2px 10px rgb(0 0 0 / 0.09)',
    };
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <PaneHead icon={<Share2 className="h-3.5 w-3.5" />}>Carte mentale</PaneHead>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={topic}
          onChange={(e) => set((p) => ({ ...p, topic: e.target.value }))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void generate();
          }}
          placeholder="Sujet de la carte (ex. la Révolution française)…"
          className={`${inputCls} min-w-[12rem] flex-1`}
          style={inputStyle}
        />
        <button
          type="button"
          onClick={generate}
          disabled={busy}
          className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-40"
          style={{ backgroundColor: 'rgb(var(--color-fg))', color: 'rgb(var(--color-bg))' }}
        >
          {busy ? <Loader variant="dots" size={16} /> : <Sparkles className="h-4 w-4" />}
          {busy ? 'Génère…' : d.root.children.length ? 'Régénérer' : 'Générer'}
        </button>
        <span className="text-xs text-muted">gratuit</span>
      </div>
      {err ? (
        <p className="text-xs" style={{ color: 'rgb(239 68 68)' }}>
          {err}
        </p>
      ) : (
        <p className="text-[11px] text-muted-soft">
          « Générer » crée une carte de départ (gratuit) — ensuite tu l'édites : clique une
          bulle → « + » pour une branche, « × » pour supprimer.
        </p>
      )}
      <div
        ref={canvasRef}
        className={`flex overflow-auto rounded-xl border ${fill ? 'min-h-0 flex-1' : 'h-[460px]'}`}
        style={{
          borderColor: 'rgb(var(--color-fg) / 0.12)',
          backgroundColor: 'rgb(var(--color-fg) / 0.015)',
        }}
        onClick={() => setSel(null)}
      >
        <div
          className="relative m-auto"
          style={{
            width: W,
            height: H,
            backgroundImage:
              'radial-gradient(circle, rgb(var(--color-fg) / 0.07) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        >
          <svg className="absolute inset-0" width={W} height={H}>
            {placed
              .filter((p) => p.depth > 0)
              .map((p) => {
                const x1 = ox + p.px;
                const y1 = oy + p.py;
                const x2 = ox + p.x;
                const y2 = oy + p.y;
                const dx = x2 - x1;
                const dy = y2 - y1;
                const dd =
                  Math.abs(dx) > Math.abs(dy)
                    ? `M ${x1} ${y1} C ${x1 + dx * 0.5} ${y1}, ${x1 + dx * 0.5} ${y2}, ${x2} ${y2}`
                    : `M ${x1} ${y1} C ${x1} ${y1 + dy * 0.5}, ${x2} ${y1 + dy * 0.5}, ${x2} ${y2}`;
                return (
                  <path
                    key={p.node.id}
                    d={dd}
                    fill="none"
                    stroke={p.color}
                    strokeWidth={p.depth === 1 ? 3 : p.depth === 2 ? 2 : 1.5}
                    strokeOpacity={0.5}
                    strokeLinecap="round"
                  />
                );
              })}
          </svg>
          {placed.map((p) => {
            const isRoot = p.depth === 0;
            const selected = sel === p.node.id;
            return (
              <div
                key={p.node.id}
                className="absolute"
                style={{ left: ox + p.x, top: oy + p.y, transform: 'translate(-50%,-50%)' }}
              >
                <div className="relative">
                  <MindBubble
                    value={p.node.text}
                    placeholder={isRoot ? 'Idée centrale' : 'branche'}
                    onChange={(v) => change(p.node.id, (n) => ({ ...n, text: v }))}
                    onFocus={() => setSel(p.node.id)}
                    style={bubbleStyle(p)}
                  />
                  {selected && (
                    <div className="absolute left-full top-1/2 ml-1 flex -translate-y-1/2 items-center gap-1">
                      {p.depth < 4 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            addChild(p.node.id);
                          }}
                          aria-label="Ajouter une branche"
                          className="flex h-6 w-6 items-center justify-center rounded-full shadow-md"
                          style={{
                            backgroundColor: isRoot ? 'rgb(var(--color-fg))' : p.color,
                            color: isRoot ? 'rgb(var(--color-bg))' : '#ffffff',
                          }}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {!isRoot && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            remove(p.node.id);
                          }}
                          aria-label="Supprimer"
                          className="flex h-6 w-6 items-center justify-center rounded-full text-muted shadow-md transition-colors hover:text-primary"
                          style={{ backgroundColor: 'rgb(var(--color-surface))' }}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/* ---------- Exercices pratiques : l'assistant fait le devoir ---------- */

type ExerciseWork = { brief: string; answer: string; pdfName?: string };

const readB64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(new Error('read-failed'));
    r.readAsDataURL(file);
  });

const ExerciseWorkspace: React.FC<{ workKey: string; subject: string; fill?: boolean }> = ({
  workKey,
  subject,
  fill = false,
}) => {
  const { user, refreshProfile } = useAuth();
  const [d, set] = useWork<ExerciseWork>(workKey, 'exercices', { brief: '', answer: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // PDF gardé en mémoire pour la session (trop lourd pour localStorage — voir backlog).
  const [pdf, setPdf] = useState<{ b64: string; url: string; name: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(
    () => () => {
      if (pdf) URL.revokeObjectURL(pdf.url);
    },
    [pdf],
  );

  const pickPdf = async (file: File | undefined) => {
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setErr('Choisis un fichier PDF.');
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      setErr('PDF trop lourd (max 6 Mo).');
      return;
    }
    setErr(null);
    try {
      const b64 = await readB64(file);
      setPdf((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return { b64, url: URL.createObjectURL(file), name: file.name };
      });
      set((p) => ({ ...p, pdfName: file.name }));
    } catch {
      setErr('Lecture du PDF impossible.');
    }
  };

  const run = async () => {
    if (busy || (!d.brief.trim() && !pdf)) return;
    setBusy(true);
    setErr(null);
    try {
      const { answer } = await askAI({
        feature: 'exercices',
        subject,
        prompt: d.brief,
        pdf: pdf?.b64,
      });
      set((p) => ({ ...p, answer }));
      void refreshProfile();
    } catch (e) {
      setErr(e instanceof AIError ? e.message : 'Une erreur est survenue.');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(d.answer);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* presse-papiers indisponible */
    }
  };

  const noCredits = !!user && user.credits <= 0;
  const canRun = !busy && !noCredits && (!!d.brief.trim() || !!pdf);
  const grow = fill ? 'min-h-0 flex-1' : '';

  const enonce = (
    <div className="flex min-h-0 flex-col gap-2.5">
      <PaneHead icon={<FileText className="h-3.5 w-3.5" />}>Énoncé</PaneHead>
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          void pickPdf(e.target.files?.[0]);
        }}
      />
      {pdf ? (
        <>
          <object
            data={pdf.url}
            type="application/pdf"
            className={`w-full rounded-xl border shadow-sm ${fill ? grow : 'h-[300px]'}`}
            style={{ borderColor: 'rgb(var(--color-fg) / 0.12)' }}
          >
            <p className="p-3 text-xs text-muted">
              Aperçu indisponible —{' '}
              <a href={pdf.url} target="_blank" rel="noreferrer" className="underline">
                ouvrir « {pdf.name} »
              </a>
            </p>
          </object>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="shrink-0 self-start text-xs text-muted transition-colors hover:text-primary"
          >
            Changer le PDF
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className={`group flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-sm text-muted transition-colors hover:text-primary ${
            fill ? grow : 'h-[160px]'
          }`}
          style={{ borderColor: 'rgb(var(--color-fg) / 0.2)' }}
        >
          <span
            className="flex h-11 w-11 items-center justify-center rounded-full transition-colors group-hover:text-primary"
            style={{ backgroundColor: 'rgb(var(--color-fg) / 0.06)' }}
          >
            <FileUp className="h-5 w-5" />
          </span>
          <span className="font-medium">Ajouter le PDF de l'exercice</span>
          <span className="text-[11px] text-muted-soft">
            {d.pdfName ? `à ré-ouvrir : ${d.pdfName}` : 'ou colle l’énoncé ci-dessous'}
          </span>
        </button>
      )}
      <textarea
        value={d.brief}
        onChange={(e) => set((p) => ({ ...p, brief: e.target.value }))}
        rows={3}
        placeholder={
          pdf ? 'Consigne ou précisions (optionnel)…' : "Colle l'énoncé, ou ajoute un PDF ci-dessus…"
        }
        className={`${inputCls} shrink-0 resize-none`}
        style={inputStyle}
      />
    </div>
  );

  const corrige = (
    <div
      className={`flex min-h-0 flex-col gap-2.5 ${
        fill ? 'lg:border-l lg:pl-6' : ''
      }`}
      style={fill ? { borderColor: 'rgb(var(--color-fg) / 0.08)' } : undefined}
    >
      <div className="flex items-center justify-between">
        <PaneHead icon={<PenLine className="h-3.5 w-3.5" />}>Devoir rédigé</PaneHead>
        {d.answer && (
          <button
            type="button"
            onClick={copy}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted transition-colors hover:text-primary"
            style={{ backgroundColor: 'rgb(var(--color-fg) / 0.05)' }}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copié' : 'Copier'}
          </button>
        )}
      </div>
      <div
        className={`overflow-y-auto rounded-xl border shadow-sm ${
          fill ? `${grow} p-6` : 'max-h-[440px] min-h-[120px] p-4'
        }`}
        style={{
          borderColor: 'rgb(var(--color-fg) / 0.1)',
          backgroundColor: 'rgb(var(--color-surface))',
        }}
      >
        {d.answer ? (
          <React.Suspense fallback={<Loader variant="dots" size={16} />}>
            <Markdown>{d.answer}</Markdown>
          </React.Suspense>
        ) : (
          <div className="flex h-full min-h-[80px] flex-col items-center justify-center gap-2 text-center">
            {busy ? (
              <>
                <Loader variant="dots" size={20} />
                <p className="text-sm text-muted">Rédaction en cours…</p>
              </>
            ) : (
              <>
                <PenLine className="h-6 w-6 text-muted-soft" />
                <p className="text-sm text-muted">Le devoir rédigé apparaîtra ici.</p>
              </>
            )}
          </div>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={run}
          disabled={!canRun}
          className="flex items-center gap-1.5 rounded-lg px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-40"
          style={{ backgroundColor: 'rgb(var(--color-fg))', color: 'rgb(var(--color-bg))' }}
        >
          <Sparkles className="h-4 w-4" />
          {busy ? 'Rédaction…' : d.answer ? 'Refaire' : 'Faire le devoir'}
        </button>
        {busy && <Loader variant="dots" size={18} />}
        {user && (
          <span className="ml-auto text-xs text-muted">
            {user.credits} crédit{user.credits > 1 ? 's' : ''}
          </span>
        )}
      </div>
      {noCredits && !err && (
        <p className="shrink-0 text-xs text-muted">
          Tu n'as plus de crédits — passe à une offre pour continuer.
        </p>
      )}
      {err && (
        <p className="shrink-0 text-xs" style={{ color: 'rgb(239 68 68)' }}>
          {err}
        </p>
      )}
      <p className="shrink-0 text-[11px] text-muted-soft">
        Le devoir est rédigé en entier. Relis-le, vérifie, et adapte-le à ta façon d'écrire.
      </p>
    </div>
  );

  return (
    <div
      className={`grid gap-6 ${fill ? 'min-h-0 flex-1 lg:grid-cols-[1fr_1.15fr]' : 'lg:grid-cols-2'}`}
    >
      {enonce}
      {corrige}
    </div>
  );
};

/* ---------- Vidéos explicatives : recherche YouTube + lecteur intégré ---------- */

type Pin = Video & { watched: boolean; notes: string };
type VideoWork = {
  query: string;
  results: Video[];
  currentId: string | null;
  pins: Pin[];
};

const ResultCard: React.FC<{
  v: Video;
  pinned: boolean;
  onPlay: () => void;
  onPin: () => void;
}> = ({ v, pinned, onPlay, onPin }) => (
  <div
    className="flex gap-2.5 rounded-lg border p-2 transition-colors"
    style={{ borderColor: 'rgb(var(--color-fg) / 0.1)' }}
  >
    <button
      type="button"
      onClick={onPlay}
      className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-md"
      style={{ backgroundColor: 'rgb(var(--color-fg) / 0.08)' }}
    >
      {v.thumb && <img src={v.thumb} alt="" className="h-full w-full object-cover" />}
      <span className="absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 transition-opacity hover:opacity-100">
        <Play className="h-6 w-6 fill-white text-white" />
      </span>
      {v.duration && (
        <span className="absolute bottom-0.5 right-0.5 rounded bg-black/75 px-1 text-[10px] font-medium text-white">
          {v.duration}
        </span>
      )}
    </button>
    <div className="flex min-w-0 flex-1 flex-col">
      <button type="button" onClick={onPlay} className="text-left">
        <p className="line-clamp-2 text-xs font-medium text-primary">{v.title}</p>
      </button>
      <p className="mt-0.5 truncate text-[11px] text-muted">{v.channel}</p>
      <div className="mt-auto flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={onPin}
          className="flex items-center gap-1 text-[11px] text-muted transition-colors hover:text-primary"
        >
          {pinned ? (
            <BookmarkCheck className="h-3.5 w-3.5" />
          ) : (
            <Bookmark className="h-3.5 w-3.5" />
          )}
          {pinned ? 'Ajoutée' : 'Ajouter'}
        </button>
        <a
          href={`https://www.youtube.com/watch?v=${v.id}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 text-[11px] text-muted transition-colors hover:text-primary"
        >
          <ExternalLink className="h-3 w-3" />
          YouTube
        </a>
      </div>
    </div>
  </div>
);

const VideoWorkspace: React.FC<{ workKey: string; subject: string; fill?: boolean }> = ({
  workKey,
  subject,
  fill = false,
}) => {
  const [d, set] = useWork<VideoWork>(workKey, 'vidéos', {
    query: '',
    results: [],
    currentId: null,
    pins: [],
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    if (busy || !d.query.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const results = await searchVideos(d.query, subject);
      set((p) => ({ ...p, results }));
    } catch (e) {
      setErr(e instanceof VideoError ? e.message : 'Une erreur est survenue.');
    } finally {
      setBusy(false);
    }
  };

  const isPinned = (id: string) => d.pins.some((p) => p.id === id);
  const togglePin = (v: Video) =>
    set((p) => ({
      ...p,
      pins: isPinned(v.id)
        ? p.pins.filter((x) => x.id !== v.id)
        : [...p.pins, { ...v, watched: false, notes: '' }],
    }));
  const patchPin = (id: string, patch: Partial<Pin>) =>
    set((p) => ({ ...p, pins: p.pins.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));

  const current =
    d.results.find((v) => v.id === d.currentId) ??
    d.pins.find((v) => v.id === d.currentId) ??
    null;

  const grow = fill ? 'min-h-0 flex-1' : '';

  const recherche = (
    <div className="flex min-h-0 flex-col gap-2.5">
      <PaneHead icon={<Search className="h-3.5 w-3.5" />}>Recherche</PaneHead>
      <div className="flex gap-2">
        <input
          value={d.query}
          onChange={(e) => set((p) => ({ ...p, query: e.target.value }))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void run();
          }}
          placeholder="Chapitre ou notion — ex. théorème de Pythagore"
          className={inputCls}
          style={inputStyle}
        />
        <button
          type="button"
          onClick={run}
          disabled={busy || !d.query.trim()}
          className="flex shrink-0 items-center gap-1.5 rounded-lg px-4 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-40"
          style={{ backgroundColor: 'rgb(var(--color-fg))', color: 'rgb(var(--color-bg))' }}
        >
          {busy ? <Loader variant="dots" size={16} /> : <Search className="h-4 w-4" />}
        </button>
      </div>
      <p className="text-[11px] text-muted-soft">Matière : {subject}</p>
      {err && (
        <p className="text-xs" style={{ color: 'rgb(239 68 68)' }}>
          {err}
        </p>
      )}
      <div className={`flex flex-col gap-2 overflow-y-auto ${fill ? grow : 'max-h-[360px]'}`}>
        {d.results.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">
            {busy ? 'Recherche…' : 'Cherche un chapitre pour voir des vidéos.'}
          </p>
        ) : (
          d.results.map((v) => (
            <ResultCard
              key={v.id}
              v={v}
              pinned={isPinned(v.id)}
              onPlay={() => set((p) => ({ ...p, currentId: v.id }))}
              onPin={() => togglePin(v)}
            />
          ))
        )}
      </div>
    </div>
  );

  const lecteur = (
    <div
      className={`flex min-h-0 flex-col gap-2.5 ${fill ? 'lg:border-l lg:pl-6' : ''}`}
      style={fill ? { borderColor: 'rgb(var(--color-fg) / 0.08)' } : undefined}
    >
      <PaneHead icon={<Play className="h-3.5 w-3.5" />}>Lecteur</PaneHead>
      <div
        className="aspect-video w-full shrink-0 overflow-hidden rounded-xl border shadow-sm"
        style={{
          borderColor: 'rgb(var(--color-fg) / 0.1)',
          backgroundColor: 'rgb(var(--color-fg) / 0.04)',
        }}
      >
        {current ? (
          <iframe
            key={current.id}
            src={`https://www.youtube-nocookie.com/embed/${current.id}`}
            title={current.title}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted">
            Choisis une vidéo à gauche.
          </div>
        )}
      </div>
      {current && <p className="shrink-0 text-xs font-medium text-primary">{current.title}</p>}

      <PaneHead icon={<Bookmark className="h-3.5 w-3.5" />}>
        Mes vidéos ({d.pins.filter((p) => p.watched).length}/{d.pins.length})
      </PaneHead>
      <div className={`flex flex-col gap-2 overflow-y-auto ${fill ? grow : 'max-h-[240px]'}`}>
        {d.pins.length === 0 ? (
          <p className="text-xs text-muted-soft">
            Ajoute des vidéos depuis les résultats pour les suivre ici.
          </p>
        ) : (
          d.pins.map((p) => (
            <div
              key={p.id}
              className="rounded-lg border p-2"
              style={{ borderColor: 'rgb(var(--color-fg) / 0.1)' }}
            >
              <div className="flex items-center gap-2">
                <CheckBox
                  on={p.watched}
                  onClick={() => patchPin(p.id, { watched: !p.watched })}
                />
                <button
                  type="button"
                  onClick={() => set((prev) => ({ ...prev, currentId: p.id }))}
                  className={`flex-1 truncate text-left text-xs ${
                    p.watched ? 'text-muted line-through' : 'text-primary'
                  }`}
                >
                  {p.title}
                </button>
                <IconBtn label="Retirer" onClick={() => togglePin(p)}>
                  <X className="h-3.5 w-3.5" />
                </IconBtn>
              </div>
              <input
                value={p.notes}
                onChange={(e) => patchPin(p.id, { notes: e.target.value })}
                placeholder="Note (ce que la vidéo t'apprend…)"
                className="mt-1.5 w-full bg-transparent text-xs text-primary outline-none"
              />
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div
      className={`grid gap-6 ${fill ? 'min-h-0 flex-1 lg:grid-cols-[1fr_1.2fr]' : 'lg:grid-cols-2'}`}
    >
      {recherche}
      {lecteur}
    </div>
  );
};

/* ---------- Révision (méthodes sans espace de travail) ---------- */

const METHOD_HINTS: Record<string, string> = {
  flashcards: 'Révise avec des flashcards / répétition espacée le jour prévu.',
};

const StudyReminder: React.FC<{ method: string }> = ({ method }) => (
  <div
    className="rounded-lg border border-dashed p-4 text-sm"
    style={{ borderColor: 'rgb(var(--color-fg) / 0.15)' }}
  >
    <p className="font-medium text-primary">Méthode de révision</p>
    <p className="mt-1 text-muted">
      {METHOD_HINTS[method] ?? 'Révise le jour prévu.'} Pas d'espace de travail à préparer ici — le
      jour J, coche le devoir quand c'est fait.
    </p>
  </div>
);

/* ---------- Dispatcher ---------- */

export const MethodWorkspace: React.FC<{
  method: string;
  workKey: string;
  subject: string;
  fill?: boolean;
}> = ({ method, workKey, subject, fill }) => {
  switch (method) {
    case 'exercices':
      return <ExerciseWorkspace workKey={workKey} subject={subject} fill={fill} />;
    case 'vidéos':
      return <VideoWorkspace workKey={workKey} subject={subject} fill={fill} />;
    case 'projets':
      return <ProjectWorkspace workKey={workKey} />;
    case 'discussion':
      return <GroupWorkspace workKey={workKey} />;
    case 'mindmap':
      return <MindMapWorkspace workKey={workKey} subject={subject} fill={fill} />;
    default:
      return <StudyReminder method={method} />;
  }
};
