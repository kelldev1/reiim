import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, FileText, FileUp, PenLine, Plus, Sparkles, X } from 'lucide-react';
import { useWork } from '@/lib/devoir-work';
import { useAuth } from '@/lib/auth';
import { askAI, AIError } from '@/lib/ai';
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

const TextList: React.FC<{
  items: string[];
  placeholder: string;
  onChange: (items: string[]) => void;
}> = ({ items, placeholder, onChange }) => (
  <div className="flex flex-col gap-2">
    {items.map((t, i) => (
      <div key={i} className="flex items-center gap-2">
        <span className="text-muted">•</span>
        <input
          value={t}
          onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
          className="flex-1 bg-transparent text-sm text-primary outline-none"
        />
        <IconBtn label="Supprimer" onClick={() => onChange(items.filter((_, j) => j !== i))}>
          <X className="h-3.5 w-3.5" />
        </IconBtn>
      </div>
    ))}
    <AddField placeholder={placeholder} onAdd={(t) => onChange([...items, t])} />
  </div>
);

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

/* ---------- Cartes mentales ---------- */

type MindNode = { id: string; text: string; children: MindNode[] };
type MindWork = { root: MindNode };

const updateNode = (n: MindNode, id: string, fn: (x: MindNode) => MindNode): MindNode =>
  n.id === id ? fn(n) : { ...n, children: n.children.map((c) => updateNode(c, id, fn)) };

const dropNode = (n: MindNode, id: string): MindNode => ({
  ...n,
  children: n.children.filter((c) => c.id !== id).map((c) => dropNode(c, id)),
});

const Branch: React.FC<{
  node: MindNode;
  depth: number;
  onChange: (id: string, fn: (n: MindNode) => MindNode) => void;
  onDelete: (id: string) => void;
}> = ({ node, depth, onChange, onDelete }) => (
  <div className="flex flex-col gap-1.5" style={{ marginLeft: depth === 0 ? 0 : 16 }}>
    <div className="flex items-center gap-1.5">
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: `rgb(var(--color-fg) / ${depth === 0 ? 0.8 : 0.35})` }}
      />
      <input
        value={node.text}
        onChange={(e) => onChange(node.id, (n) => ({ ...n, text: e.target.value }))}
        placeholder={depth === 0 ? 'Idée centrale' : 'Branche'}
        className={`flex-1 bg-transparent outline-none ${
          depth === 0 ? 'text-sm font-semibold text-primary' : 'text-sm text-primary'
        }`}
      />
      {depth < 4 && (
        <IconBtn
          label="Ajouter une branche"
          onClick={() =>
            onChange(node.id, (n) => ({
              ...n,
              children: [...n.children, { id: uid(), text: '', children: [] }],
            }))
          }
        >
          <Plus className="h-3.5 w-3.5" />
        </IconBtn>
      )}
      {depth > 0 && (
        <IconBtn label="Supprimer" onClick={() => onDelete(node.id)}>
          <X className="h-3.5 w-3.5" />
        </IconBtn>
      )}
    </div>
    {node.children.map((c) => (
      <Branch key={c.id} node={c} depth={depth + 1} onChange={onChange} onDelete={onDelete} />
    ))}
  </div>
);

const MindMapWorkspace: React.FC<{ workKey: string; subject: string }> = ({ workKey, subject }) => {
  const [d, set] = useWork<MindWork>(workKey, 'mindmap', {
    root: { id: 'root', text: subject || 'Idée centrale', children: [] },
  });
  return (
    <div>
      <SectionLabel>Carte mentale</SectionLabel>
      <Branch
        node={d.root}
        depth={0}
        onChange={(id, fn) => set((p) => ({ root: updateNode(p.root, id, fn) }))}
        onDelete={(id) => set((p) => ({ root: dropNode(p.root, id) }))}
      />
    </div>
  );
};

/* ---------- Podcasts & audio ---------- */

type AudioItem = { id: string; title: string; url: string; done: boolean; note: string };
type AudioWork = { items: AudioItem[] };

