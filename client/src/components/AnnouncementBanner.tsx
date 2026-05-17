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

  const isActive = (a: Announcement) => a.active === true;
  const isInactive = (a: Announcement) => a.active === false;

  const visibleAnnouncements = announcements
    .filter(a => !a.archivedAt)
    .filter(a => !dismissedIds.has(a.announcementID!))
    .slice()
    .sort((a, b) => {
      const now = Date.now();

      const aActive = isActive(a);
      const bActive = isActive(b);

      const aTime = a.submittedAt ? Date.parse(a.submittedAt as any) : 0;
      const bTime = b.submittedAt ? Date.parse(b.submittedAt as any) : 0;

      const aNew = now - aTime < 3 * 24 * 60 * 60 * 1000;
      const bNew = now - bTime < 3 * 24 * 60 * 60 * 1000;

      if (aActive !== bActive) return aActive ? -1 : 1;
      if (aNew !== bNew) return aNew ? -1 : 1;
      return bTime - aTime;
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
          <div className="flex items-start gap-3">
            
            {getIcon(announcement.type)}
            {/* <span className="badge badge-outline badge-sm">
                    {getTypeLabel(announcement.type)}
            </span>  */}
            <div className="flex-1">
              {announcement.title && (
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold">{announcement.title}</h3>
                  {announcement.active !== false &&
                    <h3 className="font-semibold text-xs badge badge-outline backdrop-brightness-120">
                        <span> Active Announcement </span>
                    </h3>
                  }
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
            {showAll ? 'Show less' : `Show more (${visibleAnnouncements.length - announcementsToRender.length})`}
          </button>
        </div>
      )}
    </div>
  );
};

export default AnnouncementBanner;