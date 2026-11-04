import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Keyboard, LayoutAnimation, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Shared building blocks for the auth and profile screens

// contentInsetAdjustmentBehavior keeps content below the see-through iOS header;
// automaticallyAdjustKeyboardInsets scrolls fields above the keyboard.
// alwaysBounceVertical={false} keeps short screens still; they only scroll
// when the content is taller than the screen.
// footer holds the screen's buttons (and the message above them). It stays
// pinned to the bottom, above the home indicator, instead of scrolling away.
export function Screen({ children, footer }) {
  const keyboardHeight = useKeyboardHeight();
  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.screen}
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustKeyboardInsets
        alwaysBounceVertical={false}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
      {footer ? <Footer keyboardHeight={keyboardHeight}>{footer}</Footer> : null}
    </View>
  );
}

// The pinned button area. Also used on its own by list screens, which can't
// sit inside Screen's ScrollView. inTabs: the tab bar below already keeps
// clear of the home indicator, so no extra space is needed.
export function Footer({ children, keyboardHeight = 0, inTabs = false }) {
  const insets = useSafeAreaInsets();
  const bottom = keyboardHeight ? keyboardHeight + 12 : inTabs ? 12 : Math.max(insets.bottom, 20);
  return (
    <View style={[styles.footer, { paddingBottom: bottom }]}>
      {children}
    </View>
  );
}

// iOS draws the keyboard over the app, so the footer moves up by its height.
// Android shrinks the screen itself when the keyboard opens, so this stays 0.
// Assumes the screen reaches the bottom of the window (true for stack screens,
// not for tab screens, which have the tab bar underneath).
function useKeyboardHeight() {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    // Animate with the keyboard so the footer slides rather than jumps
    const update = (event, newHeight) => {
      LayoutAnimation.configureNext({ duration: event.duration, update: { type: 'keyboard' } });
      setHeight(newHeight);
    };
    const show = Keyboard.addListener('keyboardWillShow', (event) => update(event, event.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardWillHide', (event) => update(event, 0));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return height;
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

// variant: 'primary', 'secondary' (outlined) or 'danger' (outlined red, e.g. delete)
// Closes the keyboard first, so the next screen doesn't open with the scroll
// position still shifted for it
export function Button({ title, onPress, busy, variant = 'primary' }) {
  const outlined = variant === 'secondary' || variant === 'danger';
  const danger = variant === 'danger';
  return (
    <Pressable
      onPress={(event) => { Keyboard.dismiss(); onPress?.(event); }}
      disabled={busy}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button, outlined && styles.buttonSecondary, danger && styles.buttonDanger,
        (pressed || busy) && { opacity: 0.7 },
      ]}
    >
      {busy
        ? <ActivityIndicator color={danger ? '#dc2626' : outlined ? '#0f4c81' : '#fff'} />
        : <Text style={[styles.buttonText, outlined && styles.buttonTextSecondary, danger && styles.buttonTextDanger]}>
          {title}
        </Text>}
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
  footer: { gap: 10, paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e2e8f0', backgroundColor: '#fff' },
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
  buttonDanger: { borderColor: '#dc2626' },
  buttonTextDanger: { color: '#dc2626' },
  link: { color: '#0f4c81', fontWeight: '600', textAlign: 'center', padding: 6 },
});
