// Returns an error message, or null if the value is valid

export function validateName(name) {
  const trimmed = name.trim();
  if (!trimmed) return 'Enter your name';
  if (trimmed.length > 100) return 'Name must be 100 characters or fewer';
  return null;
}

// Date of birth typed as YYYY-MM-DD (the format Postgres DATE expects).
// minAge is only used for coaches (18), matching check_coach_age in profiles.sql
export function validateDob(dob, minAge = 0) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return 'Enter date of birth as YYYY-MM-DD';
  const date = new Date(`${dob}T00:00:00Z`);
  // Catches impossible dates like 2005-02-30, which Date rolls over to March
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== dob) {
    return 'That date does not exist';
  }
  if (date > new Date()) return 'Date of birth cannot be in the future';
  if (date.getUTCFullYear() < 1900) return 'Check the year of birth';
  if (minAge && isUnderAge(dob, minAge)) return `Coaches must be ${minAge} or over`;
  return null;
}

// Day / Month / Year boxes (DobField) -> "YYYY-MM-DD", the format the
// database expects. Only meaningful once validateDobParts passes.
export function dobFromParts({ day, month, year }) {
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

// The sign-up date of birth, with GOV.UK-style messages. minAge is only used
// for coaches (18), matching check_coach_age in profiles.sql.
export function validateDobParts(parts, minAge = 0) {
  const { day, month, year } = parts;
  if (!day && !month && !year) return 'Enter your date of birth';
  if (!day) return 'Date of birth must include a day';
  if (!month) return 'Date of birth must include a month';
  if (!year) return 'Date of birth must include a year';
  if (year.length !== 4) return 'Enter the year as 4 numbers, for example 2010';
  const dob = dobFromParts(parts);
  const date = new Date(`${dob}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== dob) return 'Date of birth must be a real date';
  if (date > new Date()) return 'Date of birth must be in the past';
  if (Number(year) < 1900) return 'Check the year of birth';
  if (minAge && isUnderAge(dob, minAge)) return `You must be ${minAge} or over to sign up as a coach`;
  return null;
}

// True if someone born on dob (YYYY-MM-DD) is younger than age today
export function isUnderAge(dob, age) {
  // Dates as YYYY-MM-DD strings compare in date order
  const today = new Date();
  const cutoff = `${today.getFullYear() - age}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return dob > cutoff;
}

// Invite codes are 8 characters; spaces and dashes are ignored (join_squad in squads.sql)
export function validateSquadCode(code) {
  const cleaned = code.replace(/[^A-Za-z0-9]/g, '');
  if (!cleaned) return 'Enter the squad code';
  if (cleaned.length !== 8) return 'Squad codes are 8 characters';
  return null;
}

// Matches the squads.description column (squads.sql); it's optional
export function validateSquadDescription(description) {
  if (description.length > 500) return 'Description must be 500 characters or fewer';
  return null;
}

// Matches the squads.name column (squads.sql)
export function validateSquadName(name) {
  const trimmed = name.trim();
  if (!trimmed) return 'Enter a name for the squad';
  if (trimmed.length > 60) return 'Squad name must be 60 characters or fewer';
  return null;
}

export function validateEmail(email) {
  if (!/^\S+@\S+\.\S+$/.test(email.trim())) return 'Enter a valid email address';
  return null;
}

export function validatePassword(password) {
  if (password.length < 6) return 'Password must be at least 6 characters';
  return null;
}

// A YYYY-MM-DD session date that exists and isn't before 2000 (the
// session_date checks in training.sql and program.sql)
function validateSessionDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'Enter the date as YYYY-MM-DD';
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return 'That date does not exist';
  if (date < '2000-01-01') return 'Check the year';
  return null;
}

// A training session form. The ranges match the checks on completed_training
// (db/training.sql). Returns an error per field, or {} if it's all valid.
// today is the phone's local date (YYYY-MM-DD), so "no future dates" uses the
// athlete's calendar, not the server's.
export function validateSession(form, today) {
  const errors = {};

  const dateError = validateSessionDate(form.date);
  if (dateError) errors.date = dateError;
  else if (form.date > today) errors.date = 'Sessions cannot be in the future';

  if (!['erg', 'water', 'other'].includes(form.modality)) errors.modality = 'Choose a session type';

  const distance = form.distance.trim();
  if (!distance) {
    if (form.modality !== 'other') errors.distance = 'Enter the distance in metres';
  } else if (!/^\d+$/.test(distance)) {
    errors.distance = 'Distance must be a whole number of metres';
  } else if (Number(distance) < 1 || Number(distance) > 100000) {
    errors.distance = 'Distance must be between 1 and 100,000 m';
  }

  const minutes = form.minutes.trim();
  const seconds = form.seconds.trim();
  if ((minutes && !/^\d+$/.test(minutes)) || (seconds && !/^\d+$/.test(seconds))) {
    errors.duration = 'Use whole numbers for minutes and seconds';
  } else if (Number(seconds) > 59) {
    errors.duration = 'Seconds must be 0–59';
  } else {
    const total = Number(minutes) * 60 + Number(seconds);
    if (total < 1) errors.duration = 'Enter how long the session took';
    else if (total > 6 * 60 * 60) errors.duration = 'Sessions can be at most 6 hours';
  }

  if (!Number.isInteger(form.rpe) || form.rpe < 1 || form.rpe > 10) errors.rpe = 'Choose an RPE from 1 to 10';

  if (form.notes.length > 500) errors.notes = 'Notes must be 500 characters or fewer';

  return errors;
}

// A coach's planned session (planned_sessions in program.sql). Past dates are
// allowed so a coach can fill in this week's program late.
export function validatePlannedSession(form) {
  const errors = {};
  const dateError = validateSessionDate(form.date);
  if (dateError) errors.date = dateError;
  if (!['erg', 'water', 'other'].includes(form.modality)) errors.modality = 'Choose a session type';
  const title = form.title.trim();
  if (!title) errors.title = 'Enter a title, e.g. 3 x 2k';
  else if (title.length > 80) errors.title = 'Title must be 80 characters or fewer';
  if (form.details.length > 500) errors.details = 'Details must be 500 characters or fewer';
  return errors;
}
