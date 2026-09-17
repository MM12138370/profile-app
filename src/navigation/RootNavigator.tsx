import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '../auth/AuthContext';
import { AiConnectScreen } from '../screens/AiConnectScreen';
import { InterviewBankScreen } from '../screens/InterviewBankScreen';
import { InterviewPickScreen } from '../screens/InterviewPickScreen';
import { InterviewSaveScreen } from '../screens/InterviewSaveScreen';
import { InterviewSessionScreen } from '../screens/InterviewSessionScreen';
import { JobDetailScreen } from '../screens/JobDetailScreen';
import { JobNewScreen } from '../screens/JobNewScreen';
import { JobsScreen } from '../screens/JobsScreen';
import { JobStructuredScreen } from '../screens/JobStructuredScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { MasterTemplateScreen } from '../screens/MasterTemplateScreen';
import { ProjectMatchScreen } from '../screens/ProjectMatchScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { ResumeCenterScreen } from '../screens/ResumeCenterScreen';
import { ResumePreviewScreen } from '../screens/ResumePreviewScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { colors } from '../theme';
import type { MainTabParamList, RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.bg,
    card: colors.paper,
    text: colors.ink,
    border: colors.line,
    primary: colors.accent,
  },
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.faint,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarStyle: {
          backgroundColor: colors.paper,
          borderTopColor: colors.line,
        },
      }}
    >
      <Tab.Screen
        name="ProfileTab"
        component={ResumeCenterScreen}
        options={{
          title: '简历中心',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="document-text-outline" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="JobsTab"
        component={JobsScreen}
        options={{
          title: '岗位列表',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="briefcase-outline" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="InterviewTab"
        component={InterviewPickScreen}
        options={{
          title: '面试助手',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubbles-outline" color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const { user, ready } = useAuth();

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        screenOptions={{
          headerShadowVisible: false,
          headerTintColor: colors.accent,
          headerTitleStyle: { color: colors.ink, fontWeight: '700' },
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        {user ? (
          <>
            <Stack.Screen
              name="Welcome"
              component={WelcomeScreen}
              options={{ headerShown: false, animation: 'fade', gestureEnabled: false }}
            />
            <Stack.Screen
              name="Main"
              component={MainTabs}
              options={{ headerShown: false, animation: 'fade' }}
            />
            <Stack.Screen
              name="Profile"
              component={ProfileScreen}
              options={{ title: '简历', gestureEnabled: false }}
            />
            <Stack.Screen
              name="MasterTemplate"
              component={MasterTemplateScreen}
              options={{ title: '母模版', gestureEnabled: false }}
            />
            <Stack.Screen
              name="ResumePreview"
              component={ResumePreviewScreen}
              options={{ title: '简历预览' }}
            />
            <Stack.Screen name="JobNew" component={JobNewScreen} options={{ title: '添加岗位' }} />
            <Stack.Screen name="JobDetail" component={JobDetailScreen} options={{ title: '岗位' }} />
            <Stack.Screen
              name="JobStructured"
              component={JobStructuredScreen}
              options={{ title: '结构化结果' }}
            />
            <Stack.Screen
              name="ProjectMatch"
              component={ProjectMatchScreen}
              options={{ title: '辅助项目匹配' }}
            />
            <Stack.Screen
              name="InterviewSession"
              component={InterviewSessionScreen}
              options={{ title: '面试' }}
            />
            <Stack.Screen
              name="InterviewSave"
              component={InterviewSaveScreen}
              options={{ title: '保存问答' }}
            />
            <Stack.Screen
              name="InterviewBank"
              component={InterviewBankScreen}
              options={{ title: '面试问答' }}
            />
            <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: '设置' }} />
            <Stack.Screen name="AiConnect" component={AiConnectScreen} options={{ title: '连接大模型' }} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
