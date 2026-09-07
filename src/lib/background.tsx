import React, { createContext, useContext, useState, useEffect } from 'react';
import { useTheme } from './theme';

type BackgroundConfig = {
  shaderStyle: 'fluid' | 'nebula' | 'plasma' | 'flare' | 'flame';
  scale: number;
  distortion: number;
  speed: number;
  intensity: number;
  detail: number;
  color1: string;
  color2: string;
  color3: string;
  color4: string;
};

export type ShaderStyle = BackgroundConfig['shaderStyle'];

interface BackgroundContextValue {
  background: BackgroundConfig;
  setBackground: (config: Partial<BackgroundConfig>) => void;
  resetBackgroundToTheme: () => void;
}

const BackgroundContext = createContext<BackgroundContextValue | undefined>(undefined);

export const BackgroundProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { theme } = useTheme();
  const [background, setBackgroundState] = useState<BackgroundConfig>(() => {
    const preset = THEME_PRESETS[theme];
    return {
      shaderStyle: preset.shaderStyle,
      scale: preset.scale,
      distortion: preset.distortion,
      speed: preset.speed,
      intensity: preset.intensity,
      detail: preset.detail,
      color1: preset.color1,
      color2: preset.color2,
      color3: preset.color3,
      color4: preset.color4,
    };
  });

  // Reset background to theme preset when theme changes
  useEffect(() => {
    const preset = THEME_PRESETS[theme];
    setBackgroundState({
      shaderStyle: preset.shaderStyle,
      scale: preset.scale,
      distortion: preset.distortion,
      speed: preset.speed,
      intensity: preset.intensity,
      detail: preset.detail,
      color1: preset.color1,
      color2: preset.color2,
      color3: preset.color3,
      color4: preset.color4,
    });
  }, [theme]);

  const setBackground = (config: Partial<BackgroundConfig>) => {
    setBackgroundState(prev => ({ ...prev, ...config }));
  };

  const resetBackgroundToTheme = () => {
    const preset = THEME_PRESETS[theme];
    setBackgroundState({
      shaderStyle: preset.shaderStyle,
      scale: preset.scale,
      distortion: preset.distortion,
      speed: preset.speed,
      intensity: preset.intensity,
      detail: preset.detail,
      color1: preset.color1,
      color2: preset.color2,
      color3: preset.color3,
      color4: preset.color4,
    });
  };

  return (
    <BackgroundContext.Provider value={{ background, setBackground, resetBackgroundToTheme }} >
      {children}
    </BackgroundContext.Provider>
  );
};

export const useBackground = (): BackgroundContextValue => {
  const ctx = useContext(BackgroundContext);
  if (!ctx) throw new Error('useBackground must be used within BackgroundProvider');
  return ctx;
};

const THEME_PRESETS = {
  dark: {
    shaderStyle: 'nebula' as const,
    scale: 1.9,
    distortion: 0.8,
    speed: 0.3,
    intensity: 1.4,
    detail: 5,
    color1: '#06041a',
    color2: '#2a14b8',
    color3: '#5b2cff',
    color4: '#b8a8ff',
  },
  light: {
    shaderStyle: 'nebula' as const,
    scale: 2.0,
    distortion: 0.7,
    speed: 0.28,
    intensity: 0.85,
    detail: 5,
    color1: '#ffffff',
    color2: '#e6e6e6',
    color3: '#bfbfbf',
    color4: '#d8d8d8',
  },
};

export { THEME_PRESETS };