type ClassValue =
  | string
  | number
  | null
  | false
  | undefined
  | ClassValue[]
  | Record<string, boolean | null | undefined>;

function toVal(mix: ClassValue): string {
  let k: string;
  let y: string;
  let str = '';

  if (typeof mix === 'string' || typeof mix === 'number') {
    str += mix;
  } else if (typeof mix === 'object') {
    if (Array.isArray(mix)) {
      for (k = 0; k < mix.length; k++) {
        if (mix[k]) {
          if ((y = toVal(mix[k]))) {
            str && (str += ' ');
            str += y;
          }
        }
      }
    } else if (mix) {
      for (k in mix) {
        if (mix[k]) {
          str && (str += ' ');
          str += k;
        }
      }
    }
  }

  return str;
}

function clsx(...inputs: ClassValue[]): string {
  let i = 0;
  let tmp: ClassValue;
  let x: string;
  let out = '';

  while (i < inputs.length) {
    if ((tmp = inputs[i++])) {
      if ((x = toVal(tmp))) {
        out && (out += ' ');
        out += x;
      }
    }
  }

  return out;
}

function twMerge(...classLists: string[]): string {
  const map = new Map<string, string>();

  for (const classes of classLists) {
    for (const cls of classes.split(/\s+/)) {
      if (!cls) continue;

      let key = cls;
      const dashIdx = cls.lastIndexOf('-');
      if (dashIdx > 0) {
        const prefix = cls.slice(0, dashIdx);
        const suffix = cls.slice(dashIdx + 1);
        if (/^\d/.test(suffix) || /^\[.*\]$/.test(suffix)) {
          key = prefix;
        } else if (
          [
            'text',
            'bg',
            'border',
            'rounded',
            'w',
            'h',
            'p',
            'px',
            'py',
            'pl',
            'pr',
            'pt',
            'pb',
            'm',
            'mx',
            'my',
            'ml',
            'mr',
            'mt',
            'mb',
            'gap',
            'flex',
            'grid',
            'font',
          ].includes(prefix)
        ) {
          key = prefix;
        }
      }

      if (cls.startsWith('hover:') || cls.startsWith('focus:') || cls.startsWith('active:')) {
        map.set(cls, cls);
      } else {
        map.set(key, cls);
      }
    }
  }

  return Array.from(map.values()).join(' ');
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(...inputs));
}
