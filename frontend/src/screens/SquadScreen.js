import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Share, Text, View } from 'react-native';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { logError } from '../lib/log';
import { confirm } from '../lib/confirm';
import { validateSquadDescription, validateSquadName } from '../lib/validation';
import { formatSessionDate, localDateString } from '../lib/training';
import {
  deleteSquad, fetchSquad, fetchSquadMembers, formatAthleteCount, formatSquadCode, regenerateSquadCode,
  removeSquadMember, squadInviteMessage, updateSquad,
} from '../lib/squads';
import { Button, Field, Message, Screen, styles } from '../components/Form';
import { SquadProgram } from '../components/SquadProgram';
import { backFallback } from '../components/AppHeader';

// One of the coach's squads (/squad/<id>), in the order coaches use it: the
// invite code to share, the athletes, the training program, then the rarely
// used settings (name, description, delete) at the bottom, away from the share button
export default function SquadScreen() {
  const { id } = useLocalSearchParams();
  // null until loaded, false if the squad wasn't found
  const [squad, setSquad] = useState(null);
  const [members, setMembers] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  // Errors for the name and description
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState({ text: '', kind: 'error' });
  // Which action is working: 'save', 'delete', 'code' or an athlete_id being removed
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
      setDescription(squadResult.data?.description ?? '');
      setMembers(membersResult.data);
    });
    return () => { current = false; };
  }, [id]));

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace('/squads');
  }

  async function saveDetails() {
    const newErrors = { name: validateSquadName(name), description: validateSquadDescription(description) };
    setErrors(newErrors);
    if (newErrors.name || newErrors.description) return;
    setBusy('save');
    const { error: saveError } = await updateSquad(id, { name, description });
    setBusy(null);
    logError('squad.save', saveError);
    if (saveError) return showError(`Could not save squad: ${saveError.message}`);
    setSquad((s) => ({ ...s, name: name.trim(), description: description.trim() || null }));
    setMessage({ text: 'Changes saved', kind: 'success' });
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

  const changed = name.trim() !== squad.name || description.trim() !== (squad.description ?? '');

  return (
    <Screen footer={<>
      <Message text={message.text} kind={message.kind} />
      <Button title="Share invite code" onPress={share} />
      {/* Only when there's a new name or description to save */}
      {changed ? <Button title="Save changes" variant="secondary" onPress={saveDetails} busy={busy === 'save'} /> : null}
    </>}>
      <Stack.Screen options={{ title: squad.name, ...backFallback('/squads', 'Squads') }} />

      <View style={squadStyles.codeCard}>
        <Text style={styles.label}>Invite code</Text>
        <Text style={squadStyles.code} selectable accessibilityLabel={squad.invite_code.split('').join(' ')}>
          {formatSquadCode(squad.invite_code)}
        </Text>
        <Text style={[styles.subtle, { textAlign: 'center' }]}>
          Athletes join with this code. Under-16s join through a parent.
        </Text>
        <Pressable
          onPress={newCode}
          disabled={busy === 'code'}
          accessibilityRole="button"
          accessibilityHint="Makes a new code. The current one stops working."
          style={({ pressed }) => [squadStyles.textButton, pressed && { opacity: 0.6 }]}
        >
          {busy === 'code'
            ? <ActivityIndicator color="#475569" />
            : <Text style={squadStyles.resetCode}>Reset code</Text>}
        </Pressable>
      </View>

      <Text style={[styles.label, squadStyles.section]}>Athletes · {members.length}</Text>
      {members.length === 0
        ? <Text style={styles.subtle}>No one has joined yet. Athletes appear here once they join with the code.</Text>
        : members.map((member) => (
          <MemberRow key={member.athlete_id} member={member} busy={busy === member.athlete_id}
            onRemove={() => removeMember(member)} />
        ))}

      <View style={squadStyles.section}>
        <SquadProgram squadId={id} />
      </View>

      <View style={[squadStyles.section, { gap: 14 }]}>
        <Text style={styles.label}>Squad settings</Text>
        <Field label="Squad name" value={name} onChangeText={setName} error={errors.name} maxLength={60} />
        <Field label="Description, optional" value={description} onChangeText={setDescription}
          error={errors.description} hint="Your athletes see this on the squad's page."
          placeholder="e.g. Training times, where you meet, what the squad is working towards" multiline maxLength={500}
          style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }, errors.description && styles.inputError]} />
        <Button title="Delete squad" variant="danger" onPress={remove} busy={busy === 'delete'} />
      </View>
    </Screen>
  );
}

// The pill shows the athlete's own choice about sharing their training with
// coaches (#30); coaches only ever see totals for those who share
function MemberRow({ member, busy, onRemove }) {
  const joined = formatSessionDate(localDateString(new Date(member.joined_at)));
  return (
    <View style={squadStyles.memberRow}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={squadStyles.memberName}>{member.name}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Text style={styles.subtle}>Joined {joined}</Text>
          <Text style={[squadStyles.pill, member.sharing ? squadStyles.pillSharing : squadStyles.pillNotSharing]}>
            {member.sharing ? 'Sharing training' : 'Not sharing'}
          </Text>
        </View>
      </View>
      {busy ? <ActivityIndicator color="#dc2626" /> : (
        <Pressable
          onPress={onRemove}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${member.name}`}
          style={({ pressed }) => [squadStyles.textButton, pressed && { opacity: 0.6 }]}
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
  // Text buttons keep a 44pt touch target (Apple HIG)
  textButton: { minHeight: 44, minWidth: 44, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  resetCode: { color: '#475569', fontWeight: '600' },
  section: { marginTop: 12 },
  pill: { fontSize: 12, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' },
  pillSharing: { color: '#15803d', backgroundColor: '#dcfce7' },
  pillNotSharing: { color: '#64748b', backgroundColor: '#f1f5f9' },
};
