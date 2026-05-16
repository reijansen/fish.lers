import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, AlertCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useAnnouncementManagement } from '../../hooks/useAnnouncementManagement';
import { Announcement } from '../../db';
import LoadingOverlay from '../../components/LoadingOverlay';

export default function CreateAnnouncement() {
  const { user, isSuperAdmin } = useAuth();
  const { createAnnouncement } = useAnnouncementManagement();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    title: '',
    message: '',
    type: 'info' as 'info' | 'success' | 'warning' | 'error',
    visibleTo: ['student'] as ('student' | 'admin' | 'superadmin')[],
    startDate: '',
    endDate: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSubmitting(true);
    setError(null);

    try {
      // Validate required fields
      if (!formData.title.trim() || !formData.message.trim()) {
        throw new Error('Title and message are required');
      }

      if (formData.visibleTo.length === 0) {
        throw new Error('Please select at least one audience');
      }

      // Validate date range
      if (formData.startDate && formData.endDate) {
        const start = new Date(formData.startDate);
        const end = new Date(formData.endDate);
        if (start >= end) {
          throw new Error('End date must be after start date');
        }
      }

      // Build announcement data, only including date fields if they have values
      const announcementData: Omit<Announcement, 'announcementID' | 'submittedBy' | 'submittedAt' | 'status' | 'startDate' | 'endDate'> & {
        startDate?: string;
        endDate?: string;
      } = {
        title: formData.title.trim(),
        message: formData.message.trim(),
        type: formData.type,
        visibleTo: formData.visibleTo,
        active: true,
        createdBy: user.uid,
        createdAt: new Date().toISOString(),
      };

      // Only include date fields if they have values
      if (formData.startDate.trim()) {
        announcementData.startDate = formData.startDate.trim();
      }
      if (formData.endDate.trim()) {
        announcementData.endDate = formData.endDate.trim();
      }

      await createAnnouncement(announcementData);

      // Navigate back to dashboard
      navigate(isSuperAdmin ? '/admin/announcements' : '/admindashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create announcement');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVisibilityChange = (role: 'student' | 'admin' | 'superadmin', checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      visibleTo: checked
        ? [...prev.visibleTo, role]
        : prev.visibleTo.filter(r => r !== role)
    }));
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'error': return 'text-error';
      case 'success': return 'text-success';
      case 'warning': return 'text-warning';
      case 'info':
      default: return 'text-info';
    }
  };

  return (
    <>
      <LoadingOverlay show={submitting} message="Creating announcement..." />
      <div className="p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold">Create Announcement</h1>
            <p className="text-base-content/70">
              {isSuperAdmin
                ? 'Create an announcement that will be published immediately'
                : 'Submit an announcement for superadmin approval'
              }
            </p>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="alert alert-error">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div className="form-control w-full max-w-xs">
            <label className="label">
              <span className="label-text font-medium">Title *</span>
            </label>
            <input
              type="text"
              className="input input-bordered"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Enter announcement title"
              required
            />
          </div>

          {/* Message */}
          <div className="form-control w-full max-w-xs">
            <label className="label">
              <span className="label-text font-medium">Message *</span>
            </label>
            <textarea
              className="textarea textarea-bordered min-h-24"
              value={formData.message}
              onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
              placeholder="Enter announcement message"
              required
            />
          </div>

          {/* Type */}
          <div className="form-control w-full max-w-xs">
            <label className="label">
              <span className="label-text font-medium">Type</span>
            </label>
            <select
              className="select select-bordered"
              value={formData.type}
              onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as any }))}
            >
              <option value="info">Info</option>
              <option value="success">Success</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
            </select>
            <div className={`text-sm mt-1 ${getTypeColor(formData.type)}`}>
              Preview: This announcement will appear as a {formData.type} message
            </div>
          </div>

          {/* Active Toggle */}
          <div className="form-control mt-4">
            <label className="label cursor-pointer">
              <span className="label-text font-medium">Active (Show in banner)</span>

              <input
                type="checkbox"
                className="toggle toggle-success"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />
            </label>

            <p className="text-xs text-base-content/60 mt-1">
              If disabled, announcement will not appear in banners but stays in system.
            </p>
          </div>

          {/* Visibility */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Visible To *</span>
            </label>
            <div className="space-y-2">
              {(['student', 'admin', 'superadmin'] as const).map((role) => (
                <label key={role} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="checkbox"
                    checked={formData.visibleTo.includes(role)}
                    onChange={(e) => handleVisibilityChange(role, e.target.checked)}
                  />
                  <span className="capitalize">{role}s</span>
                </label>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-xs">
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Start Date (Optional)</span>
              </label>
              <input
                type="date"
                className="input input-bordered"
                value={formData.startDate}
                onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
              />
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">End Date (Optional)</span>
              </label>
              <input
                type="date"
                className="input input-bordered"
                value={formData.endDate}
                onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
              />
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-3">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              <Send className="w-4 h-4" />
              {isSuperAdmin ? 'Publish Announcement' : 'Submit for Approval'}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => navigate(-1)}
              disabled={submitting}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </>
  );
}