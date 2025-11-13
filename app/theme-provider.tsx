'use client'

import { createContext, useState, useContext, useEffect } from "react";

export const ThemeContext = createContext<{
  theme: string;
  setTheme: (theme: string) => void;
}>({
  theme: 'light',
  setTheme: () => {},
});

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState('light');

  // Initialize theme from localStorage or system preference
  useEffect(() => {
    // Check localStorage first
    const storedTheme = localStorage.getItem('theme');

    if (storedTheme === 'dark' || storedTheme === 'light') {
      setTheme(storedTheme);
    } else {
      // Fall back to system preference if no stored theme
      const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setTheme(systemPrefersDark ? 'dark' : 'light');
    }

    // Listen for system theme changes (only if user hasn't set a preference)
    const darkModeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const updateTheme = (e: MediaQueryListEvent) => {
      // Only auto-update if user hasn't manually set a theme
      if (!localStorage.getItem('theme')) {
        setTheme(e.matches ? 'dark' : 'light');
      }
    };
    darkModeMediaQuery.addEventListener("change", updateTheme);

    return () => {
      darkModeMediaQuery.removeEventListener("change", updateTheme);
    };
  }, []);

  // Apply theme class to document
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme: toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}