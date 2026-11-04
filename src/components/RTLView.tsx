import React from 'react';
import { Platform, View, ViewProps } from 'react-native';

/**
 * On Android/iOS the whole app is RTL via the expo-localization `forcesRTL` option.
 * On web, react-native-web resolves start/end styles from the nearest `dir`
 * attribute, so we set it explicitly on the root and on every modal.
 */
const webDir = Platform.OS === 'web' ? ({ dir: 'rtl', lang: 'ar' } as object) : {};

export function RTLView(props: ViewProps) {
  return <View {...webDir} {...props} />;
}
