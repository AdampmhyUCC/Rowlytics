import { Pressable, Text, View } from 'react-native';
import { formatSessionDate, modalityLabel } from '../lib/training';
import { TabIcon } from './TabIcon';

// One planned session from a squad's program (#34): date · type, the title,
// then the coach's details, and the squad name when given (athletes can be in
// several squads). Coaches tap it to edit; `action` sits on the right, and a
// tappable card without one gets a chevron. detailLines cuts long details short.
export function PlannedSessionCard({ plan, onPress, accessibilityHint, action, detailLines }) {
  const heading = `${formatSessionDate(plan.session_date)} · ${modalityLabel(plan.modality)}`;
  const content = (
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={cardStyles.date}>{heading}</Text>
      <Text style={cardStyles.title}>{plan.title}</Text>
      {plan.details ? <Text style={cardStyles.details} numberOfLines={detailLines}>{plan.details}</Text> : null}
      {plan.squadName ? <Text style={cardStyles.squad}>{plan.squadName}</Text> : null}
    </View>
  );

  return (
    <View style={cardStyles.card}>
      {onPress ? (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={[heading, plan.title, plan.details, plan.squadName].filter(Boolean).join(', ')}
          accessibilityHint={accessibilityHint}
          style={({ pressed }) => [{ flex: 1 }, pressed && { opacity: 0.7 }]}
        >
          {content}
        </Pressable>
      ) : content}
      {action ?? (onPress ? <TabIcon ios="chevron.right" material="chevron_right" color="#94a3b8" size={16} /> : null)}
    </View>
  );
}

const cardStyles = {
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 10,
    borderWidth: 1, borderColor: '#e2e8f0', borderLeftWidth: 4, borderLeftColor: '#0f4c81', backgroundColor: '#fff',
  },
  date: { color: '#475569', fontWeight: '600' },
  title: { fontWeight: '600', fontSize: 16, color: '#0f172a' },
  details: { color: '#475569' },
  squad: { color: '#64748b', fontSize: 13 },
};
