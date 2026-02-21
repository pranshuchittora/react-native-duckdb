import React from 'react'
import { View, Text } from 'react-native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useTheme } from '../theme'
import { ExplorerHomeScreen } from '../screens/ExplorerHomeScreen'
import { FTSExplorerScreen } from '../screens/FTSExplorerScreen'
import { VSSExplorerScreen } from '../screens/VSSExplorerScreen'
import { StreamingDemoScreen } from '../screens/StreamingDemoScreen'
import { AppenderBenchmarkScreen } from '../screens/AppenderBenchmarkScreen'
import { TypeInspectorScreen } from '../screens/TypeInspectorScreen'
import { AttachDatabaseScreen } from '../screens/AttachDatabaseScreen'
import type { ExplorerStackParamList } from './types'

const Stack = createNativeStackNavigator<ExplorerStackParamList>()

function PlaceholderFeature({ route }: { route: { name: string } }) {
  const { colors } = useTheme()
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
      <Text style={{ color: colors.text, fontSize: 18, fontWeight: '600' }}>{route.name}</Text>
      <Text style={{ color: colors.textSecondary, fontSize: 14, marginTop: 8 }}>Coming in Plan 02/03</Text>
    </View>
  )
}

export function ExplorerStack() {
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
        name="ExplorerHome"
        component={ExplorerHomeScreen}
        options={{ title: 'Feature Explorer' }}
      />
      <Stack.Screen
        name="FTSExplorer"
        component={FTSExplorerScreen}
        options={{ title: 'Full-Text Search' }}
      />
      <Stack.Screen
        name="VSSExplorer"
        component={VSSExplorerScreen}
        options={{ title: 'Vector Search' }}
      />
      <Stack.Screen
        name="RemoteFiles"
        component={PlaceholderFeature}
        options={{ title: 'Remote Files' }}
      />
      <Stack.Screen
        name="FileQueries"
        component={PlaceholderFeature}
        options={{ title: 'File Queries' }}
      />
      <Stack.Screen
        name="StreamingDemo"
        component={StreamingDemoScreen}
        options={{ title: 'Streaming Demo' }}
      />
      <Stack.Screen
        name="AppenderBenchmark"
        component={AppenderBenchmarkScreen}
        options={{ title: 'Appender Benchmark' }}
      />
      <Stack.Screen
        name="TypeInspector"
        component={TypeInspectorScreen}
        options={{ title: 'Type Inspector' }}
      />
      <Stack.Screen
        name="AttachDatabase"
        component={AttachDatabaseScreen}
        options={{ title: 'Attach Database' }}
      />
    </Stack.Navigator>
  )
}
