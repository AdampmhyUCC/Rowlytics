// Returns an error message, or null if the value is valid

export function validateName(name) {
  const trimmed = name.trim();
  if (!trimmed) return 'Enter your name';
  if (trimmed.length > 100) return 'Name must be 100 characters or fewer';
  return null;
}

// Date of birth typed as YYYY-MM-DD (the format Postgres DATE expects)
export function validateDob(dob) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return 'Enter date of birth as YYYY-MM-DD';
  const date = new Date(`${dob}T00:00:00Z`);
  // Catches impossible dates like 2005-02-30, which Date rolls over to March
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== dob) {
    return 'That date does not exist';
  }
  if (date > new Date()) return 'Date of birth cannot be in the future';
  if (date.getUTCFullYear() < 1900) return 'Check the year of birth';
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

// A training session form. The ranges match the checks on completed_training
// (db/training.sql). Returns an error per field, or {} if it's all valid.
// today is the phone's local date (YYYY-MM-DD), so "no future dates" uses the
// athlete's calendar, not the server's.
export function validateSession(form, today) {
  const errors = {};

  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) {
    errors.date = 'Enter the date as YYYY-MM-DD';
  } else {
    const date = new Date(`${form.date}T00:00:00Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== form.date) {
      errors.date = 'That date does not exist';
    } else if (form.date > today) {
      errors.date = 'Sessions cannot be in the future';
    } else if (form.date < '2000-01-01') {
      errors.date = 'Check the year';
    }
  }

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
