import { useEffect, useState, useCallback, useRef } from 'react';
import {
  subscribeToNotifications,
  sendNotification,
  markNotificationRead,
  clearNotification,
} from '@/lib/firestore';
import { useAuthStore } from '@/store/authStore'; // real auth, never sandboxed
import { useAuth } from '@/hooks/useAuth';        // display identity (may be sandboxed)
import type { ScoutNotification } from '@/types/scout';

export function useNotifications() {
  // Always use the REAL auth uid for Firestore operations.
  // useAuth() may return a sandboxed uid which wouldn't match request.auth.uid
  // in Firestore security rules, causing permission errors.
  const { user: realUser } = useAuthStore();
  const { user: displayUser } = useAuth(); // used only for displayName in send()

  const [notifications, setNotifications] = useState<ScoutNotification[]>([]);
  const unreadCount = notifications.filter((n) => !n.read).length;

  // Track IDs we've already seen so we only browser-notify on genuinely new arrivals.
  const seenIds = useRef(new Set<string>());
  const initialLoad = useRef(true);

  useEffect(() => {
    if (!realUser) return;
    seenIds.current.clear();
    initialLoad.current = true;

    return subscribeToNotifications(realUser.uid, (incoming) => {
      if (!initialLoad.current) {
        for (const n of incoming) {
          if (n.id && !seenIds.current.has(n.id)) {
            showBrowserNotification('NutScout', n.message, n.id);
          }
        }
      }
      initialLoad.current = false;
      seenIds.current = new Set(incoming.map((n) => n.id ?? ''));
      setNotifications(incoming);
    });
  }, [realUser]);

  const markRead = useCallback(async (id: string) => {
    if (!realUser) return;
    await markNotificationRead(realUser.uid, id);
  }, [realUser]);

  const clear = useCallback(async (id: string) => {
    if (!realUser) return;
    await clearNotification(realUser.uid, id);
  }, [realUser]);

  const send = useCallback(async (
    toUid: string,
    message: string,
    meta?: { matchNumber?: number; teamNumber?: number }
  ) => {
    if (!realUser) return;
    await sendNotification(toUid, {
      fromUid: realUser.uid,
      fromName: displayUser?.displayName ?? realUser.displayName,
      message,
      ...meta,
    });
  }, [realUser, displayUser]);

  return { notifications, unreadCount, markRead, clear, send };
}

/** Request browser notification permission and show a notification */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function showBrowserNotification(title: string, body: string, tag?: string) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  new Notification(title, { body, tag, icon: '/NutScout/favicon.svg' });
}
