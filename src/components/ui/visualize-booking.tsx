import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { LayoutDashboard, LayoutGrid, GripVertical, Trash2 } from 'lucide-react';
import { MethodWorkspace } from '@/components/ui/method-workspaces';

const daysOfWeek = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

export interface Selection {
  subject: string;
  methods: string[];
}
export type Selections = Record<string, Selection>;

const STORAGE_KEY = 'reiim-learning-selections';

export const SUBJECTS = [
  { value: 'mathématiques', label: 'Mathématiques', color: '#3b82f6' },
  { value: 'physique', label: 'Physique', color: '#ef4444' },
  { value: 'chimie', label: 'Chimie', color: '#10b981' },
  { value: 'biologie', label: 'Biologie', color: '#8b5cf6' },
  { value: 'histoire', label: 'Histoire', color: '#f59e0b' },
  { value: 'géographie', label: 'Géographie', color: '#06b6d4' },
  { value: 'langues', label: 'Langues', color: '#ec4899' },
  { value: 'programmation', label: 'Programmation', color: '#6366f1' },
  { value: 'philosophie', label: 'Philosophie', color: '#84cc16' },
  { value: 'littérature', label: 'Littérature', color: '#f97316' },
  { value: 'art', label: 'Art & Musique', color: '#d946ef' },
  { value: 'sport', label: 'Éducation physique', color: '#14b8a6' },
] as const;

export const METHODS = [
  { value: 'vidéos', label: 'Vidéos explicatives' },
  { value: 'exercices', label: 'Exercices pratiques' },
  { value: 'lecture', label: 'Lecture & notes' },
  { value: 'projets', label: 'Projets concrets' },
  { value: 'discussion', label: 'Étude en groupe' },
  { value: 'flashcards', label: 'Flashcards & mémorisation' },
  { value: 'mindmap', label: 'Cartes mentales' },
  { value: 'podcast', label: 'Podcasts & audio' },
  { value: 'simulation', label: 'Simulations & labos' },
  { value: 'lecture_active', label: 'Lecture active & synthèse' },
] as const;

const subjectMeta = (v: string) => SUBJECTS.find((s) => s.value === v);
const methodLabel = (v: string) => METHODS.find((m) => m.value === v)?.label ?? v;

const keyFor = (year: number, month: number, day: string) => `${year}-${month + 1}-${day}`;

const readSelections = (): Selections => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<
      string,
      { subject?: string; method?: string; methods?: string[] }
    >;
    const out: Selections = {};
    for (const [k, v] of Object.entries(parsed)) {
      const methods = v.methods ?? (v.method ? [v.method] : []);
      if (v.subject && methods.length) out[k] = { subject: v.subject, methods };
    }
    return out;
  } catch {
    return {};
  }
};
const writeSelections = (s: Selections) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
};

const DND_MIME = 'text/plain';
const DND_NEW = 'reiim:new';
const DND_MOVE = 'reiim:move:';

export type DayType = {
  day: string;
  classNames?: string;
  isToday?: boolean;
  selection?: Selection;
  meetingInfo?: {
    date: string;
    time: string;
    title: string;
    participants: string[];
    location: string;
  }[];
};

interface DayProps {
  day: DayType;
  dragActive: boolean;
  onOpen: (day: string) => void;
  onDropNew: (day: string) => void;
  onMove: (from: string, to: string) => void;
}

