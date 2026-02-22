import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useTheme } from '../theme'
import { QueryRunnerScreen } from '../screens/QueryRunnerScreen'
import { QueryHistoryScreen } from '../screens/QueryHistoryScreen'
import type { QueryStackParamList } from './types'

const Stack = createNativeStackNavigator<QueryStackParamList>()

export function QueryStack() {
  const { colors } = useTheme()

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.tabBarActiveTint,
        headerTitleStyle: { color: colors.text, fontWeight: '600' },
        contentStyle: { backgroundColor: colors.background },
        headerShown: false,
      }}>
      <Stack.Screen
        name="QueryRunner"
        component={QueryRunnerScreen}
      />
      <Stack.Screen
        name="QueryHistory"
        component={QueryHistoryScreen}
        options={{ headerShown: true, title: 'Query History' }}
      />
    </Stack.Navigator>
  )
}
