import { useEffect, useState, useCallback, useRef } from 'react';
import { db, seedLocalDatabase } from '../lib/db';
import api from '../lib/api';
import { getSyncStatus, subscribeToSync, notifySync } from '../lib/syncState';

export function useSync() {
  const [isSyncing, setIsSyncing] = useState(getSyncStatus());
  const [online, setOnline] = useState(navigator.onLine);
  const retryRef = useRef(null);

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

    let failedCount = 0;

    for (const task of queue) {
      try {
        if (task.type === 'member') {
          if (task.operation === 'CREATE') {
            await api.post('/members', task.payload);
          } else if (task.operation === 'UPDATE') {
            await api.put(`/members/${task.payload.id}`, task.payload);
          } else if (task.operation === 'DELETE') {
            const url = task.payload.permanent ? `/members/${task.payload.id}?permanent=true` : `/members/${task.payload.id}`;
            await api.delete(url);
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
            const url = task.payload.permanent ? `/staff/${task.payload.id}?permanent=true` : `/staff/${task.payload.id}`;
            await api.delete(url);
          }
        } else if (task.type === 'staff_payment') {
          if (task.operation === 'CREATE') {
            await api.post(`/staff/${task.payload.staff_id}/salary`, task.payload);
          } else if (task.operation === 'DELETE') {
            await api.delete(`/staff/${task.payload.staff_id}/salary/${task.payload.id}`);
          }
        } else if (task.type === 'attendance') {
          if (task.operation === 'CREATE' || task.operation === 'POST') {
            await api.post('/attendance', task.payload);
          }
        }
        
        // If success, remove from queue
        console.log(`[Sync] ✓ Synced ${task.type} (${task.operation}): ${task.payload.id || task.payload.name}`);
        await db.sync_queue.delete(task.id);
      } catch (err) {
        const status = err.response?.status;
        const msg = err.response?.data?.message || err.message || '';
        
        // Handle duplicate key / already-exists errors — treat as success
        if (status === 409 || status === 23505 || status === 404 ||
            msg.includes('duplicate') || 
            msg.includes('already exists') || 
            msg.includes('unique') ||
            msg.includes('conflict') ||
            msg.includes('foreign key')) {
          console.warn(`[Sync] Task ${task.id} (${task.type}/${task.operation}) hit conflict/duplicate. Dropping.`);
          await db.sync_queue.delete(task.id);
          continue;
        }

        // DON'T break — continue processing remaining tasks
        // This ensures one failed task doesn't block everything else
        console.error(`[Sync] ✗ Failed task ${task.id} (${task.type}/${task.operation}):`, err.message || err);
        failedCount++;
        continue; // ← KEY FIX: Don't break, process all remaining tasks
      }
    }

    // After processing, check remaining queue
    const remainingCount = await db.sync_queue.count();
    
    if (remainingCount === 0) {
      console.log('[Sync] All offline data synced successfully. Pulling fresh data...');
      // Wait for server-side consistency before re-seeding
      await new Promise(r => setTimeout(r, 2000));
      await seedLocalDatabase();
    } else {
      console.warn(`[Sync] ${remainingCount} tasks still pending. Will retry in 15 seconds.`);
    }

    notifySync(false);

    // Notify all pages that local DB has changed (triggers re-renders for non-reactive pages)
    window.dispatchEvent(new CustomEvent('local-db-changed'));
  }, [online]);

  // Trigger sync when going online
  useEffect(() => {
    if (online) {
      processQueue();
    }
  }, [online, processQueue]);

  // Trigger sync IMMEDIATELY when a new task is queued (e.g. member added while online)
  useEffect(() => {
    let debounceTimer = null;

    const handleQueueUpdate = () => {
      if (!online) return;
      // Small debounce to batch rapid additions (e.g. member + payment in quick succession)
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        processQueue();
      }, 500);
    };

    window.addEventListener('sync-queue-updated', handleQueueUpdate);
    return () => {
      window.removeEventListener('sync-queue-updated', handleQueueUpdate);
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [online, processQueue]);

  // RETRY MECHANISM: Periodically check for stuck queue items while online
  useEffect(() => {
    if (!online) {
      if (retryRef.current) clearInterval(retryRef.current);
      return;
    }

    retryRef.current = setInterval(async () => {
      try {
        const count = await db.sync_queue.count();
        if (count > 0 && !getSyncStatus()) {
          console.log(`[Sync] Retry: Found ${count} pending tasks, retrying...`);
          processQueue();
        }
      } catch (e) {
        // silently ignore
      }
    }, 15000); // Retry every 15 seconds

    return () => {
      if (retryRef.current) clearInterval(retryRef.current);
    };
  }, [online, processQueue]);

  return { online, isSyncing, forceSync: processQueue };
}
