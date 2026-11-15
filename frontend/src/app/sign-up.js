import { useRef, useState } from 'react';
import { AccessibilityInfo, Alert, Platform, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { supabase } from '../lib/supabase';
import { logError } from '../lib/log';
import { rememberAccountUsed } from '../lib/auth';
import {
  dobFromParts, isUnderAge, validateDobParts, validateEmail, validateName, validatePassword,
} from '../lib/validation';
import { Button, Checkbox, DobField, Field, Message, PasswordField, Screen, styles } from '../components/Form';
import { ChipGroup } from '../components/ChipGroup';

const EMAIL_REDIRECT = `${process.env.EXPO_PUBLIC_WEB_URL}/open-app.html`;

const ROLE_OPTIONS = [
  { value: 'athlete', label: 'Athlete' },
  { value: 'coach', label: 'Coach' },
];

// One line under the role choice saying what each account is for
const ROLE_DESCRIPTIONS = {
  athlete: 'Log your training and join your coach\'s squad.',
  coach: 'Set up squads and plan training. Coaches must be 18 or over.',
};

const SAFEGUARDING_STATEMENT =
  "I'll follow my club or organisation's safeguarding and child protection policies, "
  + 'including when coaching under-18s.';

const EMPTY_DOB = { day: '', month: '', year: '' };

// Each field's check, so a field can be checked on its own when it loses
// focus, and again as it's typed in once it's showing an error
const VALIDATORS = {
  name: (form) => validateName(form.name),
  dob: (form) => validateDobParts(form.dob, form.role === 'coach' ? 18 : 0),
  email: (form) => validateEmail(form.email),
  password: (form) => validatePassword(form.password),
  safeguarding: (form) => (form.role === 'coach' && !form.safeguardingAgreed
    ? 'Confirm you\'ll follow safeguarding policies to sign up as a coach' : null),
};

// Fields in screen order, for focusing the first one with an error
const FIELD_ORDER = ['name', 'dob', 'email', 'password'];

export default function SignUp() {
  const [form, setForm] = useState({
    role: 'athlete', name: '', dob: EMPTY_DOB, email: '', password: '', safeguardingAgreed: false,
  });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState({ text: '', kind: 'error' });
  const [busy, setBusy] = useState(false);
  // Set once the confirmation email has been sent
  const [sentTo, setSentTo] = useState(null);
  const refs = { name: useRef(null), dob: useRef(null), email: useRef(null), password: useRef(null) };

  const coach = form.role === 'coach';

  // Fields showing an error are checked again as they change, so the error
  // goes as soon as it's fixed. The role changes the date of birth rule.
  function update(key, value) {
    const next = { ...form, [key]: value };
    setForm(next);
    const recheck = key === 'role' ? ['dob', 'safeguarding'] : key === 'safeguardingAgreed' ? ['safeguarding'] : [key];
    setErrors((e) => {
      const updated = { ...e };
      for (const field of recheck) if (e[field]) updated[field] = VALIDATORS[field](next);
      return updated;
    });
  }

  // Checks a field when the user moves on from it, unless it's still empty
  function checkOnLeave(key) {
    const empty = key === 'dob' ? !form.dob.day && !form.dob.month && !form.dob.year : !form[key];
    if (empty) return;
    setErrors((e) => ({ ...e, [key]: VALIDATORS[key](form) }));
  }

  const dobValid = !validateDobParts(form.dob);
  const under16 = !coach && dobValid && isUnderAge(dobFromParts(form.dob), 16);

  async function signUp() {
    const newErrors = Object.fromEntries(Object.entries(VALIDATORS).map(([key, check]) => [key, check(form)]));
    setErrors(newErrors);
    if (Object.values(newErrors).some(Boolean)) {
      // Errors can be scrolled out of view, so go to the first one
      refs[FIELD_ORDER.find((key) => newErrors[key])]?.current?.focus();
      const text = 'Check the highlighted details';
      if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(text);
      return setMessage({ text, kind: 'error' });
    }

    const dob = dobFromParts(form.dob);
    setBusy(true);
    setMessage({ text: '' });
    // These go in user metadata; a database trigger copies them into profiles.
    // The trigger also re-checks the coach rules (18+, safeguarding agreed).
    const { data, error } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        data: coach
          ? { role: 'coach', name: form.name.trim(), dob, safeguarding_agreed: form.safeguardingAgreed }
          : { name: form.name.trim(), dob },
        // The link confirms the email, then a web page sends them back to the app
        emailRedirectTo: EMAIL_REDIRECT,
      },
    });
    setBusy(false);

    logError('signUp', error);
    // With email confirmation on, an email that's already registered comes
    // back with no identities instead of an error
    if (error?.code === 'user_already_exists' || (!error && data.user?.identities?.length === 0)) {
      return setMessage({ text: 'There\'s already an account with this email. Log in instead.', kind: 'error' });
    }
    if (error) return setMessage({ text: error.message, kind: 'error' });
    // They'll come back to log in after confirming, so stop opening on sign up
    rememberAccountUsed();
    // With email confirmation on, Supabase returns no session until the link is tapped
    if (!data.session) setSentTo(form.email.trim());
  }

  if (sentTo) return <CheckEmail email={sentTo} password={form.password} />;

  // Return moves to the next field; the last one submits
  const next = (key) => ({ returnKeyType: 'next', submitBehavior: 'submit', onSubmitEditing: () => refs[key].current?.focus() });

  return (
    <Screen footer={<>
      <Message text={message.text} kind={message.kind} />
      <Button title="Create account" onPress={signUp} busy={busy} />
    </>}>
      <View style={{ gap: 4 }}>
        <Text style={styles.heading} accessibilityRole="header">Create your account</Text>
        <Text style={styles.subtle}>It takes about a minute.</Text>
      </View>

      <View style={{ gap: 6 }}>
        <ChipGroup label="I'm signing up as" options={ROLE_OPTIONS} value={form.role} onChange={(v) => update('role', v)}
          layout="segmented" />
        <Text style={styles.subtle}>{ROLE_DESCRIPTIONS[form.role]}</Text>
      </View>

      <Field ref={refs.name} label="Full name" value={form.name} onChangeText={(v) => update('name', v)}
        error={errors.name} onBlur={() => checkOnLeave('name')} autoComplete="name" textContentType="name"
        autoCapitalize="words" autoCorrect={false} {...next('dob')} />

      <DobField ref={refs.dob} value={form.dob} onChange={(v) => update('dob', v)} error={errors.dob}
        hint="For example, 27 3 2010. We use this to check your age; it isn't shown to other athletes."
        onBlur={() => checkOnLeave('dob')} onSubmitEditing={() => refs.email.current?.focus()} />

      {under16 ? (
        <Text style={styles.info}>
          As you're under 16, a parent or guardian will need to approve your account before you can
          use Rowlytics. After you confirm your email, we'll ask for their email address.
        </Text>
      ) : null}

      <Field ref={refs.email} label="Email" value={form.email} onChangeText={(v) => update('email', v)}
        error={errors.email} onBlur={() => checkOnLeave('email')} placeholder="you@example.com"
        autoCapitalize="none" autoCorrect={false} spellCheck={false} autoComplete="email"
        keyboardType="email-address" textContentType="username" {...next('password')} />

      <PasswordField ref={refs.password} label="Password" hint="At least 6 characters" value={form.password}
        onChangeText={(v) => update('password', v)} error={errors.password} onBlur={() => checkOnLeave('password')}
        autoComplete="new-password" textContentType="newPassword" passwordRules="minlength: 6;"
        returnKeyType="go" onSubmitEditing={signUp} />

      {coach ? (
        <View style={{ gap: 6 }}>
          <Text style={styles.label}>Safeguarding</Text>
          <Checkbox label={SAFEGUARDING_STATEMENT} checked={form.safeguardingAgreed}
            onChange={(v) => update('safeguardingAgreed', v)} error={errors.safeguarding} />
        </View>
      ) : null}

      <Link href="/login" style={styles.link}>Already have an account? Log in</Link>
    </Screen>
  );
}

