import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { logError } from '../lib/log';
import { confirm } from '../lib/confirm';
import { fetchJoinedSquads, joinSquad, leaveSquad } from '../lib/squads';
import { validateSquadCode } from '../lib/validation';
import { Button, Field, Message, styles } from './Form';

// On the parent page: the squads an under-16 child is in, with a code box so
// the parent can join for them (under-16s can't join themselves, #33)
export function ChildSquads({ child }) {
  const [squads, setSquads] = useState(null);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState(null);
  const [message, setMessage] = useState({ text: '', kind: 'error' });
  // 'join' or the squad_id being left
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    const { data, error } = await fetchJoinedSquads(child.athlete_id);
    logError('childSquads.load', error);
    if (error) return setMessage({ text: `Could not load ${child.name}'s squads: ${error.message}`, kind: 'error' });
    setSquads(data);
  }, [child.athlete_id, child.name]);

  useEffect(() => { load(); }, [load]);

  async function join() {
    const error = validateSquadCode(code);
    setCodeError(error);
    if (error) return;

    setBusy('join');
    setMessage({ text: '' });
    const { data, error: joinError } = await joinSquad(code, child.athlete_id);
    setBusy(null);

    logError('childSquads.join', joinError);
    if (joinError) return setMessage({ text: joinError.message, kind: 'error' });
    setCode('');
    setMessage({
      text: data.already_member
        ? `${child.name} is already in ${data.squad_name} (coach ${data.coach_name}).`
        : `${child.name} has joined ${data.squad_name} (coach ${data.coach_name}).`,
      kind: 'success',
    });
    load();
  }

  async function leave(squad) {
    if (!(await confirm(`Take ${child.name} out of ${squad.name}?`,
      `${squad.coach_name} will no longer see ${child.name} in this squad. You can join again with the code.`,
      'Leave'))) return;
    setBusy(squad.squad_id);
    const { error } = await leaveSquad(squad.squad_id, child.athlete_id);
    setBusy(null);
    logError('childSquads.leave', error);
    if (error) return setMessage({ text: `Could not leave ${squad.name}: ${error.message}`, kind: 'error' });
    setMessage({ text: '' });
    setSquads((list) => list.filter((s) => s.squad_id !== squad.squad_id));
  }

  return (
    <View style={cardStyle}>
      <Text style={styles.label}>{child.name}'s squads</Text>

      {squads === null && !message.text ? <ActivityIndicator /> : null}
      {squads?.length === 0 ? <Text style={styles.subtle}>Not in any squads yet.</Text> : null}
      {squads?.map((squad) => (
        <View key={squad.squad_id} style={rowStyle}>
          <Text style={{ flex: 1, color: '#0f172a' }}>
            <Text style={{ fontWeight: '600' }}>{squad.name}</Text> · Coach {squad.coach_name}
          </Text>
          {busy === squad.squad_id ? <ActivityIndicator color="#dc2626" /> : (
            <Pressable
              onPress={() => leave(squad)}
              accessibilityRole="button"
              accessibilityLabel={`Take ${child.name} out of ${squad.name}`}
              hitSlop={8}
              style={({ pressed }) => pressed && { opacity: 0.6 }}
            >
              <Text style={{ color: '#dc2626', fontWeight: '600' }}>Leave</Text>
            </Pressable>
          )}
        </View>
      ))}

      <Text style={styles.subtle}>
        When {child.name}'s coach sends a squad code, enter it here to join for them. The coach
        will see {child.name}'s name. They only see {child.name}'s training if {child.name} chooses
        to share it with coaches.
      </Text>
      <Field label="Squad code" value={code} onChangeText={setCode} error={codeError}
        placeholder="e.g. ABCD2345" maxLength={12} autoCapitalize="characters" autoCorrect={false}
        autoComplete="off" returnKeyType="join" onSubmitEditing={join} />
      <Message text={message.text} kind={message.kind} />
      <Button title={`Join for ${child.name}`} onPress={join} busy={busy === 'join'} />
    </View>
  );
}

const cardStyle = { gap: 10, padding: 14, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, backgroundColor: '#fff' };
const rowStyle = { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 };
