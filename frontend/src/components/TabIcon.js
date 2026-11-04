import { SymbolView } from 'expo-symbols';

// SF Symbols on iOS, Material Symbols on Android and web
export function TabIcon({ ios, material, color, size = 24 }) {
  return <SymbolView name={{ ios, android: material, web: material }} tintColor={color} size={size} />;
}
