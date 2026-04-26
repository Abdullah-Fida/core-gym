import Dexie from 'dexie';
import api from './api';
import { notifySync } from './syncState';

export const db = new Dexie('CoreGymOfflineDB');

export async function clearLocalDatabase() {
  try {
    await db.members.clear();
    await db.payments.clear();
    await db.expenses.clear();
    await db.sync_queue.clear();
    await db.staff.clear();
    await db.staff_payments.clear();
    await db.attendance.clear();
  } catch (err) {
    console.error('Failed to clear local DB:', err);
  }
}

// Define database schema
db.version(5).stores({
  members: 'id, name, phone, status, fingerprint_id, last_sync',
  payments: 'id, member_id, amount, status, last_sync',
  expenses: 'id, category, amount, expense_date, last_sync',
  staff: 'id, name, status, role, last_sync',
  staff_payments: 'id, staff_id, month, year, amount_paid, paid_date, last_sync',
  attendance: 'id, member_id, timestamp, status, last_sync',
  sync_queue: '++id, type, operation, payload, timestamp'
});

/**
 * Seed the local database with the last 6 months of data.
 * This is called on login or initial app load.
 * 
 * SAFETY: Each table is only cleared+re-seeded if its fetch succeeded.
 * A failed fetch will NOT wipe local data for that table.
 */
export async function seedLocalDatabase() {
  try {
    notifySync(true);
    const queueCount = await db.sync_queue.count();
    if (queueCount > 0) {
      console.log('[DB] Pending syncs exist, skipping local DB overwrite to protect offline data.');
      return;
    }

    console.log('[DB] Seeding local database...');
    const now = new Date().toISOString();

    // Fetch each table independently — a failure in one does NOT affect others
    let membersData = null;
    let paymentsData = null;
    let expensesData = null;
    let staffData = null;
    let attendanceData = null;

    try {
      const res = await api.get('/members', { params: { limit: 10000 } });
      membersData = res.data.data || [];
    } catch (e) {
      console.warn('[DB] Failed to fetch members from server. Local members preserved.', e.message);
    }

    try {
      const res = await api.get('/payments', { params: { limit: 10000 } });
      paymentsData = res.data.data || [];
    } catch (e) {
      console.warn('[DB] Failed to fetch payments from server. Local payments preserved.', e.message);
    }

    try {
      const res = await api.get('/expenses', { params: { limit: 10000 } });
      expensesData = (res.data && res.data.data) ? res.data.data : [];
    } catch (e) {
      console.warn('[DB] Failed to fetch expenses from server. Local expenses preserved.', e.message);
    }

    try {
      const res = await api.get('/staff', { params: { limit: 10000 } });
      staffData = res.data.data || [];
    } catch (e) {
      console.warn('[DB] Failed to fetch staff from server. Local staff preserved.', e.message);
    }

    try {
      const res = await api.get('/attendance', { params: { limit: 10000 } });
      attendanceData = res.data.data || [];
    } catch (e) {
      console.warn('[DB] Failed to fetch attendance from server. Local attendance preserved.', e.message);
    }

    // Only clear + reseed tables whose fetch SUCCEEDED
    // SAFETY: If server returned 0 records but we have local data, use bulkPut (merge)
    // instead of clearing, to prevent data loss from server lag after sync.

    if (membersData !== null) {
      console.log(`[DB] Sync: Fetched ${membersData.length} members from server.`);
      if (membersData.length > 0) {
        // SAFE MERGE: Use bulkPut (upsert) instead of clear + bulkPut
        // This ensures local-only records (not yet synced) are NOT wiped.
        await db.members.bulkPut(membersData.map(m => ({ ...m, last_sync: now })));
        console.log(`[DB] Merged ${membersData.length} members from server.`);
      }
    }

    if (paymentsData !== null) {
      console.log(`[DB] Sync: Fetched ${paymentsData.length} payments from server.`);
      if (paymentsData.length > 0) {
        await db.payments.bulkPut(paymentsData.map(p => ({ ...p, last_sync: now })));
        console.log(`[DB] Merged ${paymentsData.length} payments from server.`);
      }
    }

    if (expensesData !== null) {
      console.log(`[DB] Sync: Fetched ${expensesData.length} expenses from server.`);
      if (expensesData.length > 0) {
        await db.expenses.bulkPut(expensesData.map(e => ({ ...e, last_sync: now })));
        console.log(`[DB] Merged ${expensesData.length} expenses from server.`);
      }
    }

    if (staffData !== null) {
      if (staffData.length > 0) {
        const allPayments = [];
        const staffList = staffData.map(s => {
          if (s.staff_payments) {
            s.staff_payments.forEach(p => allPayments.push({ ...p, last_sync: now }));
          }
          const { staff_payments, ...staffObj } = s;
          return { ...staffObj, last_sync: now };
        });

        await db.staff.bulkPut(staffList);
        await db.staff_payments.bulkPut(allPayments);
        console.log(`[DB] Merged ${staffList.length} staff and ${allPayments.length} salaries.`);
      }
    }

    if (attendanceData !== null) {
      console.log(`[DB] Sync: Fetched ${attendanceData.length} attendance records from server.`);
      if (attendanceData.length > 0) {
        await db.attendance.bulkPut(attendanceData.map(a => ({ ...a, last_sync: now })));
        console.log(`[DB] Merged ${attendanceData.length} attendance records from server.`);
      }
    }

    console.log('[DB] Seeding complete.');
  } catch (err) {
    console.error('[DB] Seeding failed. Local data preserved.', err);
  } finally {
    notifySync(false);
  }
}

