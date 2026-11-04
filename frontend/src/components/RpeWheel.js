import { useEffect, useRef } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { RPE_LABELS } from '../lib/training';
import { Chip, chipStyles } from './ChipGroup';

const ITEM = 44;
const VISIBLE = 5; // rows shown; the middle one is the selection
const VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// RPE 1–10 as a scrolling wheel that snaps to a value. value is null until the
// athlete chooses, so nobody saves a default they didn't mean.
// Web gets tap buttons instead: wheel scrolling with a mouse is unreliable.
export function RpeWheel({ value, onChange, error }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={chipStyles.label}>Effort (RPE)</Text>
      <Text style={{ color: '#475569' }}>How hard was the whole session? Rate it about 30 minutes after.</Text>
      {Platform.OS === 'web' ? <RpeButtons value={value} onChange={onChange} /> : <Wheel value={value} onChange={onChange} />}
      {error ? <Text style={chipStyles.error}>{error}</Text> : null}
    </View>
  );
}

function Wheel({ value, onChange }) {
  const scrollRef = useRef(null);
  const scrollTo = (rpe, animated = true) => scrollRef.current?.scrollTo({ y: (rpe - 1) * ITEM, animated });

  // Move to the saved value when editing a session, once it has loaded
  useEffect(() => { if (value) scrollTo(value); }, [value]);

  // The row in the middle band once scrolling stops
  function selectFromOffset(event) {
    const index = Math.round(event.nativeEvent.contentOffset.y / ITEM);
    const rpe = Math.min(10, Math.max(1, index + 1));
    if (rpe !== value) onChange(rpe);
  }

  function step(change) {
    const rpe = Math.min(10, Math.max(1, (value ?? 5) + change));
    onChange(rpe);
    scrollTo(rpe);
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Effort, RPE 1 to 10"
        accessibilityValue={{ min: 1, max: 10, now: value ?? undefined, text: value ? describe(value) : 'Not chosen' }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) => step(event.nativeEvent.actionName === 'increment' ? 1 : -1)}
        style={{ width: 96, height: ITEM * VISIBLE }}
      >
        {/* Highlight behind the middle row */}
        <View pointerEvents="none" style={wheelStyles.band} />
        <ScrollView
          ref={scrollRef}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM}
          decelerationRate="fast"
          contentContainerStyle={{ paddingVertical: ITEM * Math.floor(VISIBLE / 2) }}
          onLayout={() => scrollTo(value ?? 5, false)}
          onMomentumScrollEnd={selectFromOffset}
          onScrollEndDrag={(event) => {
            // No momentum (a slow drag) means no momentum-end event, so select here
            if (!event.nativeEvent.velocity?.y) selectFromOffset(event);
          }}
        >
          {VALUES.map((rpe) => (
            <Pressable key={rpe} onPress={() => { onChange(rpe); scrollTo(rpe); }}
              importantForAccessibility="no" style={wheelStyles.item}>
              <Text style={[wheelStyles.itemText, rpe === value && wheelStyles.itemTextSelected]}>{rpe}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <View style={{ flex: 1, gap: 4 }}>
        <Text style={wheelStyles.value}>{value ?? '–'}</Text>
        <Text style={{ color: '#475569' }}>{value ? RPE_LABELS[value] || ' ' : 'Scroll or tap to choose'}</Text>
      </View>
    </View>
  );
}

function RpeButtons({ value, onChange }) {
  return (
    <View style={{ gap: 6 }}>
      <View accessibilityRole="radiogroup" accessibilityLabel="Effort, RPE 1 to 10" style={chipStyles.row}>
        {VALUES.map((rpe) => (
          <Chip key={rpe} label={String(rpe)} selected={rpe === value} onPress={() => onChange(rpe)}
            style={{ paddingHorizontal: 0, width: 48 }} />
        ))}
      </View>
      <Text style={{ color: '#475569' }}>{value ? describe(value) : '1 very, very easy · 5 hard · 10 maximal'}</Text>
    </View>
  );
}

function describe(rpe) {
  return RPE_LABELS[rpe] ? `${rpe}, ${RPE_LABELS[rpe]}` : String(rpe);
}

const wheelStyles = {
  band: {
    position: 'absolute', left: 0, right: 0, top: ITEM * Math.floor(VISIBLE / 2), height: ITEM,
    borderRadius: 8, backgroundColor: '#e0ecf7',
  },
  item: { height: ITEM, alignItems: 'center', justifyContent: 'center' },
  itemText: { fontSize: 20, color: '#94a3b8', fontWeight: '600' },
  itemTextSelected: { color: '#0f4c81', fontSize: 24 },
  value: { fontSize: 32, fontWeight: 'bold', color: '#0f172a' },
};
