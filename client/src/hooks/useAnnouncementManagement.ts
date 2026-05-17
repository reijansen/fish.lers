import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Announcement } from '../db';
import { useAuth } from './useAuth';
import { deleteField } from 'firebase/firestore';
import { deleteDoc } from 'firebase/firestore';

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
      const list = snapshot.docs.map((doc) => {
        const data = doc.data();

        return {
          announcementID: doc.id,
          ...data,

          // 🔥 NORMALIZATION (CRITICAL FIX)
          active: data.active ?? true,
        } as Announcement;
      });

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

      active: announcementData.active ?? true,

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

  const updateAnnouncement = async (
    announcementId: string,
    updates: Partial<Announcement>
  ) => {
    if (!user) throw new Error('User not authenticated');

    await updateDoc(doc(db, 'announcements', announcementId), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  };

  const archiveAnnouncement = async (announcementId: string) => {
    if (!user || !isSuperAdmin) throw new Error('Unauthorized');

    await updateDoc(doc(db, 'announcements', announcementId), {
      archivedAt: serverTimestamp(),
      archivedBy: user.uid,
      active: false // optional but recommended
    });
  };

  const restoreAnnouncement = async (announcementId: string) => {
    if (!user || !isSuperAdmin) throw new Error('Unauthorized');

    await updateDoc(doc(db, 'announcements', announcementId), {
      active: true,
      restoredAt: serverTimestamp(),
      restoredBy: user.uid,

      archivedAt: deleteField(),
      archivedBy: deleteField(),
    });
  };

  const deleteAnnouncementPermanently = async (announcementId: string) => {
    if (!user || !isSuperAdmin) throw new Error('Unauthorized');

    await deleteDoc(doc(db, 'announcements', announcementId));
  };

  return {
    announcements,
    loading,
    createAnnouncement,
    approveAnnouncement,
    rejectAnnouncement,
    updateAnnouncement,
    archiveAnnouncement,
    restoreAnnouncement,
    deleteAnnouncementPermanently, 
  };
}