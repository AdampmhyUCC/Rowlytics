import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo, ActivityIndicator, Keyboard, LayoutAnimation, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
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

// Label, optional hint (shown before any error, e.g. password rules) and
// error around a form control. Screen readers hear the error as it appears.
function FieldFrame({ label, hint, error, children }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={styles.label}>{label}</Text>
      {hint ? <Text style={styles.subtle}>{hint}</Text> : null}
      {children}
      {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}
    </View>
  );
}

// React Native doesn't link the label Text to the input, so the input carries
// the label and error itself. Pass ref to focus it (React 19 passes it through).
export function Field({ label, hint, error, ...inputProps }) {
  return (
    <FieldFrame label={label} hint={hint} error={error}>
      <TextInput
        style={[styles.input, error && styles.inputError, inputProps.editable === false && styles.inputDisabled]}
        placeholderTextColor="#94a3b8"
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        {...inputProps}
      />
    </FieldFrame>
  );
}

// A new or existing password with a Show/Hide button, so people can check
// what they typed (WCAG 3.3.8). Paste and password managers keep working.
export function PasswordField({ label, hint, error, ...inputProps }) {
  const [shown, setShown] = useState(false);
  return (
    <FieldFrame label={label} hint={hint} error={error}>
      <View style={[styles.input, styles.passwordRow, error && styles.inputError]}>
        <TextInput
          style={styles.passwordInput}
          placeholderTextColor="#94a3b8"
          secureTextEntry={!shown}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel={label}
          accessibilityHint={error ?? hint}
          {...inputProps}
        />
        <Pressable
          onPress={() => setShown((s) => !s)}
          accessibilityRole="button"
          accessibilityLabel={shown ? 'Hide password' : 'Show password'}
          style={({ pressed }) => [styles.passwordToggle, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.passwordToggleText}>{shown ? 'Hide' : 'Show'}</Text>
        </Pressable>
      </View>
    </FieldFrame>
  );
}

// Date of birth as separate Day / Month / Year boxes (GOV.UK date input):
// quicker than scrolling a calendar back years, and it works on web too.
// value: { day, month, year } strings. Return moves through the boxes; the
// year box's onSubmitEditing and onBlur come from the screen.
const DOB_AUTOFILL = {
  day: { textContentType: 'birthdateDay', autoComplete: Platform.select({ web: 'bday-day', default: 'birthdate-day' }) },
  month: {
    textContentType: 'birthdateMonth', autoComplete: Platform.select({ web: 'bday-month', default: 'birthdate-month' }),
  },
  year: { textContentType: 'birthdateYear', autoComplete: Platform.select({ web: 'bday-year', default: 'birthdate-year' }) },
};

export function DobField({ label = 'Date of birth', hint, error, value, onChange, onBlur, onSubmitEditing, ref }) {
  const monthRef = useRef(null);
  const yearRef = useRef(null);
  const part = (key, width, maxLength, props) => (
    <View style={{ gap: 4, width }}>
      <Text style={styles.subtle}>{key[0].toUpperCase() + key.slice(1)}</Text>
      <TextInput
        style={[styles.input, error && styles.inputError, { textAlign: 'center' }]}
        value={value[key]}
        onChangeText={(text) => onChange({ ...value, [key]: text.replace(/\D/g, '') })}
        keyboardType="number-pad"
        maxLength={maxLength}
        accessibilityLabel={`${label}, ${key}`}
        accessibilityHint={error ?? undefined}
        {...DOB_AUTOFILL[key]}
        {...props}
      />
    </View>
  );
  return (
    <FieldFrame label={label} hint={hint} error={error}>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {part('day', 64, 2, {
          ref, returnKeyType: 'next', submitBehavior: 'submit', onSubmitEditing: () => monthRef.current?.focus(),
        })}
        {part('month', 64, 2, {
          ref: monthRef, returnKeyType: 'next', submitBehavior: 'submit', onSubmitEditing: () => yearRef.current?.focus(),
        })}
        {part('year', 96, 4, { ref: yearRef, returnKeyType: 'next', submitBehavior: 'submit', onSubmitEditing, onBlur })}
      </View>
    </FieldFrame>
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

// A tick box with its label, e.g. agreeing to a statement
export function Checkbox({ label, checked, onChange, error }) {
  return (
    <View style={{ gap: 4 }}>
      <Pressable
        onPress={() => onChange(!checked)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        style={({ pressed }) => [styles.checkboxRow, pressed && { opacity: 0.7 }]}
      >
        <View style={[styles.checkbox, checked && styles.checkboxChecked, error && styles.inputError]}>
          {checked ? <Text style={styles.checkboxTick}>✓</Text> : null}
        </View>
        <Text style={{ flex: 1, color: '#0f172a' }}>{label}</Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

// Success or error banner under a form. Screen readers read it out when it
// changes (Android through the live region, iOS through the announcement).
export function Message({ text, kind = 'error' }) {
  useEffect(() => {
    if (text && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(text);
  }, [text]);
  if (!text) return null;
  return (
    <Text style={kind === 'error' ? styles.error : styles.success} accessibilityLiveRegion="polite">{text}</Text>
  );
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
  passwordRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 0, paddingRight: 4 },
  passwordInput: { flex: 1, fontSize: 16, paddingVertical: 12, color: '#0f172a' },
  passwordToggle: { minHeight: 44, minWidth: 44, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  passwordToggleText: { color: '#0f4c81', fontWeight: '600' },
  // Short notes inside a form, e.g. telling under-16s a parent must approve
  info: { color: '#475569', backgroundColor: '#f1f5f9', padding: 12, borderRadius: 8 },
  // minHeight 44 keeps the whole row a comfortable touch target
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  checkbox: {
    width: 24, height: 24, borderRadius: 6, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: '#0f4c81', borderColor: '#0f4c81' },
  checkboxTick: { color: '#fff', fontWeight: 'bold' },
});
