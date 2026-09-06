import React, { useState } from 'react';
import { motion } from 'framer-motion';
import type { DayType } from '@/components/ui/visualize-booking';
import { cn } from '@/lib/utils';
import { CalendarDays, TrendingUp, CheckCircle, Circle, ChevronRight, Info } from 'lucide-react';
import { useBackground } from '@/lib/background';
import { useTheme } from '@/lib/theme';
import { BackgroundShaderStyle } from '@/lib/background-theme';

type KpiProps = {
  label: string;
  value: number;
  accent: 'blue' | 'violet' | 'emerald' | 'amber' | 'rose' | 'green';
  Icon?: React.ComponentType<{ className?: string }>;
  trend?: string;
};

const KpiCard: React.FC<KpiProps> = ({ label, value, accent, Icon, trend }) => {
  const accentsLight = {
    blue: 'from-sky-400/25 to-sky-400/0 text-sky-600 border-sky-300/40',
    violet: 'from-violet-400/25 to-violet-400/0 text-violet-600 border-violet-300/40',
    emerald: 'from-emerald-400/25 to-emerald-400/0 text-emerald-600 border-emerald-300/40',
    amber: 'from-amber-400/25 to-amber-400/0 text-amber-600 border-amber-300/40',
    rose: 'from-rose-400/25 to-rose-400/0 text-rose-600 border-rose-300/40',
    green: 'from-green-400/25 to-green-400/0 text-green-600 border-green-300/40',
  } as const;
  const accentsDark = {
    blue: 'from-blue-500/15 to-blue-500/0 text-blue-400/80 border-blue-500/10',
    violet: 'from-violet-500/15 to-violet-500/0 text-violet-400/80 border-violet-500/10',
    emerald: 'from-emerald-500/15 to-emerald-500/0 text-emerald-400/80 border-emerald-500/10',
    amber: 'from-amber-500/15 to-amber-500/0 text-amber-400/80 border-amber-500/10',
    rose: 'from-rose-500/15 to-rose-500/0 text-rose-400/80 border-rose-500/10',
    green: 'from-green-500/15 to-green-500/0 text-green-400/80 border-green-500/10',
  } as const;

  const accentsCls = `light:hidden ${accentsDark[accent]}`;
  const accentsClsLight = `hidden light:${accentsLight[accent]}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="relative flex flex-col gap-4 rounded-2xl ui-card p-4 md:p-5 overflow-hidden"
    >
      <div className={`pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-gradient-to-br blur-3xl ${accentsCls}`} />
      <div className={`pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-gradient-to-br blur-3xl ${accentsClsLight}`} />
      <div className="relative flex items-start justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br border ${accentsCls}`}>
          {Icon ? (
            <>
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br border ${accentsClsLight} absolute inset-0`}>
                <Icon className="h-5 w-5" />
              </div>
              <Icon className="h-5 w-5 relative z-10" />
            </>
          ) : (
            <div className="h-10 w-10" />
          )}
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-full ui-chip px-2.5 py-0.5 text-[10px] font-medium">
          <div className="h-1.5 w-1.5 rounded-full bg-current opacity-40" />
          <span>{trend ?? 'Ce mois-ci'}</span>
        </div>
      </div>
      <div className="relative flex flex-col gap-1">
        <span className="text-xs md:text-sm font-medium text-muted">{label}</span>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl md:text-4xl font-bold text-primary tabular-nums tracking-tight">
            {value.toLocaleString()}
          </span>
          <span className="text-xs text-muted-soft mb-1">-</span>
        </div>
      </div>
    </motion.div>
  );
};

const WeeklyBarChart: React.FC = () => {
  const weeks = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'];
  const heights = weeks.map(() => 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative flex flex-col gap-4 rounded-2xl ui-card p-4 md:p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5 min-w-0">
          <h3 className="text-sm md:text-base font-semibold text-primary">Réservations par semaine</h3>
          <p className="text-xs text-muted">Les 8 dernières semaines — aucune donnée</p>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-full ui-chip px-3 py-1.5 shrink-0 text-[11px]">
          <Info className="h-3.5 w-3.5" />
          <span>Semaines vides</span>
        </div>
      </div>

      <div className="relative h-48 md:h-56 w-full mt-2">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full opacity-[0.08]">
          <defs>
            <pattern id="grid2" width="12.5" height="25" patternUnits="userSpaceOnUse">
              <path d="M 12.5 0 L 0 0 0 25" fill="none" stroke="currentColor" strokeWidth="0.2" className="text-primary" />
            </pattern>
          </defs>
          <rect width="100" height="100" fill="url(#grid2)" />
        </svg>

        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2 pointer-events-none">
          <div className="h-10 w-10 rounded-full ui-border border ui-soft-fill flex items-center justify-center">
            <TrendingUp className="h-5 w-5 text-muted-soft" />
          </div>
          <p className="text-sm text-muted text-center">Aucune réservation enregistrée</p>
        </div>

        <div className="relative h-full w-full flex items-end justify-between gap-2 md:gap-3 px-1">
          {weeks.map((label, i) => {
            return (
              <div key={label} className="flex flex-1 flex-col items-center gap-2 h-full">
                <div className="relative flex-1 w-full flex items-end">
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${heights[i]}%` }}
                    transition={{ delay: i * 0.05, duration: 0.5, ease: 'easeOut' }}
                    className="relative w-full rounded-t-lg rounded-b-md ui-soft-fill ui-border border overflow-hidden"
                  />
                </div>
                <div className="text-[11px] md:text-xs font-medium text-muted-soft">{label}</div>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
};

