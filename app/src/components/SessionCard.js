import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { RPE_LABELS, formatDistance, formatDuration, formatSessionDate, formatSplit, modalityLabel } from '../lib/training';

// One training session. Tap to edit or delete it.
// compact (Home): date · type, then distance · time.
// Full (Training log): adds the split /500m for erg and water sessions.
export function SessionCard({ session, compact }) {
  const { completed_training_id: id, session_date, modality, distance_m, duration_seconds, rpe } = session;
  const split = !compact && modality !== 'other' ? formatSplit(duration_seconds, distance_m) : null;
  const details = [
    distance_m ? formatDistance(distance_m) : null,
    formatDuration(duration_seconds),
    split ? `${split} /500m` : null,
  ].filter(Boolean);

  const spoken = [formatSessionDate(session_date), modalityLabel(modality), ...details,
    `RPE ${rpe}${RPE_LABELS[rpe] ? `, ${RPE_LABELS[rpe]}` : ''}`].join(', ');

  return (
    <Pressable
      onPress={() => router.push(`/session/${id}`)}
      accessibilityRole="button"
      accessibilityLabel={spoken}
      accessibilityHint="Opens the session to edit or delete it"
      style={({ pressed }) => [cardStyles.card, compact && cardStyles.compact, pressed && { opacity: 0.7 }]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={cardStyles.title}>{formatSessionDate(session_date)} · {modalityLabel(modality)}</Text>
        <Text style={cardStyles.details}>{details.join(' · ')}</Text>
      </View>
      <RpeBadge rpe={rpe} />
    </Pressable>
  );
}

// Green for easy, amber for moderate to hard, red for very hard to maximal
function RpeBadge({ rpe }) {
  const colour = rpe <= 3 ? '#15803d' : rpe <= 6 ? '#b45309' : '#dc2626';
  return (
    <View style={[cardStyles.badge, { borderColor: colour }]}>
      <Text style={[cardStyles.badgeValue, { color: colour }]}>{rpe}</Text>
      <Text style={[cardStyles.badgeLabel, { color: colour }]}>RPE</Text>
    </View>
  );
}

const cardStyles = {
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 10,
    borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff',
  },
  compact: { paddingVertical: 10 },
  title: { fontWeight: '600', fontSize: 16, color: '#0f172a' },
  details: { color: '#475569' },
  badge: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  badgeValue: { fontSize: 18, fontWeight: 'bold', lineHeight: 20 },
  badgeLabel: { fontSize: 10, fontWeight: '600' },
};
