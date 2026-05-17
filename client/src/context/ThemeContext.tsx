import React, { createContext, useContext, useState, useEffect } from 'react';

type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: (origin?: { x: number; y: number }) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Helper function to apply theme to DOM
function applyTheme(theme: Theme) {
  const daisyTheme = theme === 'dark' ? 'night' : 'light';
  document.documentElement.setAttribute('data-theme', daisyTheme);
  console.log('Applied theme:', theme, '-> DaisyUI theme:', daisyTheme);
}

function getMaxViewportRadius(origin: { x: number; y: number }) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const dx = Math.max(origin.x, vw - origin.x);
  const dy = Math.max(origin.y, vh - origin.y);
  return Math.hypot(dx, dy);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    // Initialize from localStorage if available
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('fishlers-theme');
      if (saved === 'light' || saved === 'dark') {
        return saved;
      }
    }
    return 'dark';
  });

  // Apply theme on mount and whenever it changes
  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem('fishlers-theme', theme);
  }, [theme]);

  const toggleTheme = (origin?: { x: number; y: number }) => {
    const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark';
    const root = document.documentElement;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const point = origin ?? { x: window.innerWidth - 32, y: 28 };
    const radius = getMaxViewportRadius(point);

    root.style.setProperty('--theme-wave-x', `${point.x}px`);
    root.style.setProperty('--theme-wave-y', `${point.y}px`);
    root.style.setProperty('--theme-wave-radius', `${Math.ceil(radius)}px`);

    if (reduceMotion) {
      setTheme(nextTheme);
      console.log('Toggling theme from', theme, 'to', nextTheme, '(reduced motion)');
      return;
    }

    const docWithTransition = document as Document & {
      startViewTransition?: (callback: () => void) => { finished?: Promise<unknown> };
    };

    if (typeof docWithTransition.startViewTransition === 'function') {
      root.classList.add('theme-ripple-transition');
      const transition = docWithTransition.startViewTransition(() => {
        setTheme(nextTheme);
      });
      if (transition?.finished) {
        transition.finished.finally(() => {
          window.setTimeout(() => {
            root.classList.remove('theme-ripple-transition');
          }, 40);
        });
      } else {
        root.classList.remove('theme-ripple-transition');
      }
    } else {
      root.classList.add('theme-fallback-transition');
      setTheme(nextTheme);
      window.setTimeout(() => {
        root.classList.remove('theme-fallback-transition');
      }, 380);
    }

    console.log('Toggling theme from', theme, 'to', nextTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
