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
    const { data, error } = await supabase.from('athletes').select('*').order('name');
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
  async function deleteFirst() {
    if (athletes.length === 0) return setMessage('Load athletes first');
    const first = athletes[0];
    const { error } = await supabase
      .from('athletes')
      .delete()
      .eq('athlete_id', first.athlete_id);
    if (error) return setMessage(`Delete failed: ${error.message}`);
    setMessage(`Deleted ${first.name}`);
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
        <Button title="Delete first athlete (Delete)" onPress={deleteFirst} />

        <Text style={{ marginTop: 10, fontStyle: 'italic' }}>{message}</Text>

        <View style={{ marginTop: 10 }}>
          {athletes.map((a) => (
  <Text
    key={a.athlete_id}
    onPress={() => { setSelected(a); setName(a.name); }}
    style={{
      paddingVertical: 6,
      fontWeight: selected?.athlete_id === a.athlete_id ? 'bold' : 'normal',
    }}
  >
    {a.name}
  </Text>
))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}