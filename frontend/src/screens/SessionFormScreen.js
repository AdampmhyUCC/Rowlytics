import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '../lib/supabase';
import { logError } from '../lib/log';
import { confirm } from '../lib/confirm';
import { validateSession } from '../lib/validation';
import { MODALITIES, fetchSession, formatSessionDate, todayString } from '../lib/training';
import { fetchPlannedSession } from '../lib/program';
import { Button, Field, Message, Screen, styles } from '../components/Form';
import { ChipGroup } from '../components/ChipGroup';
import { DateChooser } from '../components/DateChooser';
import { RpeWheel } from '../components/RpeWheel';

const EMPTY_FORM = { date: '', modality: 'erg', distance: '', minutes: '', seconds: '', rpe: null, notes: '' };

// Log a new session (/session/new) or edit one (/session/<id>).
// /session/new?planned=<id> logs a coach's planned session (#34): the form
// starts from the plan and the saved session is linked to it.
export default function SessionFormScreen() {
  const { id, planned } = useLocalSearchParams();
  const editing = !!id;
  // The planned session being logged, shown above the form
  const [plan, setPlan] = useState(null);
  const [form, setForm] = useState(() => ({ ...EMPTY_FORM, date: todayString() }));
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  // While editing: null until loaded, false if the session wasn't found
  const [loaded, setLoaded] = useState(editing || planned ? null : true);
  // Which button is working: 'save' or 'delete'
  const [busy, setBusy] = useState(null);

  const update = (field) => (value) => setForm((f) => ({ ...f, [field]: value }));

  // Start from the plan's type, and its date unless that's still to come
  useEffect(() => {
    if (editing || !planned) return;
    fetchPlannedSession(planned).then(({ data, error }) => {
      logError('sessionForm.loadPlan', error);
      if (error) return setMessage(`Could not load the planned session: ${error.message}`);
      if (!data) return setLoaded(false);
      setPlan(data);
      setForm((f) => ({
        ...f,
        modality: data.modality,
        date: data.session_date < todayString() ? data.session_date : todayString(),
      }));
      setLoaded(true);
    });
  }, [planned]);

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
      : await supabase.from('completed_training').insert(plan ? { ...row, planned_session_id: plan.planned_session_id } : row);
    setBusy(null);

    logError('sessionForm.save', error);
    // 23505: completed_training_planned_once (program.sql)
    if (error?.code === '23505') return setMessage('You\'ve already logged this planned session');
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
          ? <Message text={planned ? 'This planned session was deleted or you\'re no longer in its squad.'
            : 'This session doesn\'t exist or was deleted.'} />
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
      {plan ? (
        <View style={planStyles.box}>
          <Text style={planStyles.heading}>Planned for {formatSessionDate(plan.session_date)}</Text>
          <Text style={planStyles.title}>{plan.title}</Text>
          {plan.details ? <Text style={styles.subtle}>{plan.details}</Text> : null}
        </View>
      ) : null}

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

const planStyles = {
  box: { gap: 2, padding: 12, borderRadius: 10, borderLeftWidth: 4, borderLeftColor: '#0f4c81', backgroundColor: '#eff6ff' },
  heading: { color: '#475569', fontWeight: '600' },
  title: { fontWeight: '600', fontSize: 16, color: '#0f172a' },
};
