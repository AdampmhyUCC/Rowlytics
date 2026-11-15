import { useEffect, useState } from 'react';
import { ActivityIndicator, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { logError } from '../lib/log';
import { confirm } from '../lib/confirm';
import { validatePlannedSession } from '../lib/validation';
import { MODALITIES, todayString } from '../lib/training';
import { createPlannedSession, deletePlannedSession, fetchPlannedSession, updatePlannedSession } from '../lib/program';
import { Button, Field, Message, Screen, styles } from '../components/Form';
import { ChipGroup } from '../components/ChipGroup';
import { DateChooser } from '../components/DateChooser';

const EMPTY_FORM = { date: '', modality: 'erg', title: '', details: '' };

// Coach plans a session for a squad (/plan/new?squadId=<id>) or edits one
// (/plan/<id>). Everyone in the squad sees it in their training log.
export default function PlannedSessionFormScreen() {
  const { id, squadId: newSquadId } = useLocalSearchParams();
  const editing = !!id;
  const [squadId, setSquadId] = useState(newSquadId);
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
    // RLS only returns the coach's own squads' sessions, so anyone else's is "not found"
    fetchPlannedSession(id).then(({ data, error }) => {
      logError('plannedSession.load', error);
      if (error) return setMessage(`Could not load session: ${error.message}`);
      if (!data) return setLoaded(false);
      setSquadId(data.squad_id);
      setForm({ date: data.session_date, modality: data.modality, title: data.title, details: data.details ?? '' });
      setLoaded(true);
    });
  }, [id]);

  // Modals opened from a link (e.g. on web) have nothing to go back to
  function close() {
    if (router.canGoBack()) router.back();
    else router.replace(squadId ? `/squad/${squadId}` : '/squads');
  }

  async function save() {
    const newErrors = validatePlannedSession(form);
    setErrors(newErrors);
    if (Object.keys(newErrors).length) return setMessage('Check the highlighted fields');

    setBusy('save');
    setMessage('');
    const { error } = editing ? await updatePlannedSession(id, form) : await createPlannedSession(squadId, form);
    setBusy(null);

    logError('plannedSession.save', error);
    if (error) return setMessage(`Save failed: ${error.message}`);
    close();
  }

  async function remove() {
    if (!(await confirm('Delete planned session?',
      'It will be removed from the squad\'s program. Sessions athletes have already logged stay in their logs.'))) return;
    setBusy('delete');
    const { error } = await deletePlannedSession(id);
    setBusy(null);
    logError('plannedSession.delete', error);
    if (error) return setMessage(`Delete failed: ${error.message}`);
    close();
  }

  if (loaded !== true || !squadId) {
    return (
      <Screen footer={<Button title="Back" variant="secondary" onPress={close} />}>
        {loaded === false || (loaded && !squadId)
          ? <Message text="This planned session doesn't exist or was deleted." />
          : message ? <Message text={message} /> : <ActivityIndicator />}
      </Screen>
    );
  }

  return (
    <Screen footer={<>
      <Message text={message} />
      <Button title={editing ? 'Save changes' : 'Add to program'} onPress={save} busy={busy === 'save'} />
      <Button title="Cancel" variant="secondary" onPress={close} />
      {editing ? <Button title="Delete session" variant="danger" onPress={remove} busy={busy === 'delete'} /> : null}
    </>}>
      <DateChooser value={form.date} onChange={update('date')} error={errors.date} planning />

      <ChipGroup label="Type" options={MODALITIES} value={form.modality} onChange={update('modality')}
        error={errors.modality} layout="segmented" />

      <Field label="Title" value={form.title} onChangeText={update('title')} error={errors.title}
        placeholder="e.g. 3 x 2k" maxLength={80} />

      <Field label="Details, optional" value={form.details} onChangeText={update('details')} error={errors.details}
        placeholder="e.g. Rate 24, 5 min rest between pieces" multiline maxLength={500}
        style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }, errors.details && styles.inputError]} />

      <Text style={styles.subtle}>
        Everyone in the squad sees this in their training log and ticks it off by logging the session.
      </Text>
    </Screen>
  );
}
