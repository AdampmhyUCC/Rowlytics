import { useState } from 'react';
import { Platform, Text, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { formatSessionDate, localDateString, parseDateString, todayString, yesterdayString } from '../lib/training';
import { Chip, chipStyles } from './ChipGroup';
import { Field } from './Form';

// Today / Yesterday / Pick date. value is a YYYY-MM-DD string.
// Phones use the native calendar (no future dates); the date picker package has
// no web version, so web types the date instead.
export function DateChooser({ value, onChange, error }) {
  const [showCalendar, setShowCalendar] = useState(false);
  const today = todayString();
  const yesterday = yesterdayString();
  const isOtherDate = value !== today && value !== yesterday;

  function pickDate() {
    const options = {
      value: /^\d{4}-\d{2}-\d{2}$/.test(value) ? parseDateString(value) : new Date(),
      mode: 'date',
      maximumDate: new Date(),
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
        <Chip label="Yesterday" selected={value === yesterday}
          onPress={() => { setShowCalendar(false); onChange(yesterday); }} />
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
          maximumDate={new Date()}
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
