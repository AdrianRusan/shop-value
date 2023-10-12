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

  useEffect(() => {
    const userPreferredTheme = localStorage.getItem('theme');
    if (userPreferredTheme) {
      setTheme(userPreferredTheme);
    } else {
      setTheme('light');
    }
  }, []);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'));

    localStorage.setItem('theme', theme === 'light' ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme: toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
