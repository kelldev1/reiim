import { useEffect, useRef, useState } from 'react';
import { motion, MotionConfig } from 'framer-motion';
import InteractiveCalendar from '@/components/ui/visualize-booking';
import Navbar, { type Page } from '@/components/ui/navbar';
import Dashboard from '@/components/ui/dashboard';
import Profile from '@/components/ui/profile';
import Friends from '@/components/ui/friends';
import AuraBackground from '@/components/ui/background';
import BootScreen from '@/components/ui/boot-screen';
import AuthScreen from '@/components/ui/auth-screen';
import { useTheme } from '@/lib/theme';
import { BackgroundProvider, useBackground } from '@/lib/background';
import { AuthProvider, useAuth } from '@/lib/auth';

const BOOT_MS = 1800;
const LOGIN_MS = 1400;

function AppShell() {
  const [page, setPage] = useState<Page>('dashboard');

  const view =
    page === 'dashboard' ? (
      <Dashboard onGoToCalendar={() => setPage('calendar')} className="w-full h-full" />
    ) : page === 'calendar' ? (
      <InteractiveCalendar className="w-full h-full" />
    ) : page === 'friends' ? (
      <Friends className="w-full h-full" />
    ) : (
      <Profile className="w-full h-full" />
    );

  return (
    <div className="flex flex-col h-full w-full">
      <Navbar active={page} onNavigate={setPage} />
      <div className="relative flex-1 min-h-0 w-full overflow-hidden">
        {/* Hard swap keyed by page + enter-only fade — no AnimatePresence/exit,
            which can deadlock under "reduced motion" and leave a page stuck. */}
        <motion.div
          key={page}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="w-full h-full"
        >
          {view}
        </motion.div>
      </div>
    </div>
  );
}

function Root() {
  const { theme } = useTheme();
  const background = useBackground();
  const { user, loading } = useAuth();

  const [booting, setBooting] = useState(true);
  const wasAuthed = useRef(false);

  // Boot loader on every app open.
  useEffect(() => {
    const t = setTimeout(() => setBooting(false), BOOT_MS);
    return () => clearTimeout(t);
  }, []);

  // Short loader on the transition into the app after a fresh login / signup.
  useEffect(() => {
    if (user && !wasAuthed.current) {
      wasAuthed.current = true;
      setBooting(true);
      const t = setTimeout(() => setBooting(false), LOGIN_MS);
      return () => clearTimeout(t);
    }
    if (!user) wasAuthed.current = false;
  }, [user]);

  const showLoader = booting || loading;

  return (
    <div className="relative w-screen h-screen flex flex-col overflow-hidden text-primary">
      <AuraBackground
        key={theme}
        shaderStyle={background.background.shaderStyle}
        scale={background.background.scale}
        distortion={background.background.distortion}
        speed={background.background.speed}
        intensity={background.background.intensity}
        detail={background.background.detail}
        color1={background.background.color1}
        color2={background.background.color2}
        color3={background.background.color3}
        color4={background.background.color4}
      />

      <div className="relative z-10 flex flex-col h-full w-full">
        {showLoader ? (
          <BootScreen />
        ) : !user ? (
          <AuthScreen />
        ) : (
          <AppShell />
        )}
      </div>
    </div>
  );
}

const AppWithProviders: React.FC = () => (
  // reducedMotion="user": on machines with "reduce motion" enabled, framer
  // skips transform/layout animations but still snaps elements to their final
  // state (and keeps opacity fades) instead of freezing on `initial`.
  <MotionConfig reducedMotion="user">
    <AuthProvider>
      <BackgroundProvider>
        <Root />
      </BackgroundProvider>
    </AuthProvider>
  </MotionConfig>
);

export default AppWithProviders;
