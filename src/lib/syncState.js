// Independent state to prevent circular dependencies
let globalSyncInProgress = false;
let syncListeners = new Set();

export function notifySync(status) {
  globalSyncInProgress = status;
  syncListeners.forEach(listener => listener(status));
}

export function getSyncStatus() {
  return globalSyncInProgress;
}

export function subscribeToSync(listener) {
  syncListeners.add(listener);
  return () => syncListeners.delete(listener);
}
