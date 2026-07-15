import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

// Shown briefly while fonts/auth load. Uses the Duely wordmark (no spinner) so it
// blends seamlessly with the native splash screen.
export function LoadingScreen() {
  return (
    <View style={styles.container}>
      <Image
        source={require('../../assets/splash-icon.png')}
        style={styles.logo}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { width: 200, height: 64 },
});
