// Artık Supabase yok — yerel saat kullanılıyor
export function serverNow() {
  return Date.now();
}

export function serverISOString() {
  return new Date().toISOString();
}

export async function calculateServerOffset() {
  // No-op: local storage, no server sync needed
}
