# Rowlytics

Rowlytics FYP: a training log for rowers. Athletes record erg and water sessions. Under-16s need a parent's consent before they can use the app.

## Layout

- `frontend/` – the Expo app (iOS, Android and the web pages on rowlytics.expo.app). Run commands from here, e.g. `npx expo start`.
- `backend/` – Supabase SQL (run in the Supabase SQL Editor) and the auth email templates.

## Setup

### What you need

- [Node.js](https://nodejs.org) (LTS) and npm
- A [Supabase](https://supabase.com) project
- The **Expo Go** app on your phone (App Store / Play Store)
- An [Expo](https://expo.dev) account. To publish updates, it must be a member of the `adampmhyuccs-team` organisation.

### 1. Install the app

```bash
git clone https://github.com/AdampmhyUCC/Rowlytics.git
cd Rowlytics/frontend
npm install
```

Add packages with `npx expo install <package>`, not `npm install`. It picks versions that match the Expo SDK.

### 2. Environment variables

```bash
cp .env.example .env
```

Fill in `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` from **Project Settings → API** in Supabase. Leave `EXPO_PUBLIC_WEB_URL` as `http://localhost:8081` for development. `.env` is gitignored, so never commit it.

### 3. Database (Supabase)

Run these files from `backend/` in the Supabase **SQL Editor**, in this order:

1. `schema.sql` – **only on a fresh development database.** It drops and recreates the tables, so it deletes all data. Never run it on the pilot database.
2. `profiles.sql` – user profiles and roles (story #4)
3. `consent.sql` – parental consent for under-16s (story #5)
4. `training.sql` – training log (story #6)

`profiles.sql`, `consent.sql` and `training.sql` are safe to re-run.

### 4. Auth settings (Supabase dashboard)

- **Authentication → Sign In / Providers → Email:** turn on **Confirm email**. Parental consent depends on it.
- **Authentication → Emails → SMTP Settings:** add a custom SMTP sender (we use Brevo). The built-in sender only allows a few emails an hour.
- **Authentication → Emails → Templates:** paste in `backend/email-templates/confirm-signup.html` (Confirm signup) and `magic-link.html` (Magic Link). Each file's header comment gives the suggested subject.
- **Authentication → URL Configuration:**
  - Site URL: `https://rowlytics.expo.app`
  - Redirect URLs: `https://rowlytics.expo.app/**` and `http://localhost:8081/**`
- **Authentication → Rate Limits:** raise the email limit before a test session with lots of sign-ups.

### 5. Run it

```bash
cd frontend
npx expo start
```

- **Phone:** scan the QR code (Camera app on iPhone, Expo Go on Android). The phone and computer must be on the same network.
- **Web:** press `w`. The parent consent page is at http://localhost:8081/parent-consent.

Useful checks: `npx expo-doctor` (dependency and config problems).

## Publishing for testers

Testers run the app in Expo Go from an **EAS Update**, so they don't need your computer or the dev server.

Run everything from `frontend/`. Log in once with `npx eas-cli@latest login`.

**Publish an app update** (testers get it the next time they fully close and reopen Expo Go):

```bash
npx eas-cli@latest update --channel preview --environment preview --message "What changed"
```

`eas update` reads `EXPO_PUBLIC_*` values from the EAS `preview` environment, **not** your local `.env`. Change them with `npx eas-cli@latest env:list` / `env:create --force`.

**Deploy the web pages** (parent consent, password reset, email confirmation) to https://rowlytics.expo.app:

```bash
rm -rf dist
EXPO_PUBLIC_WEB_URL=https://rowlytics.expo.app npx expo export --platform web
npx eas-cli@latest deploy --prod
```

Always re-export first. `eas deploy` uploads whatever is in `dist/`, and a plain export uses `localhost` from `.env`.

### Adding a tester

1. On expo.dev, go to **adampmhyuccs-team → Settings → Members** and invite them as a **Viewer**.
2. They create a free Expo account, accept the invite email, and sign in to Expo Go with that account.
3. They open the app with this link or its QR code:
   `exp://u.expo.dev/ef2ac5c0-4cf0-4b82-a139-434b048eb7a0?channel-name=preview&runtime-version=exposdk%3A58.0.0`
4. In Rowlytics they tap **Sign up**, then confirm their email.

## Troubleshooting

- **Expo Go shows "HTTP response error 403 … requires authentication":** the person isn't signed in to Expo Go as a member of `adampmhyuccs-team`, or hasn't accepted the invite yet. Sign out of Expo Go and back in after accepting.
- **No email arrives:** emails can take a few minutes and often land in spam. In Gmail, move the email to the inbox before tapping its link. Forgot password sends nothing if the email has no account. Supabase also waits about a minute before sending another email to the same address.
- **Email link opens `localhost` and won't load:** the Supabase Site URL or Redirect URLs aren't set (step 4), or the email was sent before they were.
- **Testers still see an old version:** fully close Expo Go (swipe it away) and reopen it, sometimes twice. The first launch downloads the update and the next one runs it.
