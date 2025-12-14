import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type ThemeMode = 'system' | 'light' | 'dark';

interface ThemeColors {
  primary: string;
  secondary: string;
}

interface ThemeStore {
  mode: ThemeMode;
  colors: ThemeColors;
  setMode: (mode: ThemeMode) => void;
  setColors: (colors: Partial<ThemeColors>) => void;
  resetColors: () => void;
}

const defaultColors: ThemeColors = {
  primary: '#6366f1', // Indigo
  secondary: '#8b5cf6', // Purple
};

// HEX to HSL 변환
export function hexToHsl(hex: string): string | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;

  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

// HSL string to HEX 변환
export function hslToHex(hsl: string): string {
  const match = hsl.match(/(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%?\s+(\d+(?:\.\d+)?)%?/);
  if (!match) return '#6366f1';

  const h = parseFloat(match[1]) / 360;
  const s = parseFloat(match[2]) / 100;
  const l = parseFloat(match[3]) / 100;

  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  const toHex = (x: number) => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// HEX to HSL object (내부 사용)
function hexToHSLObject(hex: string): { h: number; s: number; l: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { h: 0, s: 0, l: 0 };

  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      mode: 'system',
      colors: defaultColors,
      setMode: (mode) => set({ mode }),
      setColors: (colors) =>
        set((state) => ({
          colors: { ...state.colors, ...colors },
        })),
      resetColors: () => set({ colors: defaultColors }),
    }),
    {
      name: 'drss-theme-storage',
    }
  )
);

// CSS 변수 업데이트 함수
export function applyThemeColors(colors: ThemeColors) {
  const root = document.documentElement;
  const primary = hexToHSLObject(colors.primary);
  const secondary = hexToHSLObject(colors.secondary);

  root.style.setProperty('--primary', `${primary.h} ${primary.s}% ${primary.l}%`);
  root.style.setProperty('--primary-foreground', primary.l > 50 ? '0 0% 0%' : '0 0% 100%');
  root.style.setProperty('--secondary', `${secondary.h} ${secondary.s}% ${secondary.l}%`);
  root.style.setProperty('--secondary-foreground', secondary.l > 50 ? '0 0% 0%' : '0 0% 100%');

  // Accent (primary 기반)
  root.style.setProperty('--accent', `${primary.h} ${primary.s}% ${primary.l}%`);
  root.style.setProperty('--ring', `${primary.h} ${primary.s}% ${primary.l}%`);

  // Sidebar-specific variables (so sidebar uses user's custom colors)
  root.style.setProperty('--sidebar-primary', `${primary.h} ${primary.s}% ${primary.l}%`);
  root.style.setProperty('--sidebar-primary-foreground', primary.l > 50 ? '0 0% 0%' : '0 0% 100%');

  // Make a lighter accent for sidebar backgrounds (improve contrast)
  const sidebarAccentL = Math.min(primary.l + 35, 95);
  root.style.setProperty('--sidebar-accent', `${primary.h} ${primary.s}% ${sidebarAccentL}%`);
  root.style.setProperty('--sidebar-accent-foreground', sidebarAccentL > 50 ? '0 0% 0%' : '0 0% 100%');

  // Sidebar border and ring
  root.style.setProperty('--sidebar-border', `${primary.h} ${Math.min(primary.s, 20)}% ${Math.min(primary.l + 60, 97)}%`);
  root.style.setProperty('--sidebar-ring', `${primary.h} ${primary.s}% ${primary.l}%`);

  // Provide alpha variants for convenience (used by utility classes like /50)
  root.style.setProperty('--sidebar-accent-50', `hsl(${primary.h} ${primary.s}% ${primary.l}% / 0.5)`);
  root.style.setProperty('--accent-50', `hsl(${primary.h} ${primary.s}% ${primary.l}% / 0.5)`);
  root.style.setProperty('--sidebar-primary-50', `hsl(${primary.h} ${primary.s}% ${primary.l}% / 0.5)`);
}
