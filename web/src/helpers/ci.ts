export function mapOracleUniqueToFriendly(err: any) {
  const msg = String(err?.message || "");
  if (msg.includes("UQ_USERS_USERNAME_CI")) {
    return "This username is already taken. Please choose a different one.";
  }
  if (msg.includes("UQ_USERS_EMAIL_CI")) {
    return "This email is already registered. Please use a different email.";
  }
  if (String(err?.code) === "ORA-00001" || err?.errorNum === 1) {
    return "This value is already in use. Please try something else.";
  }
  return "Server error. Please try again.";
}