export function saveSession(data) {
  localStorage.setItem(
    "accessToken",
    data.accessToken
  );

  localStorage.setItem(
    "user",
    JSON.stringify(data.user)
  );
}


export function clearSession() {
  localStorage.removeItem(
    "accessToken"
  );

  localStorage.removeItem(
    "user"
  );
}


export function getCurrentUser() {
  try {
    return JSON.parse(
      localStorage.getItem("user") ||
      "null"
    );
  } catch {
    return null;
  }
}


export function isAuthenticated() {
  return Boolean(
    localStorage.getItem("accessToken")
  );
}
