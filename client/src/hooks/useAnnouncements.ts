import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Announcement } from '../db';
import { useAuth } from './useAuth';

export function useAnnouncements() {
  const { user, isAdmin, isSuperAdmin } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      setError(null);
      return;
    }

    // Determine user role
    const userRole = isSuperAdmin ? 'superadmin' : isAdmin ? 'admin' : 'student';
    setError(null);
    setLoading(true);

    // Query active and approved announcements visible to this user
    const q = query(
      collection(db, 'announcements'),
      where('active', '==', true),
      where('status', '==', 'approved'),
      where('visibleTo', 'array-contains', userRole)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const now = new Date();
        const filtered = snapshot.docs
          .map((doc) => ({
            announcementID: doc.id,
            ...doc.data(),
          } as Announcement))
          .filter((announcement) => {
            // Filter by date range if specified
            if (announcement.startDate) {
              const start = new Date(announcement.startDate);
              if (now < start) return false;
            }
            if (announcement.endDate) {
              const end = new Date(announcement.endDate);
              if (now > end) return false;
            }
            return true;
          });

        setAnnouncements(filtered);
        setLoading(false);
      },
      (err) => {
        console.error('Announcements snapshot error', err);
        setAnnouncements([]);
        setLoading(false);
        setError(err?.message || 'Failed to load announcements.');
        // Prevent repeated watch retries from triggering Firestore internal assertions.
        if (err?.code === 'permission-denied') {
          unsubscribe();
        }
      }
    );

    return () => unsubscribe();
  }, [user, isAdmin, isSuperAdmin]);

  return { announcements, loading, error };
}
