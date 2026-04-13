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

    // Only clear + reseed tables whose fetch SUCCEEDED
    // SAFETY: If server returned 0 records but we have local data, use bulkPut (merge)
    // instead of clearing, to prevent data loss from server lag after sync.

    if (membersData !== null) {
      console.log(`[DB] Sync: Fetched ${membersData.length} members from server.`);
      const localMemberCount = await db.members.count();
      if (membersData.length === 0 && localMemberCount > 0) {
        console.warn(`[DB] Server returned 0 members but ${localMemberCount} exist locally. Keeping local data.`);
      } else if (membersData.length > 0) {
        await db.members.clear();
        await db.members.bulkPut(membersData.map(m => ({ ...m, last_sync: now })));
        console.log(`[DB] Seeded ${membersData.length} members.`);
      }
    }

    if (paymentsData !== null) {
      console.log(`[DB] Sync: Fetched ${paymentsData.length} payments from server.`);
      const localPaymentCount = await db.payments.count();
      if (paymentsData.length === 0 && localPaymentCount > 0) {
        console.warn(`[DB] Server returned 0 payments but ${localPaymentCount} exist locally. Keeping local data.`);
      } else if (paymentsData.length > 0) {
        await db.payments.clear();
        await db.payments.bulkPut(paymentsData.map(p => ({ ...p, last_sync: now })));
        console.log(`[DB] Seeded ${paymentsData.length} payments.`);
      }
    }

    if (expensesData !== null) {
      console.log(`[DB] Sync: Fetched ${expensesData.length} expenses from server.`);
      const localExpenseCount = await db.expenses.count();
      if (expensesData.length === 0 && localExpenseCount > 0) {
        console.warn(`[DB] Server returned 0 expenses but ${localExpenseCount} exist locally. Keeping local data.`);
      } else if (expensesData.length > 0) {
        await db.expenses.clear();
        await db.expenses.bulkPut(expensesData.map(e => ({ ...e, last_sync: now })));
        console.log(`[DB] Seeded ${expensesData.length} expenses.`);
      }
    }

    if (staffData !== null) {
      const localStaffCount = await db.staff.count();
      if (staffData.length === 0 && localStaffCount > 0) {
        console.warn(`[DB] Server returned 0 staff. Keeping local data.`);
      } else if (staffData.length > 0) {
        await db.staff.clear();
        await db.staff_payments.clear();
        
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
        console.log(`[DB] Seeded ${staffList.length} staff and ${allPayments.length} salaries.`);
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
 * Add an operation to the sync queue
 */
export async function queueSyncTask(type, operation, payload) {
  await db.sync_queue.add({
    type,
    operation,
    payload,
    timestamp: new Date().toISOString()
  });
}
