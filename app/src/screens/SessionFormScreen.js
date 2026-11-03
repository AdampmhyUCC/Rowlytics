import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '../lib/supabase';
import { logError } from '../lib/log';
import { confirm } from '../lib/confirm';
import { validateSession } from '../lib/validation';
import { MODALITIES, fetchSession, todayString } from '../lib/training';
import { Button, Field, Message, Screen, styles } from '../components/Form';
import { ChipGroup } from '../components/ChipGroup';
import { DateChooser } from '../components/DateChooser';
import { RpeWheel } from '../components/RpeWheel';

const EMPTY_FORM = { date: '', modality: 'erg', distance: '', minutes: '', seconds: '', rpe: null, notes: '' };

// Log a new session (/session/new) or edit one (/session/<id>)
export default function SessionFormScreen() {
  const { id } = useLocalSearchParams();
  const editing = !!id;
  const [form, setForm] = useState(() => ({ ...EMPTY_FORM, date: todayString() }));
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  // While editing: null until loaded, false if the session wasn't found
  const [loaded, setLoaded] = useState(editing ? null : true);
  // Which button is working: 'save' or 'delete'
  const [busy, setBusy] = useState(null);

  const update = (field) => (value) => setForm((f) => ({ ...f, [field]: value }));

  useEffect(() => {
    if (!editing) return;
    // RLS only returns the athlete's own sessions, so someone else's id is "not found"
    fetchSession(id).then(({ data, error }) => {
      logError('sessionForm.load', error);
      if (error) return setMessage(`Could not load session: ${error.message}`);
      if (!data) return setLoaded(false);
      setForm({
        date: data.session_date,
        modality: data.modality,
        distance: data.distance_m == null ? '' : String(data.distance_m),
        minutes: String(Math.floor(data.duration_seconds / 60)),
        seconds: String(data.duration_seconds % 60),
        rpe: data.rpe,
        notes: data.notes ?? '',
      });
      setLoaded(true);
    });
  }, [id]);

  // Modals opened from a link (e.g. on web) have nothing to go back to
  function close() {
    if (router.canGoBack()) router.back();
    else router.replace('/training');
  }

  async function save() {
    const newErrors = validateSession(form, todayString());
    setErrors(newErrors);
    if (Object.keys(newErrors).length) return setMessage('Check the highlighted fields');

    const row = {
      session_date: form.date,
      modality: form.modality,
      distance_m: form.distance.trim() ? Number(form.distance) : null,
      duration_seconds: Number(form.minutes || 0) * 60 + Number(form.seconds || 0),
      rpe: form.rpe,
      notes: form.notes.trim() || null,
    };

    setBusy('save');
    setMessage('');
    // athlete_id is filled in by the database (my_athlete_id)
    const { error } = editing
      ? await supabase.from('completed_training').update(row).eq('completed_training_id', id)
      : await supabase.from('completed_training').insert(row);
    setBusy(null);

    logError('sessionForm.save', error);
    if (error) return setMessage(`Save failed: ${error.message}`);
    close();
  }

  async function remove() {
    if (!(await confirm('Delete session?', 'This session will be removed from your training log.'))) return;
    setBusy('delete');
    const { error } = await supabase.from('completed_training').delete().eq('completed_training_id', id);
    setBusy(null);
    logError('sessionForm.delete', error);
    if (error) return setMessage(`Delete failed: ${error.message}`);
    close();
  }

  if (loaded !== true) {
    return (
      <Screen footer={<Button title="Back" variant="secondary" onPress={close} />}>
        {loaded === false
          ? <Message text="This session doesn't exist or was deleted." />
          : message ? <Message text={message} /> : <ActivityIndicator />}
      </Screen>
    );
  }

  return (
    <Screen footer={<>
      <Message text={message} />
      <Button title={editing ? 'Save changes' : 'Save session'} onPress={save} busy={busy === 'save'} />
      <Button title="Cancel" variant="secondary" onPress={close} />
      {editing ? <Button title="Delete session" variant="danger" onPress={remove} busy={busy === 'delete'} /> : null}
    </>}>
      <DateChooser value={form.date} onChange={update('date')} error={errors.date} />

      <ChipGroup label="Type" options={MODALITIES} value={form.modality} onChange={update('modality')}
        error={errors.modality} />

      <Field label={form.modality === 'other' ? 'Distance (m), optional' : 'Distance (m)'}
        value={form.distance} onChangeText={update('distance')} error={errors.distance}
        placeholder="e.g. 6000" keyboardType="number-pad" />

      <View style={{ gap: 4 }}>
        <Text style={styles.label}>Time</Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Field label="Minutes" value={form.minutes} onChangeText={update('minutes')}
              placeholder="0" keyboardType="number-pad" error={errors.duration ? ' ' : null} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Seconds" value={form.seconds} onChangeText={update('seconds')}
              placeholder="0" keyboardType="number-pad" maxLength={2} error={errors.duration ? ' ' : null} />
          </View>
        </View>
        {errors.duration ? <Text style={styles.error}>{errors.duration}</Text> : null}
      </View>

      <RpeWheel value={form.rpe} onChange={update('rpe')} error={errors.rpe} />

      <Field label="Notes, optional" value={form.notes} onChangeText={update('notes')} error={errors.notes}
        placeholder="e.g. 3 x 2000m, 5 min rest" multiline maxLength={500}
        style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }, errors.notes && styles.inputError]} />
    </Screen>
  );
}