/**
 * Utility to clear old data (older than 6 months)
 */
export async function cleanupOldLocalData() {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const cutoff = sixMonthsAgo.toISOString();

  await db.payments
    .where('last_sync')
    .below(cutoff)
    .delete();
}

/**
 * Add an operation to the sync queue.
 * Dispatches 'sync-queue-updated' so useSync processes it immediately.
 */
export async function queueSyncTask(type, operation, payload) {
  await db.sync_queue.add({
    type,
    operation,
    payload,
    timestamp: new Date().toISOString()
  });
  // Signal useSync to process the queue immediately (don't wait for 15s retry)
  window.dispatchEvent(new CustomEvent('sync-queue-updated'));
}

/**
 * Flush the sync queue: process all pending tasks immediately.
 * Used before logout to ensure no data is lost.
 * Returns true if all tasks were synced, false if some failed.
 */
export async function flushSyncQueue() {
  const queue = await db.sync_queue.toArray();
  if (queue.length === 0) return true;

  console.log(`[DB] Flushing ${queue.length} pending sync tasks before logout...`);
  
  // Dynamic import to avoid circular dependency
  const { default: api } = await import('./api');
  
  let allSynced = true;

  for (const task of queue) {
    try {
      if (task.type === 'member') {
        if (task.operation === 'CREATE') await api.post('/members', task.payload);
        else if (task.operation === 'UPDATE') await api.put(`/members/${task.payload.id}`, task.payload);
        else if (task.operation === 'DELETE') await api.delete(`/members/${task.payload.id}`);
      } else if (task.type === 'payment') {
        if (task.operation === 'CREATE') await api.post('/payments', task.payload);
      } else if (task.type === 'expense') {
        if (task.operation === 'CREATE') await api.post('/expenses', task.payload);
        else if (task.operation === 'UPDATE') await api.put(`/expenses/${task.payload.id}`, task.payload);
        else if (task.operation === 'DELETE') await api.delete(`/expenses/${task.payload.id}`);
      } else if (task.type === 'staff') {
        if (task.operation === 'CREATE') await api.post('/staff', task.payload);
        else if (task.operation === 'UPDATE') await api.put(`/staff/${task.payload.id}`, task.payload);
        else if (task.operation === 'DELETE') await api.delete(`/staff/${task.payload.id}`);
      } else if (task.type === 'staff_payment') {
        if (task.operation === 'CREATE') await api.post(`/staff/${task.payload.staff_id}/salary`, task.payload);
        else if (task.operation === 'DELETE') await api.delete(`/staff/${task.payload.staff_id}/salary/${task.payload.id}`);
      } else if (task.type === 'attendance') {
        if (task.operation === 'CREATE' || task.operation === 'POST') await api.post('/attendance', task.payload);
      }

      await db.sync_queue.delete(task.id);
      console.log(`[DB] Flush ✓ ${task.type}/${task.operation}`);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || '';
      const status = err.response?.status;
      // Treat duplicates/conflicts as success
      if (status === 409 || status === 404 || msg.includes('duplicate') || msg.includes('already exists') || msg.includes('conflict')) {
        await db.sync_queue.delete(task.id);
        continue;
      }
      console.error(`[DB] Flush ✗ ${task.type}/${task.operation}:`, msg);
      allSynced = false;
    }
  }

  return allSynced;
}
