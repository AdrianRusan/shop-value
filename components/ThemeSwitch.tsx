'use client'

import { useTheme } from '@/app/theme-provider';
import { Switch } from '@headlessui/react';

const ThemeSwitch = () => {
  const { theme, setTheme } = useTheme();

  return (
    <Switch
      checked={theme === 'dark'}
      onChange={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="bg-black dark:bg-white relative inline-flex h-6 w-11 items-center rounded-full"
    >
      <span className="sr-only">Switch theme</span>
      <span
        className="translate-x-1 dark:translate-x-6 inline-block h-4 w-4 transform rounded-full bg-white dark:bg-black transition"
      />
    </Switch>
  );
};

export default ThemeSwitch;