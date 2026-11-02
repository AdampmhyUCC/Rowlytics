import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { validateDob, validateName } from '../lib/validation';
import { Button, Field, Message, Screen, styles } from '../components/Form';

export default function Profile() {
  const { session, refreshConsent } = useAuth();
  // session briefly becomes null on log out, before this screen unmounts
  const userId = session?.user.id;
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ name: '', dob: '' });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState({ text: '', kind: 'error' });
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  // RLS only returns the signed-in user's own row
  async function loadProfile() {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, dob, role')
      .eq('id', userId)
      .single();
    if (error) return setMessage({ text: `Could not load profile: ${error.message}`, kind: 'error' });
    setProfile(data);
    setForm({ name: data.name, dob: data.dob });
  }

  useEffect(() => { if (userId) loadProfile(); }, [userId]);

  async function save() {
    const newErrors = { name: validateName(form.name), dob: validateDob(form.dob) };
    setErrors(newErrors);
    if (Object.values(newErrors).some(Boolean)) return;

    setBusy(true);
    const { data, error } = await supabase
      .from('profiles')
      .update({ name: form.name.trim(), dob: form.dob })
      .eq('id', userId)
      .select('id, name, dob, role')
      .single();
    setBusy(false);

    if (error) return setMessage({ text: `Save failed: ${error.message}`, kind: 'error' });
    setProfile(data);
    setEditing(false);
    setMessage({ text: 'Profile saved', kind: 'success' });
    // A new date of birth under 16 means parental consent is needed
    refreshConsent();
  }

  function cancel() {
    setForm({ name: profile.name, dob: profile.dob });
    setErrors({});
    setEditing(false);
  }

  async function logOut() {
    const { error } = await supabase.auth.signOut();
    // On success the root layout sees the session end and returns to login
    if (error) setMessage({ text: `Log out failed: ${error.message}`, kind: 'error' });
  }

  if (!profile) {
    return (
      <Screen>
        {message.text ? <Message text={message.text} kind={message.kind} /> : <ActivityIndicator />}
        <Button title="Log out" variant="secondary" onPress={logOut} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View>
        <Text style={styles.heading}>{profile.name}</Text>
        <Text style={[styles.subtle, { textTransform: 'capitalize' }]}>{profile.role}</Text>
      </View>

      <Field label="Email" value={session?.user.email ?? ''} editable={false} />
      <Field label="Full name" value={form.name} error={errors.name} editable={editing}
        onChangeText={(name) => setForm((f) => ({ ...f, name }))} />
      <Field label="Date of birth" value={form.dob} error={errors.dob} editable={editing}
        placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation"
        onChangeText={(dob) => setForm((f) => ({ ...f, dob }))} />

      <Message text={message.text} kind={message.kind} />

      {editing ? (
        <>
          <Button title="Save changes" onPress={save} busy={busy} />
          <Button title="Cancel" variant="secondary" onPress={cancel} />
        </>
      ) : (
        <Button title="Edit profile" onPress={() => { setMessage({ text: '' }); setEditing(true); }} />
      )}

      <View style={{ flex: 1 }} />
      <Button title="Log out" variant="secondary" onPress={logOut} />
    </Screen>
  );
}
