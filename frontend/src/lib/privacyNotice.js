// The privacy notice athletes read before choosing whether to share their
// training with coaches. Raise PRIVACY_NOTICE_VERSION when the wording changes
// in a way athletes should see: everyone is shown it again on their next open.
// 2: coaches see squad members' names whether or not they share, and joining
// a squad doesn't need sharing (#33)
export const PRIVACY_NOTICE_VERSION = 2;

export const PRIVACY_NOTICE = [
  {
    heading: 'What Rowlytics keeps',
    body: 'Your account details (name, email and date of birth) and the training you log: '
      + 'the date, type, distance, time, RPE and any notes.',
  },
  {
    heading: 'Why',
    body: 'So you can keep track of your own training. If you choose to share, your coaches '
      + 'also use it to plan training and to support crew and selection decisions.',
  },
  {
    heading: 'What your coaches see',
    body: 'When you join a squad, its coach sees your name, when you joined and whether you share '
      + 'your training. Only if you share: the training you log, for the squads you join. '
      + 'Coaches can\'t see your password and can\'t change the sessions you log.',
  },
  {
    heading: 'It\'s your choice',
    body: 'Sharing is optional. If you don\'t share, you can still log your own training and join '
      + 'squads; coaches see your name but not your training. You can change your mind at any time in '
      + 'My profile → Privacy and data sharing. If you stop sharing, coaches can no longer see your training.',
  },
  {
    heading: 'Where it\'s stored',
    body: 'Your data is stored securely with Supabase, Rowlytics\' database provider. '
      + 'It is never sold or shared with anyone outside your club\'s coaches.',
  },
  {
    heading: 'Your rights',
    body: 'You can ask to see, correct or delete your data at any time by contacting the Rowlytics team.',
  },
];
