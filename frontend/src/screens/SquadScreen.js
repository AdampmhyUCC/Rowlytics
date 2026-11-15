import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Share, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { logError } from '../lib/log';
import { confirm } from '../lib/confirm';
import { validateSquadName } from '../lib/validation';
import { formatSessionDate, localDateString } from '../lib/training';
import {
  deleteSquad, fetchSquad, fetchSquadMembers, formatAthleteCount, regenerateSquadCode, removeSquadMember,
  renameSquad, squadInviteMessage,
} from '../lib/squads';
import { Button, Field, Message, Screen, styles } from '../components/Form';
import { SquadProgram } from '../components/SquadProgram';

// One of the coach's squads (/squad/<id>): rename or delete it, share or
// change its invite code, plan its training program, and see or remove the
// athletes in it
export default function SquadScreen() {
  const { id } = useLocalSearchParams();
  // null until loaded, false if the squad wasn't found
  const [squad, setSquad] = useState(null);
  const [members, setMembers] = useState(null);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState(null);
  const [message, setMessage] = useState({ text: '', kind: 'error' });
  // Which action is working: 'rename', 'delete', 'code' or an athlete_id being removed
  const [busy, setBusy] = useState(null);

  const showError = (text) => setMessage({ text, kind: 'error' });

  // RLS only returns the coach's own squads, so someone else's id is "not found"
  useFocusEffect(useCallback(() => {
    let current = true;
    Promise.all([fetchSquad(id), fetchSquadMembers(id)]).then(([squadResult, membersResult]) => {
      if (!current) return;
      logError('squad.load', squadResult.error);
      logError('squad.members', membersResult.error);
      const error = squadResult.error ?? membersResult.error;
      if (error) return showError(`Could not load squad: ${error.message}`);
      setSquad(squadResult.data ?? false);
      setName(squadResult.data?.name ?? '');
      setMembers(membersResult.data);
    });
    return () => { current = false; };
  }, [id]));

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace('/squads');
  }

  async function rename() {
    const error = validateSquadName(name);
    setNameError(error);
    if (error) return;
    setBusy('rename');
    const { error: saveError } = await renameSquad(id, name);
    setBusy(null);
    logError('squad.rename', saveError);
    if (saveError) return showError(`Could not rename squad: ${saveError.message}`);
    setSquad((s) => ({ ...s, name: name.trim() }));
    setMessage({ text: 'Name saved', kind: 'success' });
  }

  async function remove() {
    const count = members?.length ? ` and ${formatAthleteCount(members.length)} will be removed from it` : '';
    if (!(await confirm('Delete squad?', `"${squad.name}" will be deleted${count}. This can't be undone.`))) return;
    setBusy('delete');
    const { error } = await deleteSquad(id);
    setBusy(null);
    logError('squad.delete', error);
    if (error) return showError(`Could not delete squad: ${error.message}`);
    close();
  }

  // Codes are shared outside the app, through the phone's share sheet
  async function share() {
    try {
      await Share.share({ message: squadInviteMessage(squad) });
    } catch (error) {
      // Some web browsers can't share; the code is on screen to send by hand
      logError('squad.share', error);
      showError('Sharing isn\'t available here. Send the code to your athletes yourself.');
    }
  }

  async function newCode() {
    if (!(await confirm('Make a new code?',
      'The current code will stop working. Athletes already in the squad stay in it.', 'New code'))) return;
    setBusy('code');
    const { data, error } = await regenerateSquadCode(id);
    setBusy(null);
    logError('squad.regenerateCode', error);
    if (error) return showError(`Could not make a new code: ${error.message}`);
    setSquad((s) => ({ ...s, invite_code: data }));
    setMessage({ text: 'New code made. Share it with your athletes.', kind: 'success' });
  }

  async function removeMember(member) {
    if (!(await confirm(`Remove ${member.name}?`,
      `${member.name} will be taken out of "${squad.name}". They can join again with the current code.`,
      'Remove'))) return;
    setBusy(member.athlete_id);
    const { error } = await removeSquadMember(id, member.athlete_id);
    setBusy(null);
    logError('squad.removeMember', error);
    if (error) return showError(`Could not remove ${member.name}: ${error.message}`);
    setMembers((list) => list.filter((m) => m.athlete_id !== member.athlete_id));
  }

  if (!squad) {
    return (
      <Screen footer={<Button title="Back" variant="secondary" onPress={close} />}>
        {squad === false
          ? <Message text="This squad doesn't exist or was deleted." />
          : message.text ? <Message text={message.text} /> : <ActivityIndicator />}
      </Screen>
    );
  }

  return (
    <Screen footer={<>
      <Message text={message.text} kind={message.kind} />
      <Button title="Save name" onPress={rename} busy={busy === 'rename'} />
      <Button title="Delete squad" variant="danger" onPress={remove} busy={busy === 'delete'} />
    </>}>
      <Field label="Squad name" value={name} onChangeText={setName} error={nameError} maxLength={60} />

      <View style={squadStyles.codeCard}>
        <Text style={styles.label}>Invite code</Text>
        <Text style={squadStyles.code} selectable accessibilityLabel={squad.invite_code.split('').join(' ')}>
          {squad.invite_code}
        </Text>
        <Text style={styles.subtle}>
          Send this code to your athletes yourself, for example by text message. Athletes under 16 join through a parent.
        </Text>
        <Button title="Share code" variant="secondary" onPress={share} />
        <Button title="Make a new code" variant="secondary" onPress={newCode} busy={busy === 'code'} />
      </View>

      <SquadProgram squadId={id} />

      <Text style={styles.label}>Athletes ({members.length})</Text>
      {members.length === 0
        ? <Text style={styles.subtle}>No one has joined yet. Athletes appear here once they join with the code.</Text>
        : members.map((member) => (
          <MemberRow key={member.athlete_id} member={member} busy={busy === member.athlete_id}
            onRemove={() => removeMember(member)} />
        ))}
    </Screen>
  );
}

// Training is shown in a later issue (#34), and only for athletes who share it
function MemberRow({ member, busy, onRemove }) {
  const joined = formatSessionDate(localDateString(new Date(member.joined_at)));
  return (
    <View style={squadStyles.memberRow}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={squadStyles.memberName}>{member.name}</Text>
        <Text style={styles.subtle}>
          Joined {joined} · {member.sharing ? 'Sharing training' : 'Not sharing training'}
        </Text>
      </View>
      {busy ? <ActivityIndicator color="#dc2626" /> : (
        <Pressable
          onPress={onRemove}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${member.name}`}
          hitSlop={8}
          style={({ pressed }) => pressed && { opacity: 0.6 }}
        >
          <Text style={squadStyles.remove}>Remove</Text>
        </Pressable>
      )}
    </View>
  );
}

const squadStyles = {
  codeCard: { gap: 10, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff' },
  code: { fontSize: 28, fontWeight: 'bold', letterSpacing: 4, color: '#0f172a', textAlign: 'center' },
  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 10,
    borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff',
  },
  memberName: { fontWeight: '600', fontSize: 16, color: '#0f172a' },
  remove: { color: '#dc2626', fontWeight: '600' },
};
