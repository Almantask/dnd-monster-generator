const PASSPHRASE_KEY = 'bestiary.passphrase'
const API_URL_KEY = 'bestiary.apiUrl'

export function getPassphrase(): string {
  return localStorage.getItem(PASSPHRASE_KEY) ?? ''
}

export function setPassphrase(value: string): void {
  localStorage.setItem(PASSPHRASE_KEY, value)
}

export function getApiUrl(): string {
  return localStorage.getItem(API_URL_KEY) ?? ''
}

export function setApiUrl(value: string): void {
  if (!value) localStorage.removeItem(API_URL_KEY)
  else localStorage.setItem(API_URL_KEY, value.replace(/\/$/, ''))
}
