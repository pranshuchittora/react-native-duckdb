export const brand = {
  yellow: '#FFF100',
  purple: '#7D66FF',
  orange: '#FF6900',
  blue: '#2EAFFF',
  green: '#00C770',
}

export const light = {
  background: '#FFFFFF',
  surface: '#F6F8FA',
  surfaceAlt: '#EAEEF2',
  text: '#1F2328',
  textSecondary: '#656D76',
  border: '#D0D7DE',
  error: '#CF222E',
  tabBarBackground: '#F6F8FA',
  tabBarActiveTint: brand.yellow,
  tabBarInactiveTint: '#656D76',
}

export const dark = {
  background: '#0D1117',
  surface: '#161B22',
  surfaceAlt: '#21262D',
  text: '#E6EDF3',
  textSecondary: '#8B949E',
  border: '#30363D',
  error: '#F85149',
  tabBarBackground: '#0D1117',
  tabBarActiveTint: brand.yellow,
  tabBarInactiveTint: '#8B949E',
}

export type ColorPalette = typeof light

export const syntaxLight = {
  keyword: '#005FFF',
  string: '#875F00',
  number: '#d700af',
  function: '#008700',
  comment: '#626262',
  operator: brand.yellow,
}

export const syntaxDark = {
  keyword: '#5fafff',
  string: '#ffd700',
  number: '#ff00ff',
  function: '#00af00',
  comment: '#888888',
  operator: brand.yellow,
}

export type SyntaxColors = typeof syntaxLight
