// Set up an PRNG for nacl with expo-crypto
import nacl from 'tweetnacl';
import { getRandomBytes } from 'expo-crypto'
nacl.setPRNG((x, n) => {
  // Get n random bytes from expo-crypto
  const randomBytes = getRandomBytes(n);

  // Copy the random bytes into x
  x.set(randomBytes);
});

// Navigation
import 'react-native-gesture-handler';

// App
import * as React from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, TextInput, Appearance } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { Root } from './app/Root';
import { changeNavBarColor } from './app/components/modules/NavBar';
import * as SplashScreen from 'expo-splash-screen';
import { ActionSheetProvider } from '@expo/react-native-action-sheet';
import { getThemeStyleState } from './app/engine/state/theme';
import * as Sentry from '@sentry/react-native';

if (!__DEV__) {
  Sentry.init({
    dsn: 'https://11b74fcdccf8b7578f81eb424b1f999d@o4504887465869312.ingest.sentry.io/4506297188220928',
  });
}

const style = getThemeStyleState();
const scheme = Appearance.getColorScheme();
const isDark = style === 'dark' || (style === 'system' && scheme === 'dark');

changeNavBarColor(isDark ? '#1C1C1E' : 'white');

// Note that it is a bad practice to disable font scaling globally.
// TODO: extend Text and TextInput components to support or lock font scaling.
if (!(Text as any).defaultProps) {
  (Text as any).defaultProps = {};
  (Text as any).defaultProps.allowFontScaling = false;
}

if (!(TextInput as any).defaultProps) {
  (TextInput as any).defaultProps = {};
  (TextInput as any).defaultProps.allowFontScaling = false;
}

SplashScreen.preventAutoHideAsync();
function Boot() {
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <GestureHandlerRootView style={styles.container}>
          <ActionSheetProvider>
            <Root />
          </ActionSheetProvider>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </>
  )
}

export default function App() {
  return (
    <Boot />
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: 'column',
    backgroundColor: isDark ? '#1C1C1E' : 'white',
    alignItems: 'stretch',
    justifyContent: 'center',
  },
});