// Shown after sign up until the athlete has tapped the link in the email. They
// come back here and log in with the details they just typed.
function CheckEmail({ email, password }) {
  const [message, setMessage] = useState({ text: '', kind: 'error' });
  const [busy, setBusy] = useState(null);

  async function continueToApp() {
    setBusy('continue');
    setMessage({ text: '' });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(null);
    if (error?.code === 'email_not_confirmed') {
      return setMessage({ text: "Your email isn't confirmed yet. Tap the link in the email first.", kind: 'error' });
    }
    logError('signUp.continue', error);
    if (error) return setMessage({ text: error.message, kind: 'error' });
    // The root layout sees the new session and moves on to the app
    Alert.alert('Account verified', 'Welcome to Rowlytics!');
  }

  async function resend() {
    setBusy('resend');
    setMessage({ text: '' });
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: EMAIL_REDIRECT },
    });
    setBusy(null);
    logError('signUp.resend', error);
    if (error) return setMessage({ text: error.message, kind: 'error' });
    setMessage({ text: 'Email sent again.', kind: 'success' });
  }

  return (
    <Screen footer={<>
      <Message text={message.text} kind={message.kind} />
      <Button title="I've confirmed my email" onPress={continueToApp} busy={busy === 'continue'} />
      <Button title="Resend email" variant="secondary" onPress={resend} busy={busy === 'resend'} />
    </>}>
      <Text style={styles.heading}>Check your email</Text>
      <Text style={styles.subtle}>We've sent a link to {email}.</Text>
      <Text style={styles.subtle}>
        Tap the link to confirm your account, then come back here. It can take a few minutes,
        and may be in your spam folder.
      </Text>
    </Screen>
  );
}
