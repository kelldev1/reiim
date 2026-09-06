import React, { createContext, useContext, useState } from 'react';

export type BackgroundShaderStyle = 'fluid' | 'nebula' | 'plasma' | 'flare' | 'flame';

export interface BackgroundCustomization {
  shaderStyle: BackgroundShaderStyle;
  scale: number;
  distortion: number;
  speed: number;
  intensity: number;
  detail: number;
  color1: string;
  color2: string;
  color3: string;
  color4: string;
}

export const DEFAULT_CUSTOMIZATION: BackgroundCustomization = {
  shaderStyle: 'nebula',
  scale: 1.9,
  distortion: 0.8,
  speed: 0.3,
  intensity: 1.4,
  detail: 5,
  color1: '#06041a',
  color2: '#2a14b8',
  color3: '#5b2cff',
  color4: '#b8a8ff',
};

const STORAGE_KEY = 'reiim-bg-custom';

interface ContextValue {
  customization: BackgroundCustomization | null;
  isCustom: boolean;
  setCustomization: (c: BackgroundCustomization) => void;
  save: (c?: BackgroundCustomization) => void;
  reset: () => void;
}

const BackgroundCustomizationContext = createContext<ContextValue | undefined>(undefined);

const readStored = (): BackgroundCustomization | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BackgroundCustomization>;
    return { ...DEFAULT_CUSTOMIZATION, ...parsed };
  } catch {
    return null;
  }
};

export const BackgroundCustomizationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [customization, setCustomizationState] = useState<BackgroundCustomization | null>(
    () => readStored(),
  );

  const setCustomization = (c: BackgroundCustomization) => {
    setCustomizationState(c);
  };

  const save = (c?: BackgroundCustomization) => {
    const value = c ?? customization;
    if (!value) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  };

  const reset = () => {
    setCustomizationState(null);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  };

  return (
    <BackgroundCustomizationContext.Provider
      value={{
        customization,
        isCustom: customization !== null,
        setCustomization,
        save,
        reset,
      }}
    >
      {children}
    </BackgroundCustomizationContext.Provider>
  );
};

export const useBackgroundCustomization = (): ContextValue => {
  const ctx = useContext(BackgroundCustomizationContext);
  if (!ctx)
    throw new Error(
      'useBackgroundCustomization must be used within BackgroundCustomizationProvider',
    );
  return ctx;
};
