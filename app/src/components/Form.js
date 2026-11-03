import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Shared building blocks for the auth and profile screens

// contentInsetAdjustmentBehavior keeps content below the see-through iOS header;
// automaticallyAdjustKeyboardInsets scrolls fields above the keyboard.
// footer (e.g. Log out) stays pinned to the bottom, above the home indicator,
// instead of scrolling with the content.
export function Screen({ children, footer }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.screen}
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
      {footer ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>{footer}</View>
      ) : null}
    </View>
  );
}

export function Field({ label, error, ...inputProps }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, error && styles.inputError, inputProps.editable === false && styles.inputDisabled]}
        placeholderTextColor="#94a3b8"
        {...inputProps}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function Button({ title, onPress, busy, variant = 'primary' }) {
  const secondary = variant === 'secondary';
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      style={({ pressed }) => [styles.button, secondary && styles.buttonSecondary, (pressed || busy) && { opacity: 0.7 }]}
    >
      {busy
        ? <ActivityIndicator color={secondary ? '#0f4c81' : '#fff'} />
        : <Text style={[styles.buttonText, secondary && styles.buttonTextSecondary]}>{title}</Text>}
    </Pressable>
  );
}

// Success or error banner under a form
export function Message({ text, kind = 'error' }) {
  if (!text) return null;
  return <Text style={kind === 'error' ? styles.error : styles.success}>{text}</Text>;
}

export const styles = StyleSheet.create({
  screen: { padding: 20, gap: 14, flexGrow: 1 },
  footer: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e2e8f0', backgroundColor: '#fff' },
  heading: { fontSize: 26, fontWeight: 'bold', color: '#0f172a' },
  subtle: { color: '#475569' },
  label: { fontWeight: '600', color: '#0f172a' },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 12, fontSize: 16, backgroundColor: '#fff' },
  inputError: { borderColor: '#dc2626' },
  inputDisabled: { backgroundColor: '#f1f5f9', color: '#64748b' },
  error: { color: '#dc2626' },
  success: { color: '#15803d' },
  button: { backgroundColor: '#0f4c81', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonSecondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#0f4c81' },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  buttonTextSecondary: { color: '#0f4c81' },
  link: { color: '#0f4c81', fontWeight: '600', textAlign: 'center', padding: 6 },
});
