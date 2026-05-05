import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Announcement } from '../db';
import { useAuth } from './useAuth';

export function useAnnouncementManagement() {
  const { user, isAdmin, isSuperAdmin } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || (!isAdmin && !isSuperAdmin)) {
      setLoading(false);
      return;
    }

    // Query all announcements for management
    const q = query(
      collection(db, 'announcements'),
      orderBy('submittedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((doc) => ({
        announcementID: doc.id,
        ...doc.data(),
      } as Announcement));

      setAnnouncements(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, isAdmin, isSuperAdmin]);

  const createAnnouncement = async (announcementData: Omit<Announcement, 'announcementID' | 'submittedBy' | 'submittedAt' | 'status'>) => {
    if (!user) throw new Error('User not authenticated');

    const newAnnouncement: Omit<Announcement, 'announcementID'> = {
      ...announcementData,
      status: isSuperAdmin ? 'approved' : 'pending',
      submittedBy: user.uid,
      submittedAt: new Date().toISOString(),
    };

    await addDoc(collection(db, 'announcements'), newAnnouncement);
  };

  const approveAnnouncement = async (announcementId: string, reviewNotes?: string) => {
    if (!user || !isSuperAdmin) throw new Error('Unauthorized');

    await updateDoc(doc(db, 'announcements', announcementId), {
      status: 'approved',
      reviewedBy: user.uid,
      reviewedAt: serverTimestamp(),
      reviewNotes: reviewNotes || null,
    });
  };

  const rejectAnnouncement = async (announcementId: string, reviewNotes?: string) => {
    if (!user || !isSuperAdmin) throw new Error('Unauthorized');

    await updateDoc(doc(db, 'announcements', announcementId), {
      status: 'rejected',
      reviewedBy: user.uid,
      reviewedAt: serverTimestamp(),
      reviewNotes: reviewNotes || null,
    });
  };

  const updateAnnouncement = async (announcementId: string, updates: Partial<Announcement>) => {
    if (!user) throw new Error('User not authenticated');

    await updateDoc(doc(db, 'announcements', announcementId), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  };

  const deleteAnnouncement = async (announcementId: string) => {
    if (!user || !isSuperAdmin) throw new Error('Unauthorized');

    await updateDoc(doc(db, 'announcements', announcementId), {
      active: false,
      deletedAt: serverTimestamp(),
      deletedBy: user.uid,
    });
  };

  return {
    announcements,
    loading,
    createAnnouncement,
    approveAnnouncement,
    rejectAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
  };
}