const Day: React.FC<DayProps> = ({ day, dragActive, onOpen, onDropNew, onMove }) => {
  const isPadding = day.day.startsWith('-') || day.day.startsWith('+');
  const [over, setOver] = useState(false);
  const [hovered, setHovered] = useState(false);
  const sub = day.selection ? subjectMeta(day.selection.subject) : undefined;

  const bg = over
    ? 'rgb(var(--color-fg) / 0.16)'
    : isPadding
      ? 'rgb(var(--color-fg) / 0.02)'
      : day.isToday
        ? 'rgb(var(--color-fg) / 0.10)'
        : hovered
          ? 'rgb(var(--color-fg) / 0.09)'
          : 'rgb(var(--color-fg) / 0.05)';

  const ring = over
    ? 'inset 0 0 0 2px rgb(var(--color-fg) / 0.55)'
    : day.isToday
      ? 'inset 0 0 0 2px rgb(var(--color-fg) / 0.35)'
      : dragActive && !isPadding
        ? 'inset 0 0 0 1px rgb(var(--color-fg) / 0.3)'
        : 'inset 0 0 0 1px rgb(var(--color-fg) / 0.06)';

  const dropHandlers = isPadding
    ? {}
    : {
        onDragEnter: (e: React.DragEvent) => {
          e.preventDefault();
          setOver(true);
        },
        onDragOver: (e: React.DragEvent) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        },
        onDragLeave: (e: React.DragEvent) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
        },
        onDrop: (e: React.DragEvent) => {
          e.preventDefault();
          setOver(false);
          const data = e.dataTransfer.getData(DND_MIME);
          if (data === DND_NEW) onDropNew(day.day);
          else if (data.startsWith(DND_MOVE)) {
            const from = data.slice(DND_MOVE.length);
            if (from !== day.day) onMove(from, day.day);
          }
        },
      };

  return (
    <motion.div
      className={`relative flex w-full h-full items-center justify-center overflow-hidden ${
        isPadding ? '' : 'cursor-pointer'
      }`}
      style={{
        borderRadius: 16,
        minHeight: '2.75rem',
        backgroundColor: bg,
        boxShadow: ring,
        transition: 'background-color .15s ease, box-shadow .15s ease',
      }}
      onClick={() => {
        if (!isPadding) onOpen(day.day);
      }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      {...dropHandlers}
      initial="rest"
      animate="rest"
      whileHover={isPadding ? undefined : 'hover'}
      variants={{ rest: { y: 0 }, hover: { y: -2 } }}
      transition={{ type: 'spring', stiffness: 400, damping: 22 }}
    >
      {!isPadding &&
        (day.selection ? (
          <span className="pointer-events-none absolute left-2 top-1.5 text-xs font-medium text-primary select-none md:text-sm">
            {day.day}
          </span>
        ) : (
          <motion.span
            className="pointer-events-none relative z-[1] text-sm font-medium text-primary select-none md:text-xl lg:text-2xl"
            variants={{ rest: { scale: 1 }, hover: { scale: 1.16 } }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
          >
            {day.day}
          </motion.span>
        ))}

      {!isPadding && day.selection && (
        <div
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData(DND_MIME, `${DND_MOVE}${day.day}`);
            e.dataTransfer.effectAllowed = 'move';
          }}
          onClick={(e) => {
            e.stopPropagation();
            onOpen(day.day);
          }}
          title={`${sub?.label ?? day.selection.subject} · ${day.selection.methods
            .map(methodLabel)
            .join(' · ')}`}
          className="absolute inset-x-1 bottom-1 flex cursor-grab items-center gap-1 rounded-md px-1.5 py-1 active:cursor-grabbing"
          style={{ backgroundColor: `${sub?.color ?? '#888888'}20` }}
        >
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: sub?.color ?? '#888888' }}
          />
          <span className="min-w-0 flex-1 truncate text-[10px] font-semibold leading-none text-primary">
            {sub?.label ?? day.selection.subject}
          </span>
          {day.selection.methods.length > 1 && (
            <span
              className="shrink-0 rounded px-1 text-[9px] font-bold leading-none text-primary"
              style={{ backgroundColor: 'rgb(var(--color-fg) / 0.15)' }}
            >
              ×{day.selection.methods.length}
            </span>
          )}
        </div>
      )}

      {!isPadding && dragActive && !day.selection && (
        <span className="pointer-events-none absolute bottom-1 right-2 text-base font-light text-primary/40">
          +
        </span>
      )}
    </motion.div>
  );
};

interface CalendarGridProps {
  days: DayType[];
  dragActive: boolean;
  onOpen: (day: string) => void;
  onDropNew: (day: string) => void;
  onMove: (from: string, to: string) => void;
}

const CalendarGrid: React.FC<CalendarGridProps> = ({
  days,
  dragActive,
  onOpen,
  onDropNew,
  onMove,
}) => (
  <div className="h-full grid grid-cols-7 grid-rows-6 auto-rows-fr gap-1.5 md:gap-2 lg:gap-3">
    {days.map((day, index) => (
      <Day
        key={`${day.day}-${index}`}
        day={day}
        dragActive={dragActive}
        onOpen={onOpen}
        onDropNew={onDropNew}
        onMove={onMove}
      />
    ))}
  </div>
);

