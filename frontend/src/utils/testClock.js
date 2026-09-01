const STORAGE_KEY = "app_fake_now";

export function setFakeNow(dateString) {
  if (!dateString) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, dateString);
  }
}

export function isFakeNowActive() {
  return localStorage.getItem(STORAGE_KEY) !== null;
}

export function clearFakeNow() {
  localStorage.removeItem(STORAGE_KEY);
}