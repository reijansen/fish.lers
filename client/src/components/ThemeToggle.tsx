import { Sun, Moon } from 'lucide-react';
import type { MouseEvent } from 'react';
import { useTheme } from '../context/ThemeContext';

interface ThemeToggleProps {
  className?: string;
}

export default function ThemeToggle({ className = '' }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();

  const handleToggle = (event: MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    toggleTheme({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });
  };

  return (
    <button
      onClick={handleToggle}
      className={`btn btn-ghost btn-circle btn-sm ${className}`}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? (
        <Sun className="w-5 h-5 text-white-400 transition-transform duration-300 ease-out rotate-0 scale-100" />
      ) : (
        <Moon className="w-5 h-5 text-white-600 transition-transform duration-300 ease-out -rotate-12 scale-95" />
      )}
    </button>
  );
}
