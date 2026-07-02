// Holds the admin password in-memory (per browser tab) after successful login
// on the /priser page. It is sent to server functions that perform admin
// mutations, where it is verified against PRISER_ADMIN_PASSWORD.
let adminPassword: string | null = null;

export function setAdminPassword(pw: string) {
  adminPassword = pw;
}

export function clearAdminPassword() {
  adminPassword = null;
}

export function getAdminPassword(): string {
  if (!adminPassword) throw new Error("Admin session missing — logga in igen");
  return adminPassword;
}