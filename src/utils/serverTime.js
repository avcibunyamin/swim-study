// Supabase: server timestamp için Date kullan

let serverOffset = 0; // ms cinsinden client-server farkı

export async function calculateServerOffset() {
  try {
    const t1 = Date.now();
    const { data, error } = await import('../supabase').then(m =>
      m.supabase.rpc('get_server_time')
    );
    const t2 = Date.now();
    if (!error && data) {
      const serverMs = new Date(data).getTime();
      const clientMidpoint = (t1 + t2) / 2;
      serverOffset = serverMs - clientMidpoint;
    }
  } catch (e) {
    console.debug('Server time sync failed, using local time:', e.message);
    serverOffset = 0;
  }
}

export function serverNow() {
  return Date.now() + serverOffset;
}

export function serverISOString() {
  return new Date(serverNow()).toISOString();
}
