import { useEffect, useState } from 'react';
import { SafeAreaView, Text } from 'react-native';
import { supabase } from './supabase';

export default function App() {
  const [message, setMessage] = useState('Loading...');

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.from('athletes').select('*');
      if (error) setMessage(`Error: ${error.message}`);
      else setMessage(`Found ${data.length} athlete(s): ${data.map((a) => a.name).join(', ')}`);
    }
    load();
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, justifyContent: 'center', padding: 20 }}>
      <Text style={{ fontSize: 18 }}>{message}</Text>
    </SafeAreaView>
  );
}