import { Alert, Platform } from 'react-native';

// Asks the user to confirm a destructive action. Resolves true if they agree.
// Alert.alert does nothing on web, so the browser's own dialog is used there.
export function confirm(title, message, confirmLabel = 'Delete') {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}
