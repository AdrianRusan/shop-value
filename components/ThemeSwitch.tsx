'use client'

import { useState, useEffect } from 'react'
import { useTheme } from '@/app/theme-provider'
import { Switch } from '@headlessui/react'

const ThemeSwitch = () => {
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  return (
    <Switch
      checked={theme === 'dark'} // Check if the theme is 'dark'
      onChange={() => setTheme(theme === 'dark' ? 'light' : 'dark')} // Toggle between 'dark' and 'light'
      className="bg-black dark:bg-white relative inline-flex h-6 w-11 items-center rounded-full"
    >
      <span className="sr-only">Switch theme</span>
      <span
        className='translate-x-1 dark:translate-x-6 inline-block h-4 w-4 transform rounded-full bg-white dark:bg-black transition'
      />
    </Switch>
  )
}

export default ThemeSwitch