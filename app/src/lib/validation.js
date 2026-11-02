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
