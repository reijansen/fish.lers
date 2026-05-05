import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { Announcement } from '../db';

interface AnnouncementBannerProps {
  announcements: Announcement[];
}

const AnnouncementBanner: React.FC<AnnouncementBannerProps> = ({ announcements }) => {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  if (announcements.length === 0) return null;

  const visibleAnnouncements = announcements.filter(
    (a) => !dismissedIds.has(a.announcementID || '')
  );

  if (visibleAnnouncements.length === 0) return null;

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
      {visibleAnnouncements.map((announcement) => (
        <div
          key={announcement.announcementID}
          className={`alert ${getAlertClass(announcement.type)} flex items-start justify-between`}
        >
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
    </div>
  );
};

export default AnnouncementBanner;