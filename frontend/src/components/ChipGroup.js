import { Pressable, Text, View } from 'react-native';

// A row of tappable options where one can be selected, e.g. session type.
// options: [{ value, label }]
export function ChipGroup({ label, options, value, onChange, error }) {
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={chipStyles.label}>{label}</Text> : null}
      <View accessibilityRole="radiogroup" accessibilityLabel={label} style={chipStyles.row}>
        {options.map((option) => (
          <Chip key={option.value} label={option.label} selected={option.value === value}
            onPress={() => onChange(option.value)} />
        ))}
      </View>
      {error ? <Text style={chipStyles.error}>{error}</Text> : null}
    </View>
  );
}

export function Chip({ label, selected, onPress, style }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
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
