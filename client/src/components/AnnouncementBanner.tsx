import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { Announcement } from '../db';

interface AnnouncementBannerProps {
  announcements: Announcement[];
}

const AnnouncementBanner: React.FC<AnnouncementBannerProps> = ({ announcements }) => {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);

  if (announcements.length === 0) return null;

  const visibleAnnouncements = announcements
    .filter((a) => a.active !== false) // enforce toggle
    .filter((a) => !dismissedIds.has(a.announcementID || ''))
    .slice() // copy
    .sort((a, b) => {
      // New announcements get priority (submitted within 3 days)
      const now = Date.now();
      const aTime = a.submittedAt ? Date.parse(a.submittedAt as any) : 0;
      const bTime = b.submittedAt ? Date.parse(b.submittedAt as any) : 0;
      const aIsNew = now - aTime < 3 * 24 * 60 * 60 * 1000;
      const bIsNew = now - bTime < 3 * 24 * 60 * 60 * 1000;
      if (aIsNew && !bIsNew) return -1;
      if (!aIsNew && bIsNew) return 1;
      return bTime - aTime; // newest first
    });

  if (visibleAnnouncements.length === 0) return null;

  const MAX_VISIBLE = 3;
  const shouldShowMore = visibleAnnouncements.length > MAX_VISIBLE;
  const announcementsToRender = showAll ? visibleAnnouncements : visibleAnnouncements.slice(0, MAX_VISIBLE);

  const getIcon = (type: string) => {
    switch (type) {
      case 'error':
        return <AlertCircle className="w-5 h-5" />;
      case 'success':
        return <CheckCircle2 className="w-5 h-5" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5" />;
      case 'info':
      default:
        return <Info className="w-5 h-5" />;
    }
  };

  const getTypeLabel = (type: Announcement['type']) => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  const getAlertClass = (type: string) => {
    switch (type) {
      case 'error':
        return 'alert-error';
      case 'success':
        return 'alert-success';
      case 'warning':
        return 'alert-warning';
      case 'info':
      default:
        return 'alert-info';
    }
  };

  const handleDismiss = (id: string | undefined) => {
    if (id) {
      setDismissedIds((prev) => new Set([...prev, id]));
    }
  };

  return (
    <div className="space-y-2">
      {announcementsToRender.map((announcement) => (
        <div
          key={announcement.announcementID}
          className={`alert ${getAlertClass(announcement.type)} flex items-start justify-between`}
        >
          <span className={`badge ${announcement.active !== false ? 'badge-success' : 'badge-neutral'}`}>
            {announcement.active !== false ? 'Active' : 'Inactive'}
          </span>
          <div className="flex items-start gap-3">
            {getIcon(announcement.type)}
            <div className="flex-1">
              {announcement.title && (
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{announcement.title}</h3>
                  <span className="badge badge-outline badge-sm uppercase">
                    {getTypeLabel(announcement.type)}
                  </span>
                </div>
              )}
              <p className="text-sm">{announcement.message}</p>
            </div>
          </div>
          <button
            className="btn btn-ghost btn-xs btn-circle"
            onClick={() => handleDismiss(announcement.announcementID)}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
      {shouldShowMore && (
        <div className="mt-2">
          <button className="btn btn-outline btn-sm" onClick={() => setShowAll((s) => !s)}>
            {showAll ? 'Show less' : `Show more (${visibleAnnouncements.length - MAX_VISIBLE})`}
          </button>
        </div>
      )}
    </div>
  );
};

export default AnnouncementBanner;