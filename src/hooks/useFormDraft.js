import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../lib/api';

/**
 * useFormDraft Hook
 * @param {string} pageId - Unique identifier for the page/form
 * @param {object} defaultState - Initial state if no draft exists
 * @param {function} setFormState - Function to update the form state (optional)
 * @returns {object} { loadingDraft, clearDraft, saveDraft }
 */
export function useFormDraft(pageId, defaultState, setFormState) {
  const [loadingDraft, setLoadingDraft] = useState(true);
  const saveTimeoutRef = useRef(null);
  const currentDataRef = useRef(null);
  const isLoadedRef = useRef(false);
  const isRestoringRef = useRef(false);

  // Load draft (LocalStorage first for speed, then Backend for sync)
  useEffect(() => {
    const fetchDraft = async () => {
      try {
        isRestoringRef.current = true;
        
        // 1. Try LocalStorage for immediate recovery
        const local = localStorage.getItem(`draft_${pageId}`);
        if (local) {
          const parsed = JSON.parse(local);
          setFormState(parsed);
          console.log(`[Draft] Recovered from LocalStorage: ${pageId}`);
        }

        // 2. Sync from Backend to ensure cross-device consistency
        const res = await api.get(`/drafts/${pageId}`);
        if (res.data.success && res.data.data) {
          setFormState(res.data.data);
          console.log(`[Draft] Synced from Backend: ${pageId}`);
        }
      } catch (err) {
        console.error(`[Draft] Error loading for ${pageId}`, err);
      } finally {
        isRestoringRef.current = false;
        isLoadedRef.current = true;
        setLoadingDraft(false);
      }
    };
    fetchDraft();
  }, [pageId]);

  // Handle saving
  const saveDraft = useCallback((formData) => {
    currentDataRef.current = formData;
    if (!isLoadedRef.current || isRestoringRef.current) return;

    // Fast local save
    localStorage.setItem(`draft_${pageId}`, JSON.stringify(formData));

    // Debounced backend save
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await api.post('/drafts', { pageId, formData });
      } catch (err) {
        console.error(`[Draft] Failed backend save: ${pageId}`, err);
      }
    }, 1000);
  }, [pageId]);

  // Save on UNMOUNT (Critical!)
  useEffect(() => {
    return () => {
      if (currentDataRef.current && isLoadedRef.current) {
        // Sync one last time to LocalStorage
        localStorage.setItem(`draft_${pageId}`, JSON.stringify(currentDataRef.current));
        // We can't easily wait for a fetch here reliably on unmount without navigator.sendBeacon
        // which isn't easy with JSON/Auth headers. But LocalStorage will catch it for next load.
      }
    };
  }, [pageId]);

  const clearDraft = useCallback(async () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    currentDataRef.current = null;
    localStorage.removeItem(`draft_${pageId}`);
    try {
      await api.delete(`/drafts/${pageId}`);
    } catch (err) {
      console.error(`[Draft] Failed to clear: ${pageId}`, err);
    }
  }, [pageId]);

  return { loadingDraft, clearDraft, saveDraft };
}
