import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import AntDesign from '@expo/vector-icons/AntDesign';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#0b8fa1',
        tabBarInactiveTintColor: '#64748b',
        tabBarStyle: {
          backgroundColor: '#eef6f7',
          borderTopColor: '#c7e2e6',
          height: 62,
          paddingBottom: 6,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontWeight: '600',
        },
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          href: null, // 👈 hides it from tab bar completely
        }}
      />
      <Tabs.Screen
        name="front"
        options={{
          title: 'Report Analyser',
          tabBarIcon: ({ color }) => <AntDesign size={28} name="camera" color={color} />,
        }}
      />
      <Tabs.Screen
        name="crossAllergen"
        options={{
          title: 'Cross Allergy',
          tabBarIcon: ({ color }) => <AntDesign size={28} name="camera" color={color} />,
        }}
      />
      <Tabs.Screen
        name="chatbot"
        options={{
          title: 'Assistant',
          tabBarIcon: ({ color }) => <AntDesign size={28} name="camera" color={color} />,
        }}
      />

    </Tabs>
  );
}
