import { Loader, type LoaderVariant } from '@/components/ui/loader';

const VARIANTS: { variant: LoaderVariant; label: string }[] = [
  { variant: 'spinner', label: 'Spinner' },
  { variant: 'dots', label: 'Dots' },
  { variant: 'bars', label: 'Bars' },
  { variant: 'dot-matrix', label: 'Dot Matrix' },
  { variant: 'dither', label: 'Dither' },
  { variant: 'morph', label: 'Morph' },
  { variant: 'comet', label: 'Comet' },
  { variant: 'metaballs', label: 'Metaballs' },
  { variant: 'newton', label: 'Newton' },
  { variant: 'helix', label: 'Helix' },
  { variant: 'scramble', label: 'Scramble' },
  { variant: 'percent', label: 'Percent' },
  { variant: 'ascii', label: 'ASCII' },
  { variant: 'ascii-braille', label: 'ASCII Braille' },
];

export default function LoaderDemo() {
  return (
    <div className="flex w-full items-center justify-center bg-background p-6 text-foreground">
      <div className="grid grid-cols-3 gap-x-10 gap-y-8 sm:grid-cols-4 md:grid-cols-5">
        {VARIANTS.map(({ variant, label }) => (
          <div key={variant} className="flex flex-col items-center gap-3">
            <div className="flex h-14 items-center justify-center">
              <Loader variant={variant} size={40} />
            </div>
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
