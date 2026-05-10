import { useEffect, useState, useCallback } from 'react';
import {
  subscribeToNotifications,
  sendNotification,
  markNotificationRead,
  clearNotification,
} from '@/lib/firestore';
import { useAuth } from '@/hooks/useAuth';
import type { ScoutNotification } from '@/types/scout';

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<ScoutNotification[]>([]);
  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (!user) return;
    return subscribeToNotifications(user.uid, setNotifications);
  }, [user]);

  const markRead = useCallback(async (id: string) => {
    if (!user) return;
    await markNotificationRead(user.uid, id);
  }, [user]);

  const clear = useCallback(async (id: string) => {
    if (!user) return;
    await clearNotification(user.uid, id);
  }, [user]);

  const send = useCallback(async (
    toUid: string,
    message: string,
    meta?: { matchNumber?: number; teamNumber?: number }
  ) => {
    if (!user) return;
    await sendNotification(toUid, {
      fromUid: user.uid,
      fromName: user.displayName,
      message,
      ...meta,
    });
  }, [user]);

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
  if (Notification.permission !== 'granted') return;
  new Notification(title, { body, tag, icon: '/NutScout/favicon.svg' });
}
