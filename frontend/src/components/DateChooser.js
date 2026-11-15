import { useState } from 'react';
import { Platform, Text, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { formatSessionDate, localDateString, parseDateString, todayString, tomorrowString, yesterdayString } from '../lib/training';
import { Chip, chipStyles } from './ChipGroup';
import { Field } from './Form';

// Today / Yesterday / Pick date. value is a YYYY-MM-DD string.
// Phones use the native calendar (no future dates); the date picker package has
// no web version, so web types the date instead.
// planning (coaches' planned sessions): Today / Tomorrow, and any date can be picked.
export function DateChooser({ value, onChange, error, planning = false }) {
  const [showCalendar, setShowCalendar] = useState(false);
  const today = todayString();
  const other = planning ? tomorrowString() : yesterdayString();
  const otherLabel = planning ? 'Tomorrow' : 'Yesterday';
  const maximumDate = planning ? undefined : new Date();
  const isOtherDate = value !== today && value !== other;

  function pickDate() {
    const options = {
      value: /^\d{4}-\d{2}-\d{2}$/.test(value) ? parseDateString(value) : new Date(),
      mode: 'date',
      maximumDate,
      onValueChange: (_event, date) => {
        setShowCalendar(false);
        if (date) onChange(localDateString(date));
      },
    };
    // Android shows its own date dialog; iOS shows a calendar under the chips
    if (Platform.OS === 'android') DateTimePickerAndroid.open(options);
    else setShowCalendar((shown) => !shown);
  }

  return (
    <View style={{ gap: 6 }}>
      <Text style={chipStyles.label}>Date</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel="Date" style={chipStyles.row}>
        <Chip label="Today" selected={value === today} onPress={() => { setShowCalendar(false); onChange(today); }} />
        <Chip label={otherLabel} selected={value === other}
          onPress={() => { setShowCalendar(false); onChange(other); }} />
        {Platform.OS !== 'web' ? (
          <Chip label={isOtherDate && value ? formatSessionDate(value) : 'Pick date'} selected={isOtherDate}
            onPress={pickDate} />
        ) : null}
      </View>

      {Platform.OS === 'ios' && showCalendar ? (
        <DateTimePicker
          value={/^\d{4}-\d{2}-\d{2}$/.test(value) ? parseDateString(value) : new Date()}
          mode="date"
          display="inline"
          maximumDate={maximumDate}
          onValueChange={(_event, date) => {
            setShowCalendar(false);
            if (date) onChange(localDateString(date));
          }}
        />
      ) : null}

      {Platform.OS === 'web' ? (
        <Field label="Or another date" value={value} onChangeText={onChange} placeholder="YYYY-MM-DD" />
      ) : null}

      {error ? <Text style={chipStyles.error}>{error}</Text> : null}
    </View>
  );
}
