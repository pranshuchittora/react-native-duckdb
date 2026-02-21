import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useTheme } from '../theme'
import { DatasetExplorerScreen } from '../screens/DatasetExplorerScreen'
import { DatasetDetailScreen } from '../screens/DatasetDetailScreen'
import type { DatasetStackParamList } from './types'

const Stack = createNativeStackNavigator<DatasetStackParamList>()

export function DatasetStack() {
  const { colors, brand } = useTheme()

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: brand.yellow,
        headerTitleStyle: { color: colors.text, fontWeight: '600' },
        contentStyle: { backgroundColor: colors.background },
      }}>
      <Stack.Screen
        name="DatasetExplorer"
        component={DatasetExplorerScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="DatasetDetail"
        component={DatasetDetailScreen}
        options={({ route }) => ({ title: route.params.dataset.name })}
      />
    </Stack.Navigator>
  )
}
