import React, { createContext, useContext, useMemo } from 'react'
import { useColorScheme } from 'react-native'
import {
  light,
  dark,
  syntaxLight,
  syntaxDark,
  brand,
  type ColorPalette,
  type SyntaxColors,
} from './colors'

interface ThemeValue {
  colors: ColorPalette
  syntax: SyntaxColors
  brand: typeof brand
  isDark: boolean
}

const ThemeContext = createContext<ThemeValue>({
  colors: light,
  syntax: syntaxLight,
  brand,
  isDark: false,
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme()
  const isDark = scheme === 'dark'

  const value = useMemo<ThemeValue>(
    () => ({
      colors: isDark ? dark : light,
      syntax: isDark ? syntaxDark : syntaxLight,
      brand,
      isDark,
    }),
    [isDark],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}
