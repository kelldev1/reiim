// Monitoring d'erreurs (Sentry) — actif UNIQUEMENT si VITE_SENTRY_DSN est défini.
// Chargé en import dynamique pour ne rien peser en dev / sans DSN.

const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;

let sentry: typeof import('@sentry/react') | null = null;

export async function initMonitoring(): Promise<void> {
  if (!DSN) return;
  try {
    const Sentry = await import('@sentry/react');
    Sentry.init({
      dsn: DSN,
      environment: import.meta.env.MODE,
      release: import.meta.env.VITE_APP_VERSION as string | undefined,
      // Pas de session replay ni de tracing par défaut (coût + RGPD).
      tracesSampleRate: 0,
      // Ne renvoie pas les valeurs des champs de formulaire, etc.
      sendDefaultPii: false,
    });
    sentry = Sentry;
  } catch {
    /* le monitoring ne doit jamais casser l'app */
  }
}

export function reportError(error: unknown, context?: Record<string, unknown>): void {
  if (!sentry) return;
  sentry.captureException(error, context ? { extra: context } : undefined);
}

export function setUserContext(id: string | null): void {
  if (!sentry) return;
  sentry.setUser(id ? { id } : null);
}
