import { Tabs } from 'expo-router';
import React from 'react';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' },   // hide the bottom tab bar completely
      }}
    >
      <Tabs.Screen name="index"        options={{ href: null }} />
      <Tabs.Screen name="front"        options={{ href: null }} />
      <Tabs.Screen name="crossAllergen"options={{ href: null }} />
      <Tabs.Screen name="chatbot"      options={{ href: null }} />
    </Tabs>
  );
}
