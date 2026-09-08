import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarDays, LayoutDashboard, Menu, X, Sun, Moon, User, Users } from 'lucide-react';
import { useTheme } from '@/lib/theme';
import { useAuth } from '@/lib/auth';
import { listRequests } from '@/lib/friends';

export type Page = 'dashboard' | 'calendar' | 'friends' | 'profile';

interface NavbarProps {
  active?: Page;
  onNavigate?: (page: Page) => void;
  className?: string;
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || '?';

const Navbar: React.FC<NavbarProps> = ({
  active = 'calendar',
  onNavigate,
  className = '',
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();

  // Nombre de demandes d'amis reçues (badge sur l'onglet « Amis »).
  const [pending, setPending] = useState(0);
  useEffect(() => {
    if (!user) return;
    let alive = true;
    const tick = () =>
      void listRequests()
        .then((rs) => alive && setPending(rs.filter((r) => r.direction === 'in').length))
        .catch(() => {});
    tick();
    const id = setInterval(tick, 45000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [user, active]);

  const items: { key: Page; label: string; Icon: typeof CalendarDays; badge?: number }[] = [
    { key: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
    { key: 'calendar', label: 'Calendrier', Icon: CalendarDays },
    { key: 'friends', label: 'Amis', Icon: Users, badge: pending },
  ];
  const mobileItems = [...items, { key: 'profile' as Page, label: 'Profil', Icon: User }];

  return (
    <header
      className={`relative z-50 w-full ${className}`}
    >
      <nav className="relative grid grid-cols-3 items-center w-full px-4 md:px-8 py-3 md:py-4">
        <div className="flex items-center gap-3">
          <span className="hidden md:block text-sm font-semibold tracking-wide text-primary">
            reiim
          </span>
        </div>

        <div className="flex justify-center">
          <ul className="hidden md:flex items-center gap-1 rounded-full ui-chip p-1">
            {items.map(({ key, label, Icon, badge }) => {
              const isActive = active === key;
              return (
                <li key={key}>
                  <motion.button
                    onClick={() => onNavigate?.(key)}
                    className="relative flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors"
                    whileHover={{ y: -1 }}
                    whileTap={{ y: 0 }}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="nav-pill"
                        className="absolute inset-0 rounded-full ui-soft-fill-strong ui-border-strong"
                        transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                      />
                    )}
                    <Icon className="relative z-[1] h-4 w-4 text-primary" />
                    <span
                      className={`relative z-[1] ${
                        isActive ? 'text-primary' : 'text-muted hover:text-primary'
                      }`}
                    >
                      {label}
                    </span>
                    {!!badge && (
                      <span
                        className="relative z-[1] flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
                        style={{ backgroundColor: 'rgb(239 68 68)' }}
                      >
                        {badge}
                      </span>
                    )}
                  </motion.button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex items-center justify-end gap-2">
          <motion.button
            onClick={() => onNavigate?.('profile')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            aria-label="Profil"
            className="hidden md:flex h-9 w-9 items-center justify-center overflow-hidden rounded-full text-xs font-semibold transition-shadow"
            style={{
              backgroundColor:
                active === 'profile' ? 'rgb(var(--color-fg))' : 'rgb(var(--color-fg) / 0.08)',
              color: active === 'profile' ? 'rgb(var(--color-bg))' : 'rgb(var(--color-fg))',
              boxShadow:
                active === 'profile' ? '0 0 0 2px rgb(var(--color-fg) / 0.25)' : 'none',
            }}
          >
            {user?.avatar ? (
              <img src={user.avatar} alt="" className="h-full w-full object-cover" />
            ) : user ? (
              initials(user.name)
            ) : (
              <User className="h-4 w-4" />
            )}
          </motion.button>

          <motion.button
            onClick={toggleTheme}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            aria-label={theme === 'dark' ? 'Passer au thème clair' : 'Passer au thème sombre'}
            className="flex h-10 w-28 items-center justify-between px-3 rounded-full ui-chip hover:ui-soft-fill-strong transition-colors"
          >
            <AnimatePresence mode="wait" initial={false}>
              {theme === 'dark' ? (
                <>
                  <motion.span
                    key="sun"
                    initial={{ opacity: 0, rotate: -40, scale: 0.6 }}
                    animate={{ opacity: 1, rotate: 0, scale: 1 }}
                    exit={{ opacity: 0, rotate: 40, scale: 0.6 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center justify-center"
                  >
                    <Sun className="h-4 w-4 text-amber-400" />
                  </motion.span>
                  <span className="text-sm font-medium text-primary">
                    Clair
                  </span>
                </>
              ) : (
                <>
                  <motion.span
                    key="moon"
                    initial={{ opacity: 0, rotate: 40, scale: 0.6 }}
                    animate={{ opacity: 1, rotate: 0, scale: 1 }}
                    exit={{ opacity: 0, rotate: -40, scale: 0.6 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center justify-center"
                  >
                    <Moon className="h-4 w-4 text-primary" />
                  </motion.span>
                  <span className="text-sm font-medium text-primary">
                    Sombre
                  </span>
                </>
              )}
            </AnimatePresence>
          </motion.button>

          <div className="md:hidden">
            <button
              className="flex h-9 w-9 items-center justify-center rounded-lg ui-chip text-primary"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {mobileOpen && (
          <motion.ul
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            className="md:hidden flex flex-col gap-1 px-4 pb-3"
          >
            {mobileItems.map(({ key, label, Icon, badge }) => {
              const isActive = active === key;
              return (
                <li key={key}>
                  <button
                    onClick={() => {
                      onNavigate?.(key);
                      setMobileOpen(false);
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? 'ui-soft-fill-strong ui-border-strong border text-primary'
                        : 'text-muted hover:ui-soft-fill hover:text-primary border ui-border'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                    {!!badge && (
                      <span
                        className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
                        style={{ backgroundColor: 'rgb(239 68 68)' }}
                      >
                        {badge}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Navbar;
