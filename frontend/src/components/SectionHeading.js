import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { styles } from './Form';

// A section title on Home-style screens, marked as a heading for screen
// readers. On the right: an optional "See all ›" style link ({ label, href })
// or any other action, e.g. a + button. first drops the space above it.
export function SectionHeading({ title, link, action, first }) {
  return (
    <View style={[headingStyles.row, !first && { marginTop: 16 }]}>
      <Text style={headingStyles.title} accessibilityRole="header">{title}</Text>
      {link ? (
        <Pressable onPress={() => router.push(link.href)} accessibilityRole="link" hitSlop={8}
          style={({ pressed }) => [headingStyles.link, pressed && { opacity: 0.6 }]}>
          <Text style={headingStyles.linkText}>{link.label} ›</Text>
        </Pressable>
      ) : action}
    </View>
  );
}

const headingStyles = {
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  title: { ...styles.label, fontSize: 17 },
  link: { minHeight: 44, justifyContent: 'center' },
  linkText: { color: '#0f4c81', fontWeight: '600' },
};
