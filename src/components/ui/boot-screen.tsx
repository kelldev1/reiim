import { motion } from 'framer-motion';
import { Loader, type LoaderVariant } from '@/components/ui/loader';

// Swap this to try any of the 16 Loader variants (spinner, dots, bars,
// dot-matrix, dither, morph, comet, scramble, metaballs, newton, helix,
// percent, ascii*, ...).
const VARIANT: LoaderVariant = 'metaballs';

export default function BootScreen() {
  return (
    <motion.div
      className="absolute inset-0 z-[100] flex flex-col items-center justify-center gap-9 overflow-hidden"
      style={{ backgroundColor: 'rgb(var(--color-bg))' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
    >
      {/* breathing glow behind the mark */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 42%, rgb(var(--color-fg) / 0.07), transparent 60%)',
        }}
        animate={{ opacity: [0.4, 1, 0.4], scale: [0.92, 1.08, 0.92] }}
        transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
      />

      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 18 }}
      >
        <Loader variant={VARIANT} size={56} speed={1.1} label="Chargement" />
      </motion.div>

      {/* wordmark: wipe-in reveal + looping shimmer sweep */}
      <motion.div
        className="overflow-hidden"
        initial={{ clipPath: 'inset(0 100% 0 0)' }}
        animate={{ clipPath: 'inset(0 0% 0 0)' }}
        transition={{ delay: 0.25, duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
      >
        <motion.span
          className="block pl-[0.35em] text-[22px] font-semibold tracking-[0.35em] select-none"
          style={{
            color: 'transparent',
            backgroundImage:
              'linear-gradient(105deg, rgb(var(--color-fg) / 0.3) 0%, rgb(var(--color-fg) / 0.3) 40%, rgb(var(--color-fg)) 50%, rgb(var(--color-fg) / 0.3) 60%, rgb(var(--color-fg) / 0.3) 100%)',
            backgroundSize: '260% 100%',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
          }}
          animate={{ backgroundPosition: ['200% 0%', '-60% 0%'] }}
          transition={{ repeat: Infinity, duration: 1.8, ease: 'linear', delay: 0.9 }}
        >
          reiim
        </motion.span>
      </motion.div>
    </motion.div>
  );
}