const LearningSelectionCard: React.FC<{
  day: string;
  monthLabel: string;
  workKey: string;
  initial?: Selection;
  onClose: () => void;
  onSubmit: (subject: string, methods: string[]) => void;
  onDelete: () => void;
}> = ({ day, monthLabel, workKey, initial, onClose, onSubmit, onDelete }) => {
  const [setup, setSetup] = useState(!initial);
  const [subject, setSubject] = useState(initial?.subject ?? '');
  const [methods, setMethods] = useState<string[]>(initial?.methods ?? []);
  const [error, setError] = useState<string | null>(null);

  const subMeta = subjectMeta(subject);
  // Keep method order stable (as declared in METHODS) so the stacked workspaces
  // don't jump around when toggled.
  const orderedMethods = METHODS.filter((m) => methods.includes(m.value)).map((m) => m.value);
  // Mode plein écran pour les méthodes à 2 colonnes (exercices : énoncé / corrigé,
  // vidéos : résultats / lecteur), quand c'est la seule méthode du devoir.
  const bigMode =
    !setup &&
    orderedMethods.length === 1 &&
    (orderedMethods[0] === 'exercices' || orderedMethods[0] === 'vidéos');

  const toggleMethod = (value: string) => {
    setMethods((prev) => (prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value]));
    setError(null);
  };

  const planify = () => {
    if (!subject) {
      setError('Choisis une matière.');
      return;
    }
    if (methods.length === 0) {
      setError('Choisis au moins une méthode.');
      return;
    }
    setError(null);
    onSubmit(subject, orderedMethods);
    setSetup(false);
  };

  return (
    <motion.div
      className={`fixed inset-0 z-50 flex items-center justify-center backdrop-blur-2xl ${
        bigMode ? 'p-2 sm:p-3' : 'p-4'
      }`}
      style={{ backgroundColor: 'rgb(var(--color-bg) / 0.92)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full rounded-2xl border shadow-xl ${
          bigMode ? 'max-w-none' : 'max-w-lg'
        }`}
        style={{ backgroundColor: 'rgb(var(--color-surface))', borderColor: 'rgb(var(--color-fg) / 0.12)' }}
      >
        <button
          onClick={onClose}
          aria-label="Fermer"
          className="absolute right-3 top-2 z-[1] text-2xl leading-none text-muted transition-colors hover:text-primary"
        >
          ×
        </button>

        <div
          className={`flex flex-col ${
            bigMode ? 'h-[94vh] gap-4 p-5' : 'max-h-[85vh] gap-5 overflow-y-auto p-6'
          }`}
        >
          {bigMode ? (
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2.5">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: subMeta?.color ?? '#888888' }}
                  />
                  <h3 className="truncate text-xl font-semibold text-primary">
                    {subMeta?.label ?? subject}
                  </h3>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {METHODS.find((x) => x.value === orderedMethods[0])?.label} ·{' '}
                  <span className="capitalize">
                    {day} {monthLabel}
                  </span>
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5 pr-7">
                <button
                  type="button"
                  onClick={() => setSetup(true)}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:text-primary"
                  style={{ backgroundColor: 'rgb(var(--color-fg) / 0.05)' }}
                >
                  Changer
                </button>
                <button
                  type="button"
                  onClick={onDelete}
                  aria-label="Supprimer ce devoir"
                  className="rounded-lg p-2 text-muted transition-colors hover:text-primary"
                  style={{ backgroundColor: 'rgb(var(--color-fg) / 0.05)' }}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <div>
              <h3 className="text-lg font-semibold text-primary">
                {setup ? 'Planifier un devoir' : 'Espace de travail'}
              </h3>
              <p className="text-sm capitalize text-muted">
                {day} {monthLabel}
              </p>
            </div>
          )}

          {setup ? (
            <>
              <div>
                <p className="mb-2 text-xs font-medium text-muted">Matière</p>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {SUBJECTS.map((s) => {
                    const active = subject === s.value;
                    return (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => {
                          setSubject(s.value);
                          setError(null);
                        }}
                        className="flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left text-xs font-medium transition-colors"
                        style={{
                          borderColor: active ? s.color : 'rgb(var(--color-fg) / 0.12)',
                          backgroundColor: active ? `${s.color}1f` : 'transparent',
                          color: 'rgb(var(--color-fg))',
                        }}
                      >
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: s.color }}
                        />
                        <span className="truncate">{s.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <p className="text-xs font-medium text-muted">Méthode(s) d'apprentissage</p>
                  <p className="text-[11px] text-muted-soft">
                    Plusieurs possibles — les espaces s'empilent
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {METHODS.map((m) => {
                    const active = methods.includes(m.value);
                    return (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => toggleMethod(m.value)}
                        className="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
                        style={{
                          borderColor: active
                            ? 'rgb(var(--color-fg))'
                            : 'rgb(var(--color-fg) / 0.15)',
                          backgroundColor: active ? 'rgb(var(--color-fg))' : 'transparent',
                          color: active ? 'rgb(var(--color-bg))' : 'rgb(var(--color-fg) / 0.75)',
                        }}
                      >
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {error && (
                <p className="text-xs" style={{ color: 'rgb(239 68 68)' }}>
                  {error}
                </p>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={planify}
                  className="flex-1 rounded-lg py-2.5 text-sm font-medium transition-opacity hover:opacity-90"
                  style={{ backgroundColor: 'rgb(var(--color-fg))', color: 'rgb(var(--color-bg))' }}
                >
                  {initial ? 'Mettre à jour' : 'Planifier'}
                </button>
                {initial && (
                  <button
                    type="button"
                    onClick={() => {
                      setSubject(initial.subject);
                      setMethods(initial.methods);
                      setError(null);
                      setSetup(false);
                    }}
                    className="rounded-lg border px-4 py-2.5 text-sm font-medium text-muted transition-colors hover:text-primary"
                    style={{ borderColor: 'rgb(var(--color-fg) / 0.15)' }}
                  >
                    Annuler
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              {!bigMode && (
                <div
                  className="flex items-start justify-between gap-3 rounded-xl p-3"
                  style={{ backgroundColor: `${subMeta?.color ?? '#888888'}14` }}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: subMeta?.color ?? '#888888' }}
                      />
                      <p className="truncate text-sm font-semibold text-primary">
                        {subMeta?.label ?? subject}
                      </p>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {orderedMethods.map((m) => (
                        <span
                          key={m}
                          className="rounded-full px-2 py-0.5 text-[10px] font-medium text-primary"
                          style={{ backgroundColor: 'rgb(var(--color-fg) / 0.08)' }}
                        >
                          {METHODS.find((x) => x.value === m)?.label ?? m}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSetup(true)}
                    className="shrink-0 text-xs font-medium text-muted transition-colors hover:text-primary"
                  >
                    Changer
                  </button>
                </div>
              )}

              <div className={`flex flex-col gap-4 ${bigMode ? 'min-h-0 flex-1' : ''}`}>
                {orderedMethods.map((m, i) => (
                  <div
                    key={m}
                    className={`${i > 0 ? 'border-t pt-4' : ''} ${
                      bigMode ? 'flex min-h-0 flex-1 flex-col' : ''
                    }`}
                    style={i > 0 ? { borderColor: 'rgb(var(--color-fg) / 0.1)' } : undefined}
                  >
                    {orderedMethods.length > 1 && (
                      <p className="mb-2 text-sm font-semibold text-primary">
                        {METHODS.find((x) => x.value === m)?.label ?? m}
                      </p>
                    )}
                    <MethodWorkspace
                      method={m}
                      workKey={workKey}
                      subject={subMeta?.label ?? subject}
                      fill={bigMode}
                    />
                  </div>
                ))}
              </div>

              {!bigMode && (
                <button
                  type="button"
                  onClick={onDelete}
                  className="flex items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium transition-colors"
                  style={{ borderColor: 'rgb(239 68 68 / 0.35)', color: 'rgb(239 68 68)' }}
                >
                  <Trash2 className="h-4 w-4" /> Supprimer ce devoir
                </button>
              )}
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

type CalendarProps = Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'onAnimationStart' | 'onAnimationEnd' | 'onAnimationIteration' | 'onDrag' | 'onDragStart' | 'onDragEnd'
>;

const InteractiveCalendar = React.forwardRef<HTMLDivElement, CalendarProps>((props, ref) => {
  const { className, ...restProps } = props;
  const [moreView, setMoreView] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [showCard, setShowCard] = useState(false);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selections, setSelections] = useState<Selections>({});
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    setSelections(readSelections());
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setCurrentDate(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const openDay = (day: string) => {
    setSelectedDay(day);
    setShowCard(true);
  };
  const closeCard = () => {
    setShowCard(false);
    setSelectedDay(null);
  };

  const saveSelection = (subject: string, methods: string[]) => {
    if (!selectedDay) return;
    setSelections((prev) => {
      const next = { ...prev, [keyFor(year, month, selectedDay)]: { subject, methods } };
      writeSelections(next);
      return next;
    });
    // Card stays open on the method workspace(s).
  };

  const deleteSelection = () => {
    if (!selectedDay) return;
    setSelections((prev) => {
      const next = { ...prev };
      delete next[keyFor(year, month, selectedDay)];
      writeSelections(next);
      return next;
    });
    closeCard();
  };

  const moveSelection = (from: string, to: string) => {
    setSelections((prev) => {
      const fromKey = keyFor(year, month, from);
      const moving = prev[fromKey];
      if (!moving) return prev;
      const next = { ...prev };
      delete next[fromKey];
      next[keyFor(year, month, to)] = moving;
      writeSelections(next);
      return next;
    });
  };

  const formattedDate = useMemo(
    () => new Intl.DateTimeFormat('fr-FR', { year: 'numeric', month: 'long' }).format(currentDate),
    [currentDate],
  );
  const monthLabel = useMemo(
    () => new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(currentDate),
    [currentDate],
  );

  const days = useMemo<DayType[]>(() => {
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startDow = firstDay.getDay();
    const prevMonthLast = new Date(year, month, 0).getDate();
    const today = new Date();

    const out: DayType[] = [];
    for (let i = startDow; i > 0; i--) out.push({ day: `-${prevMonthLast - i + 1}` });
    for (let d = 1; d <= daysInMonth; d++) {
      const dd = d.toString().padStart(2, '0');
      out.push({
        day: dd,
        isToday:
          d === today.getDate() && month === today.getMonth() && year === today.getFullYear(),
        selection: selections[keyFor(year, month, dd)],
      });
    }
    for (let i = 1; out.length < 42; i++) out.push({ day: `+${i}` });
    return out;
  }, [year, month, selections]);

  const plannedCount = useMemo(
    () => Object.keys(selections).filter((k) => k.startsWith(`${year}-${month + 1}-`)).length,
    [selections, year, month],
  );

  const changeMonth = (delta: number) =>
    setCurrentDate((prev) => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + delta);
      return d;
    });

  const currentSelection = selectedDay
    ? selections[keyFor(year, month, selectedDay)]
    : undefined;

  return (
      <motion.div
        ref={ref}
        className={`relative w-full h-full flex flex-col lg:flex-row items-stretch gap-4 lg:gap-8 p-3 md:p-6 lg:p-8 ${className ?? ''}`}
        {...restProps}
      >
        <motion.div
          layout
          className="w-full lg:flex-1 lg:max-w-none min-w-0 min-h-0 flex flex-col gap-4 lg:gap-6 flex-shrink-0"
        >
          <motion.div key="calendar-view" className="flex w-full flex-col gap-3 md:gap-4 h-full">
            <div className="flex w-full items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <motion.button
                  onClick={() => changeMonth(-1)}
                  className="flex items-center justify-center w-8 h-8 rounded-lg ui-chip hover:ui-soft-fill-strong transition-colors"
                  aria-label="Mois précédent"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </motion.button>
                <div className="flex flex-col items-center">
                  <motion.h2 className="mb-0 md:mb-1 text-2xl md:text-4xl lg:text-5xl font-bold tracking-wider text-primary select-none">
                    Calendrier
                  </motion.h2>
                  <p className="text-sm md:text-base lg:text-xl text-muted select-none">
                    {formattedDate}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <motion.button
                  className="relative flex items-center gap-3 rounded-lg ui-chip px-1.5 py-1 text-primary"
                  onClick={() => setMoreView(!moreView)}
                  aria-label="Basculer la vue"
                >
                  <LayoutDashboard className="h-4 w-4 md:h-5 md:w-5 z-[2]" />
                  <LayoutGrid className="h-4 w-4 md:h-5 md:w-5 z-[2]" />
                  <div
                    className="absolute left-0 top-0 h-[85%] w-7 md:w-8 rounded-md ui-soft-fill-strong ui-border border transition-transform duration-300"
                    style={{
                      top: '50%',
                      transform: moreView
                        ? 'translateY(-50%) translateX(44px)'
                        : 'translateY(-50%) translateX(4px)',
                    }}
                  ></div>
                </motion.button>
                <motion.button
                  onClick={() => changeMonth(1)}
                  className="flex items-center justify-center w-8 h-8 rounded-lg ui-chip hover:ui-soft-fill-strong transition-colors"
                  aria-label="Mois suivant"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </motion.button>
              </div>
            </div>

            {/* Drag source: a "devoir" you drop onto a day */}
            <div className="flex flex-shrink-0 items-center gap-3">
              <div
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(DND_MIME, DND_NEW);
                  e.dataTransfer.effectAllowed = 'copy';
                  setDragActive(true);
                }}
                onDragEnd={() => setDragActive(false)}
                className="flex cursor-grab select-none items-center gap-2 rounded-xl ui-chip border px-3 py-2 active:cursor-grabbing"
              >
                <GripVertical className="h-4 w-4 text-muted" />
                <span className="text-sm font-medium text-primary">Nouveau devoir</span>
              </div>
              <p className="hidden text-xs text-muted sm:block">
                {dragActive
                  ? 'Dépose-le sur un jour…'
                  : 'Glisse-le sur un jour, puis choisis la matière et la méthode'}
              </p>
              {plannedCount > 0 && (
                <span className="ml-auto whitespace-nowrap text-xs text-muted">
                  {plannedCount} planifié{plannedCount > 1 ? 's' : ''} ce mois
                </span>
              )}
            </div>

            <div className="grid grid-cols-7 gap-1.5 md:gap-2 lg:gap-3 flex-shrink-0">
              {daysOfWeek.map((d) => (
                <div
                  key={d}
                  className="rounded-xl ui-soft-fill-strong py-1.5 md:py-2 text-center text-[11px] md:text-sm font-semibold tracking-wider text-primary select-none"
                >
                  {d}
                </div>
              ))}
            </div>
            <div className="flex-1 min-h-0 min-w-0 flex-shrink">
              <CalendarGrid
                days={days}
                dragActive={dragActive}
                onOpen={openDay}
                onDropNew={openDay}
                onMove={moveSelection}
              />
            </div>
          </motion.div>
        </motion.div>

        {moreView && (
          <motion.div
            className="w-full lg:flex-1 lg:max-w-none min-w-0 min-h-0 flex flex-col gap-4 lg:gap-6 flex-shrink-0"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div key="more-view" className="mt-0 md:mt-4 flex w-full flex-col gap-4 h-full">
              <div className="flex w-full flex-col items-start justify-between gap-1 flex-shrink-0">
                <motion.h2 className="mb-0 md:mb-1 text-2xl md:text-4xl lg:text-5xl font-bold tracking-wider text-primary select-none">
                  Liste
                </motion.h2>
                <p className="font-medium text-muted text-xs md:text-sm">
                  {plannedCount === 0
                    ? 'Aucun devoir planifié ce mois'
                    : `${plannedCount} devoir${plannedCount > 1 ? 's' : ''} ce mois`}
                </p>
              </div>
              <motion.div
                className="flex-1 min-h-0 overflow-y-auto rounded-xl ui-border border ui-card"
                layout
              >
                {plannedCount === 0 ? (
                  <div className="flex h-full w-full items-center justify-center">
                    <div className="flex flex-col items-center gap-2 px-6 text-center">
                      <div className="h-10 w-10 rounded-full ui-border border ui-soft-fill" />
                      <p className="text-sm md:text-base text-muted">Aucune donnée</p>
                    </div>
                  </div>
                ) : (
                  <ul className="flex flex-col divide-y" style={{ borderColor: 'rgb(var(--color-fg) / 0.08)' }}>
                    {days
                      .filter((d) => d.selection)
                      .map((d) => {
                        const s = subjectMeta(d.selection!.subject);
                        return (
                          <li key={d.day}>
                            <button
                              onClick={() => openDay(d.day)}
                              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:ui-soft-fill"
                            >
                              <span
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold text-primary"
                                style={{ backgroundColor: `${s?.color ?? '#888888'}22` }}
                              >
                                {d.day}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium text-primary">
                                  {s?.label ?? d.selection!.subject}
                                </span>
                                <span className="block truncate text-xs text-muted">
                                  {d.selection!.methods.map(methodLabel).join(' · ')}
                                </span>
                              </span>
                            </button>
                          </li>
                        );
                      })}
                  </ul>
                )}
              </motion.div>
            </motion.div>
          </motion.div>
        )}

        {showCard && selectedDay && (
          <LearningSelectionCard
            key={selectedDay}
            day={selectedDay}
            monthLabel={monthLabel}
            workKey={keyFor(year, month, selectedDay)}
            initial={currentSelection}
            onClose={closeCard}
            onSubmit={saveSelection}
            onDelete={deleteSelection}
          />
        )}
      </motion.div>
  );
});
InteractiveCalendar.displayName = 'InteractiveCalendar';

export default InteractiveCalendar;
