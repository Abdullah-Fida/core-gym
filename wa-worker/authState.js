const { proto, initAuthCreds, BufferJSON } = require('@whiskeysockets/baileys');

/**
 * Baileys `AuthenticationState` backed by the existing `whatsapp_auth` table.
 *
 * Baileys ships `useMultiFileAuthState`, which writes to local disk. That does
 * not survive a container restart on Railway/Render/Fly, so every redeploy
 * would force every gym to re-scan a QR code. Credentials live in Postgres
 * instead, keyed by (gym_id, key).
 *
 * BufferJSON is required: the credential blobs contain Buffers and typed
 * arrays that plain JSON.stringify silently mangles into `{}`, producing a
 * session that appears to save and then fails to restore.
 */

const CREDS_KEY = 'creds';

async function useSupabaseAuthState(supabase, gymId) {
  const read = async (key) => {
    const { data, error } = await supabase
      .from('whatsapp_auth')
      .select('data')
      .eq('gym_id', gymId)
      .eq('key', key)
      .maybeSingle();

    if (error || !data?.data) return null;
    try {
      return JSON.parse(JSON.stringify(data.data), BufferJSON.reviver);
    } catch {
      return null;
    }
  };

  const write = async (key, value) => {
    const serialised = JSON.parse(JSON.stringify(value, BufferJSON.replacer));
    const { error } = await supabase
      .from('whatsapp_auth')
      .upsert(
        { gym_id: gymId, key, data: serialised, updated_at: new Date().toISOString() },
        { onConflict: 'gym_id,key' }
      );
    if (error) throw new Error(`Could not persist auth key "${key}": ${error.message}`);
  };

  const remove = async (key) => {
    await supabase.from('whatsapp_auth').delete().eq('gym_id', gymId).eq('key', key);
  };

  const creds = (await read(CREDS_KEY)) || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const result = {};
          await Promise.all(
            ids.map(async (id) => {
              let value = await read(`${type}-${id}`);
              // app-state-sync-key blobs must be rehydrated into their protobuf
              // type or Baileys cannot decrypt history sync.
              if (type === 'app-state-sync-key' && value) {
                value = proto.Message.AppStateSyncKeyData.fromObject(value);
              }
              if (value) result[id] = value;
            })
          );
          return result;
        },
        set: async (data) => {
          const jobs = [];
          for (const type of Object.keys(data)) {
            for (const id of Object.keys(data[type])) {
              const value = data[type][id];
              const key = `${type}-${id}`;
              jobs.push(value ? write(key, value) : remove(key));
            }
          }
          await Promise.all(jobs);
        },
      },
    },
    saveCreds: () => write(CREDS_KEY, creds),
    /** Wipe every stored key for this gym — used on logout. */
    clearAll: async () => {
      await supabase.from('whatsapp_auth').delete().eq('gym_id', gymId);
    },
  };
}

module.exports = { useSupabaseAuthState };