const AudioWorkspace: React.FC<{ workKey: string }> = ({ workKey }) => {
  const [d, set] = useWork<AudioWork>(workKey, 'podcast', { items: [] });
  const patch = (id: string, p: Partial<AudioItem>) =>
    set((prev) => ({ items: prev.items.map((x) => (x.id === id ? { ...x, ...p } : x)) }));
  return (
    <div className="flex flex-col gap-3">
      <SectionLabel>Ressources audio</SectionLabel>
      {d.items.map((it) => (
        <div
          key={it.id}
          className="rounded-lg border p-2.5"
          style={{ borderColor: 'rgb(var(--color-fg) / 0.12)' }}
        >
          <div className="flex items-center gap-2">
            <CheckBox on={it.done} onClick={() => patch(it.id, { done: !it.done })} />
            <input
              value={it.title}
              onChange={(e) => patch(it.id, { title: e.target.value })}
              placeholder="Titre de l'épisode"
              className="flex-1 bg-transparent text-sm font-medium text-primary outline-none"
            />
            <IconBtn
              label="Supprimer"
              onClick={() => set((prev) => ({ items: prev.items.filter((x) => x.id !== it.id) }))}
            >
              <X className="h-3.5 w-3.5" />
            </IconBtn>
          </div>
          <input
            value={it.url}
            onChange={(e) => patch(it.id, { url: e.target.value })}
            placeholder="Lien (https://…)"
            className="mt-1.5 w-full bg-transparent text-xs text-muted outline-none"
          />
          {it.url && (
            <a
              href={it.url}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-xs underline"
              style={{ color: 'rgb(var(--color-fg) / 0.7)' }}
            >
              Ouvrir
            </a>
          )}
          <input
            value={it.note}
            onChange={(e) => patch(it.id, { note: e.target.value })}
            placeholder="Note / minutage"
            className="mt-1.5 w-full bg-transparent text-xs text-primary outline-none"
          />
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          set((prev) => ({
            items: [...prev.items, { id: uid(), title: '', url: '', done: false, note: '' }],
          }))
        }
        className="rounded-lg border border-dashed py-2 text-xs font-medium text-muted transition-colors hover:text-primary"
        style={{ borderColor: 'rgb(var(--color-fg) / 0.2)' }}
      >
        + Ajouter une ressource
      </button>
    </div>
  );
};

/* ---------- Lecture active & synthèse ---------- */

type SynthWork = { ideas: string[]; questions: string[]; summary: string };

const SynthesisWorkspace: React.FC<{ workKey: string }> = ({ workKey }) => {
  const [d, set] = useWork<SynthWork>(workKey, 'lecture_active', {
    ideas: [],
    questions: [],
    summary: '',
  });
  return (
    <div className="flex flex-col gap-4">
      <div>
        <SectionLabel>Idées clés</SectionLabel>
        <TextList
          items={d.ideas}
          placeholder="Une idée, puis Entrée"
          onChange={(ideas) => set((p) => ({ ...p, ideas }))}
        />
      </div>
      <div>
        <SectionLabel>Questions à creuser</SectionLabel>
        <TextList
          items={d.questions}
          placeholder="Une question, puis Entrée"
          onChange={(questions) => set((p) => ({ ...p, questions }))}
        />
      </div>
      <div>
        <SectionLabel>Ma synthèse</SectionLabel>
        <textarea
          value={d.summary}
          onChange={(e) => set((p) => ({ ...p, summary: e.target.value }))}
          rows={4}
          placeholder="Reformule le cours avec tes propres mots…"
          className={`${inputCls} resize-none`}
          style={inputStyle}
        />
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

/* ---------- Révision (méthodes sans espace de travail) ---------- */

const METHOD_HINTS: Record<string, string> = {
  vidéos: 'Regarde des vidéos explicatives sur le sujet le jour prévu.',
  lecture: 'Lis le cours et prends des notes le jour prévu.',
  flashcards: 'Révise avec des flashcards / répétition espacée le jour prévu.',
  simulation: 'Fais la simulation ou le TP en laboratoire le jour prévu.',
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
    case 'projets':
      return <ProjectWorkspace workKey={workKey} />;
    case 'discussion':
      return <GroupWorkspace workKey={workKey} />;
    case 'mindmap':
      return <MindMapWorkspace workKey={workKey} subject={subject} />;
    case 'podcast':
      return <AudioWorkspace workKey={workKey} />;
    case 'lecture_active':
      return <SynthesisWorkspace workKey={workKey} />;
    default:
      return <StudyReminder method={method} />;
  }
};