const PlatformDonut: React.FC = () => {
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const segments = [
    { label: 'En ligne', pct: 0, colorDark: 'rgba(59,130,246,0.35)', colorLight: 'rgba(255,154,138,0.75)' },
    { label: 'Sur place', pct: 0, colorDark: 'rgba(16,185,129,0.35)', colorLight: 'rgba(126,199,155,0.75)' },
    { label: 'Livraison', pct: 0, colorDark: 'rgba(139,92,246,0.35)', colorLight: 'rgba(255,180,168,0.75)' },
    { label: 'Autre', pct: 0, colorDark: 'rgba(245,158,11,0.35)', colorLight: 'rgba(180,140,100,0.55)' },
  ];
  let offset = 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.05 }}
      className="relative flex flex-col gap-4 rounded-2xl ui-card p-4 md:p-5"
    >
      <div className="flex flex-col gap-1.5">
        <h3 className="text-sm md:text-base font-semibold text-primary">Répartition par type</h3>
        <p className="text-xs text-muted">Aucune donnée disponible</p>
      </div>

      <div className="grid grid-cols-[auto,1fr] gap-5 items-center">
        <div className="relative h-28 w-28 md:h-32 md:w-32 shrink-0">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
            <circle cx="50" cy="50" r={radius} fill="none" className="text-muted-soft/30" stroke="currentColor" strokeWidth="14" />
            {segments.map((s, i) => {
              const length = s.pct * circumference;
              const node = (
                <React.Fragment key={i}>
                  <circle
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="none"
                    stroke={s.colorDark}
                    strokeWidth="14"
                    strokeDasharray={`${length} ${circumference}`}
                    strokeDashoffset={-offset}
                    className="dark:opacity-100 light:opacity-0 opacity-100"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="none"
                    stroke={s.colorLight}
                    strokeWidth="14"
                    strokeDasharray={`${length} ${circumference}`}
                    strokeDashoffset={-offset}
                    className="dark:opacity-0 opacity-0 light:opacity-100"
                  />
                </React.Fragment>
              );
              offset += length;
              return node;
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-center">
            <span className="text-2xl font-bold text-primary tabular-nums">0</span>
            <span className="text-[11px] text-muted">Total</span>
          </div>
        </div>

        <ul className="flex flex-col gap-3">
          {segments.map((s, i) => (
            <li key={i} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-2.5 w-2.5 shrink-0 rounded-full light:opacity-0 opacity-100" style={{ backgroundColor: s.colorDark }} />
                <div className="h-2.5 w-2.5 shrink-0 rounded-full dark:opacity-0 opacity-0 light:opacity-100 absolute ml-0" style={{ backgroundColor: s.colorLight }} />
                <div className="relative h-2.5 w-2.5 shrink-0 rounded-full">
                  <div className="absolute inset-0 rounded-full dark:opacity-100 light:opacity-0 opacity-100" style={{ backgroundColor: s.colorDark }} />
                  <div className="absolute inset-0 rounded-full dark:opacity-0 light:opacity-100 opacity-0" style={{ backgroundColor: s.colorLight }} />
                </div>
                <span className="text-xs md:text-sm text-muted truncate">{s.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-14 md:w-20 rounded-full ui-soft-fill overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: '0%' }} />
                </div>
                <span className="text-xs font-medium text-muted-soft tabular-nums w-6 text-right">0%</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
};

const UpcomingList: React.FC<{ onGoToCalendar?: () => void }> = ({ onGoToCalendar }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="relative flex flex-col gap-3 rounded-2xl ui-card p-4 md:p-5 overflow-hidden"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-1.5 min-w-0">
          <h3 className="text-sm md:text-base font-semibold text-primary">À venir</h3>
          <p className="text-xs text-muted">0 réservation prévue</p>
        </div>
        <button
          onClick={onGoToCalendar}
          className="inline-flex items-center gap-1.5 rounded-lg ui-chip px-3 py-1.5 text-[11px] font-medium hover:ui-soft-fill-strong hover:text-primary transition-colors shrink-0"
        >
          <CalendarDays className="h-3.5 w-3.5" />
          <span>Voir le calendrier</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="rounded-xl ui-border border ui-soft-fill py-8 md:py-10 flex flex-col items-center justify-center gap-3 -mx-1 mt-1">
        <div className="h-12 w-12 rounded-2xl ui-border border bg-white/[0.03] dark:bg-white/5 flex items-center justify-center ui-soft-fill-strong">
          <CalendarDays className="h-6 w-6 text-muted-soft" />
        </div>
        <div className="flex flex-col items-center gap-1 text-center px-4">
          <p className="text-sm md:text-base font-medium text-muted">Aucune réservation à venir</p>
          <p className="text-xs text-muted-soft max-w-sm">Ajoutez des créneaux dans le calendrier, ils apparaîtront ici automatiquement.</p>
        </div>
      </div>

      <ul className="hidden">
        {[]}
      </ul>
    </motion.div>
  );
};

const MiniHeatmap: React.FC<{ days: DayType[] }> = ({ days }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className="relative flex flex-col gap-3 rounded-2xl ui-card p-4 md:p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-1.5 min-w-0">
          <h3 className="text-sm md:text-base font-semibold text-primary">Activité du mois</h3>
          <p className="text-xs text-muted">0 jours actifs — 0 réservations</p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl ui-border border ui-soft-fill">
          <CheckCircle className="h-4 w-4 text-muted-soft" />
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5 md:gap-2 mb-1">
        {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((d, i) => (
          <div key={i} className="h-2.5 w-full flex items-center justify-center text-[10px] font-medium text-muted-soft">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5 md:gap-2">
        {days.slice(3, 45).map((d, i) => {
          const isEmpty = d.day.startsWith('-') || d.day.startsWith('+');
          const dayNum = isEmpty ? '' : d.day;
          return (
            <div
              key={i}
              className={cn(
                'aspect-square rounded-md flex items-center justify-center text-[9px] md:text-[10px] font-medium tabular-nums ui-soft-fill',
                isEmpty ? 'opacity-0' : 'text-muted-soft'
              )}
              title={dayNum || undefined}
            >
              {!isEmpty && dayNum}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-1">
        <span className="text-[10px] text-muted-soft">Légende</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-soft">Vide</span>
          <div className="h-3 w-3 rounded-sm ui-soft-fill" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-3 w-3 rounded-sm ui-soft-fill" />
          ))}
          <span className="text-[10px] text-muted-soft">Plein</span>
        </div>
      </div>
    </motion.div>
  );
};

type DAYS_TYPE = DayType[];
const EMPTY_DAYS: DAYS_TYPE = (() => {
  const arr: DAYS_TYPE = [];
  for (let i = -3; i <= 41; i++) {
    const n = i < 1 || i > 30;
    arr.push({
      day: i < 1 ? `${i}` : i > 30 ? `+${i - 30}` : i.toString().padStart(2, '0'),
      classNames: n ? 'bg-white/[0.02]' : 'bg-white/[0.05]',
    });
  }
  return arr;
})();

interface DashboardProps {
  onGoToCalendar?: () => void;
  className?: string;
}

const Dashboard: React.FC<DashboardProps> = ({ onGoToCalendar, className = '' }) => {
  const [customizationOpen, setCustomizationOpen] = useState(false);
  const { background, setBackground, resetBackgroundToTheme } = useBackground();

  return (
    <div className={cn('w-full h-full overflow-y-auto', className)}>
      <div className="w-full px-3 sm:px-4 md:px-6 lg:px-8 xl:px-10 2xl:px-14 py-4 md:py-5 lg:py-6 flex flex-col gap-4 md:gap-5 lg:gap-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl ui-border border ui-soft-fill">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div className="flex flex-col gap-1">
              <h1 className="text-xl md:text-2xl font-bold text-primary tracking-tight">Vue d'ensemble</h1>
              <p className="text-xs md:text-sm text-muted">Statistiques du dashboard — toutes les données sont à 0</p>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 rounded-2xl ui-chip px-3 py-2 backdrop-blur-xl w-fit">
            <Circle className="h-4 w-4 text-muted fill-current opacity-30" />
            <div className="flex items-baseline gap-1.5">
              <span className="text-xs font-medium text-muted">Période :</span>
              <span className="text-xs font-semibold text-primary">Ce mois-ci</span>
            </div>
          </div>
        </div>

        {/* Background Customization Section */}
        <div className="w-full mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-primary">Personnalisation de l'arrière-plan</h2>
            <button
              onClick={() => setCustomizationOpen(!customizationOpen)}
              className="text-sm font-medium text-primary hover:text-primary/70 transition-colors"
            >
              {customizationOpen ? 'Masquer' : 'Personnaliser'}
              <ChevronRight className="h-3 w-3 ml-1" />
            </button>
          </div>

          {customizationOpen && (
            <div className="rounded-2xl ui-card p-4">
              <div className="space-y-4">
                {/* Shader Style Selector */}
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-muted w-20">Style :</span>
                  <select
                    value={background.shaderStyle}
                    onChange={(e) => setBackground({ shaderStyle: e.target.value as BackgroundShaderStyle })}
                    className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/70 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="fluid">Fluide</option>
                    <option value="nebula">Nébuleuse</option>
                    <option value="plasma">Plasma</option>
                    <option value="flare">Éruption</option>
                    <option value="flame">Flamme</option>
                  </select>
                </div>

                {/* Color Pickers */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-muted mb-1">Couleur principale</label>
                    <input
                      type="color"
                      value={background.color1}
                      onChange={(e) => setBackground({ color1: e.target.value })}
                      className="w-12 h-12 rounded-xl border border-white/10 bg-white/5 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted mb-1">Couleur secondaire</label>
                    <input
                      type="color"
                      value={background.color2}
                      onChange={(e) => setBackground({ color2: e.target.value })}
                      className="w-12 h-12 rounded-xl border border-white/10 bg-white/5 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted mb-1">Couleur d'accent</label>
                    <input
                      type="color"
                      value={background.color3}
                      onChange={(e) => setBackground({ color3: e.target.value })}
                      className="w-12 h-12 rounded-xl border border-white/10 bg-white/5 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted mb-1">Couleur de lumière</label>
                    <input
                      type="color"
                      value={background.color4}
                      onChange={(e) => setBackground({ color4: e.target.value })}
                      className="w-12 h-12 rounded-xl border border-white/10 bg-white/5 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                </div>

                {/* Parameter Sliders */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-muted mb-1">Échelle</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="0.5"
                        max="3"
                        step="0.1"
                        value={background.scale}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          if (!isNaN(v)) {
                            setBackground({ scale: v });
                          }
                        }}
                        className="flex-1 h-1 bg-white/5 rounded-full"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-muted mb-1">Distorsion</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="0"
                        max="2"
                        step="0.05"
                        value={background.distortion}
                        onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) { setBackground({ distortion: v }); } }}
                        className="flex-1 h-1 bg-white/5 rounded-full"
                      />
                      <span className="text-xs text-muted-soft w-10 text-right">{background.distortion.toFixed(2)}</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-muted mb-1">Vitesse</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="0.1"
                        max="1"
                        step="0.01"
                        value={background.speed}
                        onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) { setBackground({ speed: v }); } }}
                        className="flex-1 h-1 bg-white/5 rounded-full"
                      />
                      <span className="text-xs text-muted-soft w-10 text-right">{background.speed.toFixed(2)}</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-muted mb-1">Intensité</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="0.5"
                        max="3"
                        step="0.1"
                        value={background.intensity}
                        onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) { setBackground({ intensity: v }); } }}
                        className="flex-1 h-1 bg-white/5 rounded-full"
                      />
                      <span className="text-xs text-muted-soft w-10 text-right">{background.intensity.toFixed(1)}</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-muted mb-1">Détail</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="1"
                        max="10"
                        step="1"
                        value={background.detail}
                        onChange={(e) => { const v = parseInt(e.target.value); if (!isNaN(v)) { setBackground({ detail: v }); } }}
                        className="flex-1 h-1 bg-white/5 rounded-full"
                      />
                      <span className="text-xs text-muted-soft w-10 text-right">{background.detail}</span>
                    </div>
                  </div>
                </div>

                {/* Preset Buttons */}
                <div className="flex flex-wrap gap-2 mt-4">
                  <button
                    onClick={() => resetBackgroundToTheme()}
                    className="flex-1 min-w-[80px] px-3 py-1.5 text-xs font-medium rounded-xl ui-chip hover:ui-soft-fill-strong transition-colors"
                  >
                    Thème par défaut
                  </button>

                  <button
                    onClick={() => {
                      // Randomize colors
                      const randomColor = () => '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
                      setBackground({
                        color1: randomColor(),
                        color2: randomColor(),
                        color3: randomColor(),
                        color4: randomColor(),
                      });
                    }}
                    className="flex-1 min-w-[80px] px-3 py-1.5 text-xs font-medium rounded-xl ui-chip hover:ui-soft-fill-strong transition-colors"
                  >
                    Couleurs aléatoires
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <KpiCard label="Réservations" value={0} accent="rose" trend="Ce mois" />
          <KpiCard label="Clients" value={0} accent="green" trend="Nouveaux" />
          <KpiCard label="Taux d'occupation" value={0} accent="emerald" trend="en %" />
          <KpiCard label="Revenu estimé" value={0} accent="amber" trend="en €" />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 md:gap-5">
          <div className="xl:col-span-3">
            <WeeklyBarChart />
          </div>
          <PlatformDonut />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-5">
          <div className="xl:col-span-2">
            <UpcomingList onGoToCalendar={onGoToCalendar} />
          </div>
          <MiniHeatmap days={EMPTY_DAYS} />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
