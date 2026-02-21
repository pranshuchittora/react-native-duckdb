import React from 'react'
import { View, Text } from 'react-native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'
import { useTheme } from '../theme'
import { TestsScreen } from '../screens/TestsScreen'
import { ExplorerStack } from './ExplorerStack'
import type { RootTabParamList } from './types'

const Tab = createBottomTabNavigator<RootTabParamList>()

function PlaceholderScreen() {
  const { colors } = useTheme()
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
      <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Coming soon</Text>
    </View>
  )
}

export function TabNavigator() {
  const { colors } = useTheme()

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.tabBarBackground,
          borderTopWidth: 0,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        },
        tabBarActiveTintColor: colors.tabBarActiveTint,
        tabBarInactiveTintColor: colors.tabBarInactiveTint,
      }}>
      <Tab.Screen
        name="Tests"
        component={TestsScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="check-circle-outline" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Explorer"
        component={ExplorerStack}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="compass-outline" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Query"
        component={PlaceholderScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="code-tags" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Datasets"
        component={PlaceholderScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="database-outline" color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  )
}
