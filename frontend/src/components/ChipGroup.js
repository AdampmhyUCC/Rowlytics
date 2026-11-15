import { Pressable, ScrollView, Text, View } from 'react-native';

// A row of tappable options where one can be selected, e.g. session type.
// options: [{ value, label }]
// a11yLabel names the group for screen readers when there's no visible label.
// layout: 'wrap' (default), 'segmented' (equal widths across the row, for two
// or three fixed options) or 'scroll' (one line that scrolls sideways, for a
// list that can grow, like a coach's squads).
export function ChipGroup({ label, a11yLabel, options, value, onChange, error, layout = 'wrap' }) {
  const chips = options.map((option) => (
    <Chip key={option.value} label={option.label} selected={option.value === value}
      onPress={() => onChange(option.value)} style={layout === 'segmented' ? { flex: 1 } : null} />
  ));
  const groupProps = { accessibilityRole: 'radiogroup', accessibilityLabel: label ?? a11yLabel };
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={chipStyles.label}>{label}</Text> : null}
      {layout === 'scroll' ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} {...groupProps}>
          {chips}
        </ScrollView>
      ) : (
        <View {...groupProps} style={[chipStyles.row, layout === 'segmented' && { flexWrap: 'nowrap' }]}>{chips}</View>
      )}
      {error ? <Text style={chipStyles.error}>{error}</Text> : null}
    </View>
  );
}

export function Chip({ label, selected, onPress, style }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected }}
      style={({ pressed }) => [chipStyles.chip, selected && chipStyles.chipSelected, pressed && { opacity: 0.7 }, style]}
    >
      <Text style={[chipStyles.chipText, selected && chipStyles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

// minHeight 44 keeps every chip a comfortable touch target
export const chipStyles = {
  label: { fontWeight: '600', color: '#0f172a' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 44, minWidth: 44, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1,
    borderColor: '#cbd5e1', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
  },
  chipSelected: { backgroundColor: '#0f4c81', borderColor: '#0f4c81' },
  chipText: { color: '#0f172a', fontWeight: '600' },
  chipTextSelected: { color: '#fff' },
  error: { color: '#dc2626' },
};
