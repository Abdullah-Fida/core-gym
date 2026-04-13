import { useEffect, useState, useCallback } from 'react';
import { db, seedLocalDatabase } from '../lib/db';
import api from '../lib/api';
import { getSyncStatus, subscribeToSync, notifySync } from '../lib/syncState';

export function useSync() {
  const [isSyncing, setIsSyncing] = useState(getSyncStatus());
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    return subscribeToSync(setIsSyncing);
  }, []);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const processQueue = useCallback(async () => {
    if (!online || getSyncStatus()) return;

    const queue = await db.sync_queue.toArray();
    if (queue.length === 0) return;

    notifySync(true);
    console.log(`[Sync] Processing ${queue.length} tasks...`);

    let anyFailed = false;

    for (const task of queue) {
      try {
        if (task.type === 'member') {
          if (task.operation === 'CREATE') {
            await api.post('/members', task.payload);
          } else if (task.operation === 'UPDATE') {
            await api.put(`/members/${task.payload.id}`, task.payload);
          } else if (task.operation === 'DELETE') {
            await api.delete(`/members/${task.payload.id}`);
          }
        } else if (task.type === 'payment') {
          if (task.operation === 'CREATE') {
            await api.post('/payments', task.payload);
          }
        } else if (task.type === 'expense') {
          if (task.operation === 'CREATE') {
            await api.post('/expenses', task.payload);
          } else if (task.operation === 'UPDATE') {
            await api.put(`/expenses/${task.payload.id}`, task.payload);
          } else if (task.operation === 'DELETE') {
            await api.delete(`/expenses/${task.payload.id}`);
          }
        } else if (task.type === 'staff') {
          if (task.operation === 'CREATE') {
            await api.post('/staff', task.payload);
          } else if (task.operation === 'UPDATE') {
            await api.put(`/staff/${task.payload.id}`, task.payload);
          } else if (task.operation === 'DELETE') {
            await api.delete(`/staff/${task.payload.id}`);
          }
        } else if (task.type === 'staff_payment') {
          if (task.operation === 'CREATE') {
            await api.post(`/staff/${task.payload.staff_id}/salary`, task.payload);
          } else if (task.operation === 'DELETE') {
            await api.delete(`/staff/${task.payload.staff_id}/salary/${task.payload.id}`);
          }
        }
        
        // If success, remove from queue
        console.log(`[Sync] Successfully synced ${task.type} (${task.operation}): ${task.payload.id || task.payload.name}`);
        await db.sync_queue.delete(task.id);
      } catch (err) {
        const status = err.response?.status;
        const msg = err.response?.data?.message || err.message || '';
        
        // Handle duplicate key / already-exists errors — treat as success
        // This happens when a previously-synced item is re-synced (e.g. after retry)
        if (status === 409 || status === 23505 || status === 404 ||
            msg.includes('duplicate') || 
            msg.includes('already exists') || 
            msg.includes('unique') ||
            msg.includes('conflict') ||
            msg.includes('foreign key')) {
          console.warn(`[Sync] Task ${task.id} (${task.type}/${task.operation}) hit 404 or conflict cache. Dropping to prevent jam.`);
          await db.sync_queue.delete(task.id);
          continue;
        }

        console.error(`[Sync] Failed task ${task.id}:`, err);
        anyFailed = true;
        break; 
      }
    }

    if (!anyFailed) {
      console.log('[Sync] All offline data synced. Waiting before fresh pull...');
      // Wait for server-side consistency before re-seeding
      await new Promise(r => setTimeout(r, 2000));
      await seedLocalDatabase();
    }

    notifySync(false);
  }, [online]);

  useEffect(() => {
    if (online) {
      processQueue();
    }
  }, [online, processQueue]);

  return { online, isSyncing, forceSync: processQueue };
}
