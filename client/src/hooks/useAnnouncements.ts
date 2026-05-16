import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Announcement } from '../db';
import { useAuth } from './useAuth';

export function useAnnouncements() {
  const { user, isAdmin, isSuperAdmin } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    // Determine user role
    const userRole = isSuperAdmin ? 'superadmin' : isAdmin ? 'admin' : 'student';

    // Query active and approved announcements visible to this user
    const q = query(
      collection(db, 'announcements'),
      where('status', '==', 'approved'),
      where('visibleTo', 'array-contains', userRole)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
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
    });

    return () => unsubscribe();
  }, [user, isAdmin, isSuperAdmin]);

  return { announcements, loading };
}