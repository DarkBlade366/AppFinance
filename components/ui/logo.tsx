import { Image, StyleSheet } from 'react-native';

import { Colors } from '@/constants/theme';

const LOGO = require('../../assets/images/logo.png') as number;

export function AppLogo({ size = 52 }: { size?: number }) {
  return (
    <Image
      source={LOGO}
      style={[
        styles.logo,
        { width: size, height: size, borderRadius: size * 0.26 },
      ]}
      resizeMode="cover"
    />
  );
}

const styles = StyleSheet.create({
  logo: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
});