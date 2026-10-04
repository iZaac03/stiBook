import { Tabs } from 'expo-router';
import { View, Text } from 'react-native';

function TabIcon({ emoji, label, focused }: { emoji: string; label: string; focused: boolean }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', paddingTop: 4 }}>
      <Text style={{ fontSize: focused ? 22 : 20, opacity: focused ? 1 : 0.4 }}>{emoji}</Text>
      <Text style={{
        fontSize: 9, fontWeight: focused ? '700' : '500',
        color: focused ? '#818cf8' : '#52525b',
        marginTop: 2, letterSpacing: 0.5,
      }}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarStyle: {
        backgroundColor: '#0f0f14', borderTopColor: '#1e1e2e',
        borderTopWidth: 1, height: 64, paddingBottom: 8, paddingTop: 4,
      },
      tabBarShowLabel: false,
    }}>
      <Tabs.Screen name="index"
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" label="Home" focused={focused} /> }}
      />
      <Tabs.Screen name="create"
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={{
              width: 44, height: 44, borderRadius: 14,
              backgroundColor: focused ? '#6366f1' : '#1e1e2e',
              alignItems: 'center', justifyContent: 'center', marginBottom: 8,
              shadowColor: '#6366f1', shadowOpacity: focused ? 0.5 : 0,
              shadowRadius: 10, elevation: focused ? 8 : 0,
            }}>
              <Text style={{ fontSize: 20 }}>✏️</Text>
            </View>
          ),
        }}
      />
    
       <Tabs.Screen name="message" 
       options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="💬" label="Messages" focused={focused} /> }}
       /> 
      <Tabs.Screen name="profile"
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="👤" label="Profile" focused={focused} /> }}
      />
    </Tabs>
  );
}