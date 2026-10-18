import { useEffect, useState } from 'react';
import { Button, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import { supabase } from './supabase';


export default function App() {
  const [athletes, setAthletes] = useState([]);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState(null);

  // READ: get every athlete from Supabase
  async function loadAthletes() {
    const { data, error } = await supabase
  .from('athletes')
  .select('*, completed_training(*)')
  .order('name');
    if (error) return setMessage(`Read failed: ${error.message}`);
    setAthletes(data);
    setMessage(`Loaded ${data.length} athlete(s)`);
    
  }

  // CREATE: add an athlete (dob is required by the table, so use a test date)
  async function addAthlete() {
    const { error } = await supabase
      .from('athletes')
      .insert({ name: name.trim() || 'Test athlete', dob: '2004-01-01' });
    if (error) return setMessage(`Create failed: ${error.message}`);
    setName('');
    setMessage('Athlete added');
    loadAthletes();
  }

  
  // UPDATE: save the text box as the selected athlete's new name
async function saveEdit() {
  if (!selected) return setMessage('Tap an athlete to select it first');
  if (!name.trim()) return setMessage('Type the new name first');
  const { error } = await supabase
    .from('athletes')
    .update({ name: name.trim() })
    .eq('athlete_id', selected.athlete_id);
  if (error) return setMessage(`Update failed: ${error.message}`);
  setMessage(`Renamed ${selected.name} to ${name.trim()}`);
  setSelected(null);
  setName('');
  loadAthletes();
}

  // DELETE: remove the first athlete
  // DELETE: remove the selected athlete (their sessions go too, via ON DELETE CASCADE)
async function deleteSelected() {
  if (!selected) return setMessage('Tap an athlete to select it first');
  const { error } = await supabase
    .from('athletes')
    .delete()
    .eq('athlete_id', selected.athlete_id);
  if (error) return setMessage(`Delete failed: ${error.message}`);
  setMessage(`Deleted ${selected.name}`);
  setSelected(null);
  setName('');
  loadAthletes();
}

  // CREATE (related table): log a test session for the selected athlete
async function addSession() {
  if (!selected) return setMessage('Tap an athlete to select it first');
  const { error } = await supabase.from('completed_training').insert({
    athlete_id: selected.athlete_id,
    modality: 'Erg',
    volume: 10000,          // metres
    duration_minutes: 45,
    heart_rate: 150,
    rpe: 6,
    notes: 'Test session from the app',
    self_reported: true,
  });
  if (error) return setMessage(`Session failed: ${error.message}`);
  setMessage(`Session logged for ${selected.name}`);
  loadAthletes();
}

// Deliberately break a database rule: RPE must be between 1 and 10
async function addInvalidSession() {
  if (!selected) return setMessage('Tap an athlete to select it first');
  const { error } = await supabase.from('completed_training').insert({
    athlete_id: selected.athlete_id,
    rpe: 11,
  });
  setMessage(error ? `Rejected as expected: ${error.message}` : 'Unexpectedly accepted');
}

// DELETE (related table): remove one session by its ID
async function deleteSession(session) {
  const { error } = await supabase
    .from('completed_training')
    .delete()
    .eq('completed_training_id', session.completed_training_id);
  if (error) return setMessage(`Delete session failed: ${error.message}`);
  setMessage('Session deleted');
  loadAthletes();
}

  useEffect(() => { loadAthletes(); }, []);

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 10 }}>
        <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Rowlytics CRUD test</Text>

        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Athlete name (e.g. Added from phone)"
          style={{ borderWidth: 1, borderRadius: 6, padding: 10 }}
        />

        <Button title="Add athlete (Create)" onPress={addAthlete} />
        <Button title="Load athletes (Read)" onPress={loadAthletes} />
        <Button title="Save edit to selected (Update)" onPress={saveEdit} />
        <Button title="Delete selected athlete (Delete)" onPress={deleteSelected} />
        <Button title="Log test session for selected" onPress={addSession} />
        <Button title="Try invalid session (RPE 11)" onPress={addInvalidSession} />

        <Text style={{ marginTop: 10, fontStyle: 'italic' }}>{message}</Text>

        <View style={{ marginTop: 10 }}>
          {athletes.map((a) => (
  <Text
    key={a.athlete_id}
    onPress={() => { setSelected(a); setName; }}
    style={{
      paddingVertical: 6,
      fontWeight: selected?.athlete_id === a.athlete_id ? 'bold' : 'normal',
    }}
  >
    {a.name} ({a.completed_training?.length ?? 0} sessions)
  </Text>
))}
        </View>
        {selected && (() => {
  // Use the freshly loaded copy, so the list updates after adding or deleting
  const current = athletes.find((a) => a.athlete_id === selected.athlete_id);
  const sessions = current?.completed_training ?? [];
  return (
    <View style={{ marginTop: 16 }}>
      <Text style={{ fontSize: 18, fontWeight: 'bold' }}>
        Sessions for {current?.name}
      </Text>
      {sessions.length === 0 && <Text>No sessions yet</Text>}
      {sessions.map((s) => (
        <View key={s.completed_training_id}
          style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
          <Text>
            {s.session_date} · {s.volume ?? '–'} m · {s.duration_minutes ?? '–'} min · RPE {s.rpe ?? '–'}
          </Text>
          <Text onPress={() => deleteSession(s)} style={{ color: 'red' }}>Delete</Text>
        </View>
      ))}
    </View>
  );
})()}
      </ScrollView>
    </SafeAreaView>
  );
}