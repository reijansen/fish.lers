import React from "react";
import { logicEquipment, useFetchAvailableItems } from "../equipment/logicEquipment";
import { useAuth } from '../../hooks/useAuth'
import { useRequests } from '../../hooks/useRequests'
import { Calendar, Clock, User, FileText, Package, Plus, Minus, Search, Send } from 'lucide-react';
import { AvailableEquipmentItem } from "../../db";
import LoadingOverlay from "../../components/LoadingOverlay";
import { useNavigate } from 'react-router-dom'

// Import Cally calendar components
import 'cally';

// Declare custom elements for TypeScript
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'calendar-date': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & { value?: string; min?: string }, HTMLElement>;
      'calendar-range': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & { value?: string; min?: string }, HTMLElement>;
      'calendar-month': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}

// REMOVE NUMBER INPUT ARROWS (Chrome, Edge, Safari)
const removeStepper = `
  input[type=number]::-webkit-inner-spin-button,
  input[type=number]::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  input[type=number] {
    -moz-appearance: textfield;
  }
`;

export const RequestForm: React.FC = () => {
  const { equipmentList, isLoading: isEquipmentLoading } = logicEquipment();
  const { user } = useAuth()
  const { createRequest } = useRequests(user?.uid)
  const navigate = useNavigate()

  const [requestedItems, setRequestedItems] = React.useState<{ [id: string]: number }>({});
  const [showDateCalendar, setShowDateCalendar] = React.useState(false);
  const [calendarKey, setCalendarKey] = React.useState(0);
  const [filterText, setFilterText] = React.useState('');
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>('asc');
  const [categoryFilter, setCategoryFilter] = React.useState<'all' | string>('all');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const dateCalendarRef = React.useRef<HTMLDivElement>(null);
  const [previewItem, setPreviewItem] = React.useState<AvailableEquipmentItem | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = React.useState(false);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const [formData, setFormData] = React.useState({
    startDate: "",
    endDate: "",
    start: "",
    end: "",
    adviser: "",
    purpose: "",
  });

  const { availableEquipment } = useFetchAvailableItems(
    equipmentList,
    formData.startDate,
    formData.endDate
  );

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  // Handle range change from calendar-range component
  const handleRangeChange = (e: Event) => {
    const target = e.target as HTMLElement & { value: string };
    const value = target.value; // Format: "YYYY-MM-DD/YYYY-MM-DD" or "YYYY-MM-DD" if only start selected
    console.log('Calendar range value:', value);
    
    if (value.includes('/')) {
      // Both dates selected
      const [start, end] = value.split('/');
      console.log('Selected range:', { startDate: start, endDate: end });
      setFormData(prev => ({ ...prev, startDate: start, endDate: end }));
      // Close calendar after range is complete
      setShowDateCalendar(false);
    } else if (value) {
      // Only start date selected so far
      setFormData(prev => ({ ...prev, startDate: value, endDate: '' }));
    }
  };

  // Format date for display (YYYY-MM-DD to readable format)
  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Get today's date in YYYY-MM-DD format for min attribute
  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  // Get current time in HH:MM format
  const getCurrentTime = () => {
    const now = new Date();
    return now.toTimeString().slice(0, 5);
  };

  // Check if selected start date is today
  const isStartDateToday = () => {
    return formData.startDate === getTodayDate();
  };

  // Get min time for start time (only restrict if start date is today)
  const getMinStartTime = () => {
    return isStartDateToday() ? getCurrentTime() : undefined;
  };

  // Get the range value for the calendar
  const getCalendarRangeValue = () => {
    if (formData.startDate && formData.endDate) {
      return `${formData.startDate}/${formData.endDate}`;
    }
    return formData.startDate || '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validate date fields
    if (!formData.startDate) {
      setErrorMessage("Please select a start date.");
      return;
    }
    if (!formData.endDate) {
      setErrorMessage("Please select a return date.");
      return;
    }
    if (!formData.start) {
      setErrorMessage("Please select a start time.");
      return;
    }
    if (!formData.end) {
      setErrorMessage("Please select a return time.");
      return;
    }
    const startDateTime = new Date(`${formData.startDate}T${formData.start}`);
    const endDateTime = new Date(`${formData.endDate}T${formData.end}`);

    if (startDateTime >= endDateTime) {
      setErrorMessage("Return time must be later than the start time.");
      return;
    }
    if (!formData.adviser.trim()) {
      setErrorMessage("Please enter an adviser or project leader.");
      return;
    }
    if (!formData.purpose.trim()) {
      setErrorMessage("Please enter the purpose of your request.");
      return;
    }

    const itemsArray = Object.entries(requestedItems)
      .filter(([_, qty]) => qty > 0)
      .map(([equipmentID, qty]) => ({ equipmentID, qty }));
    if (itemsArray.length === 0) {
      setErrorMessage("Please select at least one item.");
      return;
    }

    setIsSubmitting(true);
    try {
      // Ensure user is authenticated
      if (!user) {
        setErrorMessage('You must be signed in to submit a request');
        return;
      }

      // Create request via API
      await createRequest({
        userID: user.uid,
        items: itemsArray,
        startDate: formData.startDate,
        endDate: formData.endDate,
        purpose: formData.purpose,
        status: 'pending',
      });

      // Clear local form state and show confirmation
      setRequestedItems({})
      setFormData({ startDate: "", endDate: "", start: "", end: "", adviser: "", purpose: "" })
      setSuccessMessage("Request submitted!")
      setErrorMessage(null)
      // Navigate to tracking so user can see the created request
      navigate('/tracking')
    } catch (error) {
      console.error("Error submitting request:", error);
      setErrorMessage("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter equipment list
  const categoryOptions = React.useMemo(() => {
    const categories = new Set<string>();
    equipmentList.forEach((item) => {
      if (item.category) categories.add(item.category.trim());
    });
    return Array.from(categories).sort((a, b) => a.localeCompare(b));
  }, [equipmentList]);

  const normalizedFilter = filterText.trim().toLowerCase();
  const filteredEquipment = availableEquipment
    .filter((item: AvailableEquipmentItem) => {
      if (!normalizedFilter) return true;
      const nameMatch = (item.name || "").toLowerCase().includes(normalizedFilter);
      const categoryMatch = (item.category || "").toLowerCase().includes(normalizedFilter);
      return nameMatch || categoryMatch;
    })
    .filter((item: AvailableEquipmentItem) => {
      if (categoryFilter === 'all') return true;
      return (item.category || '').trim() === categoryFilter;
    })
    .sort((a: AvailableEquipmentItem, b: AvailableEquipmentItem) => {
      const nameA = (a.name || '').toLowerCase();
      const nameB = (b.name || '').toLowerCase();
      return sortOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
    });

  // Calculate totals
  const totalItems = Object.values(requestedItems).reduce((a, b) => a + b, 0);
  const selectedItems = Object.entries(requestedItems).filter(([_, qty]) => qty > 0);
  const previewDetails = React.useMemo(() => {
    if (!previewItem) return null;
    const detailed = equipmentList.find((eq) => eq.equipmentID === previewItem.equipmentID);
    return detailed ? { ...previewItem, ...detailed } : previewItem;
  }, [previewItem, equipmentList]);

  const openPreview = (item: AvailableEquipmentItem) => {
    setPreviewItem(item);
    setIsPreviewOpen(true);
  };

  const closePreview = () => {
    setIsPreviewOpen(false);
    setPreviewItem(null);
  };

  // Reset filters handler
  const resetFilters = () => {
    setFilterText('');
    setSortOrder('asc');
    setCategoryFilter('all');
  };

  return (
    <div className="p-3 sm:p-4 lg:p-6">
      {/* Inject CSS to remove number arrows */}
      <style>{removeStepper}</style>

      <LoadingOverlay show={isEquipmentLoading} message="Loading equipment inventory..." />

      {errorMessage && (
        <div className="alert alert-error mb-4 shadow flex items-center justify-between">
          <span>{errorMessage}</span>
          <button className="btn btn-sm min-h-11" onClick={() => setErrorMessage(null)}>
            Close
          </button>
        </div>
      )}
      {successMessage && (
        <div className="alert alert-success mb-4 shadow flex items-center justify-between">
          <span>{successMessage}</span>
          <button className="btn btn-sm min-h-11" onClick={() => setSuccessMessage(null)}>
            Close
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">New Equipment Request</h1>
        <p className="text-base-content/70">Select equipment and fill in the request details</p>
      </div>

        <div className="flex flex-col lg:flex-row gap-6">
        {/* LEFT PANEL - Equipment Selection */}
        <div className="flex-1">
          <div className="card bg-base-200 shadow-xl border border-base-300 dark:border-base-content/20 dark:bg-base-300">
            <div className="card-body p-4">
              {/* Header with search & filters */}
              <div className="space-y-4 mb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h2 className="card-title text-lg">
                    <Package className="w-5 h-5" />
                    Available Equipment
                  </h2>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr_1fr_auto] gap-3">
                  <label className="form-control">
                    <span className="label-text text-xs uppercase tracking-wide text-base-content/60">
                      Search
                    </span>
                    <label className="input input-sm input-bordered min-h-11 flex items-center gap-2">
                      <Search className="w-4 h-4 text-base-content/60" />
                      <input
                        type="text"
                        placeholder="Search equipment..."
                        className="grow"
                        value={filterText}
                        onChange={(e) => setFilterText(e.target.value)}
                      />
                    </label>
                  </label>
                  <label className="form-control w-full">
                    <span className="label-text text-xs uppercase tracking-wide text-base-content/60">
                      Sort
                    </span>
                    <select
                      className="select select-bordered select-sm min-h-11"
                      value={sortOrder}
                      onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                    >
                      <option value="asc">Alphabetical (A → Z)</option>
                      <option value="desc">Alphabetical (Z → A)</option>
                    </select>
                  </label>
                  <label className="form-control w-full">
                    <span className="label-text text-xs uppercase tracking-wide text-base-content/60">
                      Category
                    </span>
                    <select
                      className="select select-bordered select-sm min-h-11"
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value as 'all' | string)}
                    >
                      <option value="all">All categories</option>
                      {categoryOptions.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="flex items-end justify-end">
                    <button
                      type="button"
                      className="btn btn-sm min-h-11 btn-outline w-full lg:w-auto"
                      onClick={resetFilters}
                    >
                      Reset filters
                    </button>
                  </div>
                </div>
              </div>

              {/* Equipment List */}
              <div className="bg-base-100 rounded-lg border border-base-300 h-[55vh] sm:h-[420px] overflow-y-auto">
                {filteredEquipment.length === 0 ? (
                  <div className="p-8 text-center text-base-content/60">
                    No equipment found
                  </div>
                ) : (
                  <div className="divide-y divide-base-200">
                    {filteredEquipment.map((item: AvailableEquipmentItem) => {
                      const maxRequestQty = Math.max(item.totalInventory || 0, 1);
                      return (
                      <div
                        key={item.equipmentID}
                        className={`grid grid-cols-[auto_minmax(0,1fr)] sm:grid-cols-[auto_minmax(0,1fr)_auto] gap-3 p-3 transition-colors cursor-pointer ${
                          (requestedItems[item.equipmentID!] || 0) > 0 ? 'bg-primary/5' : 'hover:bg-primary/10'
                        }`}
                        onClick={() => openPreview(item)}
                      >
                        {/* Thumbnail */}
                        <div className="w-14 h-14 flex items-center justify-center bg-base-200 rounded-lg overflow-hidden">
                          {item.imageLink ? (
                            <img
                              src={item.imageLink}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package className="w-5 h-5 text-base-content/60" />
                          )}
                        </div>

                        {/* Item Info */}
                        <div className="flex flex-col gap-1 min-w-0">
                          <p className="font-medium truncate">{item.name}</p>
                          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                            <span className="badge badge-ghost badge-sm whitespace-nowrap">
                              Available: {item.available}
                            </span>
                            {item.available <= 0 && (
                              <span className="badge badge-warning badge-sm whitespace-nowrap">
                                Currently unavailable (still requestable)
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Quantity Stepper */}
                        <div
                          className="join justify-self-end sm:justify-self-auto col-span-2 sm:col-span-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="btn btn-sm min-h-11 join-item"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRequestedItems((prev) => ({
                                ...prev,
                                [item.equipmentID!]: Math.max((prev[item.equipmentID!] || 0) - 1, 0),
                              }));
                            }}
                            disabled={(requestedItems[item.equipmentID!] || 0) <= 0}
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <input
                            type="number"
                            min={0}
                            max={maxRequestQty}
                            value={requestedItems[item.equipmentID!] || 0}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) =>
                              setRequestedItems((prev) => ({
                                ...prev,
                                [item.equipmentID!]: Math.max(0, Math.min(Number(e.target.value), maxRequestQty)),
                              }))
                            }
                            className="input input-sm input-bordered min-h-11 join-item w-16 text-center"
                          />
                          <button
                            type="button"
                            className="btn btn-sm min-h-11 join-item"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRequestedItems((prev) => ({
                                ...prev,
                                [item.equipmentID!]: Math.min((prev[item.equipmentID!] || 0) + 1, maxRequestQty),
                              }));
                            }}
                            disabled={(requestedItems[item.equipmentID!] || 0) >= maxRequestQty}
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )})}
                  </div>
                )}
              </div>

              {/* Total Selected Stats */}
              <div className="stats stats-vertical sm:stats-horizontal bg-base-300 shadow mt-4">
                <div className="stat py-2 px-4">
                  <div className="stat-title text-xs">Items Selected</div>
                  <div className="stat-value text-lg">{selectedItems.length}</div>
                </div>
                <div className="stat py-2 px-4">
                  <div className="stat-title text-xs">Total Quantity</div>
                  <div className="stat-value text-lg text-primary">{totalItems}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL - Request Form */}
        <div className="w-full lg:w-96">
          <div className="card bg-base-200 shadow-xl border border-base-300 dark:border-base-content/20 dark:bg-base-300">
            <div className="card-body p-4">
              <h2 className="card-title text-lg justify-center mb-2">
                <FileText className="w-5 h-5" />
                Request Details
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Date Range */}
                <div className="form-control">
                  <label className="label py-1">
                    <span className="label-text font-medium flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Date of Usage
                    </span>
                  </label>
                  <div className="relative" ref={dateCalendarRef}>
                    <input type="hidden" name="startDate" value={formData.startDate} required />
                    <input type="hidden" name="endDate" value={formData.endDate} required />
                    <button
                      type="button"
                      className={`btn btn-sm w-full justify-between font-normal ${
                        formData.startDate && formData.endDate ? '' : 'text-base-content/50'
                      }`}
                      onClick={() => setShowDateCalendar(true)}
                    >
                      <span className="truncate">
                        {formData.startDate && formData.endDate
                          ? `${formatDateDisplay(formData.startDate)} — ${formatDateDisplay(formData.endDate)}`
                          : formData.startDate
                          ? `${formatDateDisplay(formData.startDate)} — Select end`
                          : 'Select date range'}
                      </span>
                      <Calendar className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Time Range */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="form-control">
                    <label className="label py-1">
                      <span className="label-text font-medium flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Start Time
                      </span>
                    </label>
                    <input
                      type="time"
                      name="start"
                      className="input input-sm input-bordered min-h-11 w-full"
                      onChange={handleInput}
                      min={isStartDateToday() ? getCurrentTime() : undefined}
                      value={formData.start}
                      required
                    />
                  </div>
                  <div className="form-control">
                    <label className="label py-1">
                      <span className="label-text font-medium flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Return Time
                      </span>
                    </label>
                    <input
                      type="time"
                      name="end"
                      className="input input-sm input-bordered min-h-11 w-full"
                      onChange={handleInput}
                      min={formData.startDate === formData.endDate && isStartDateToday() ? getCurrentTime() : undefined}
                      value={formData.end}
                      required
                    />
                  </div>
                </div>

                {/* Adviser */}
                <div className="form-control">
                  <label className="label py-1">
                    <span className="label-text font-medium flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Adviser / Project Leader
                    </span>
                  </label>
                  <input
                    type="text"
                    name="adviser"
                    className="input input-sm input-bordered min-h-11 w-full"
                    placeholder="Enter name"
                    onChange={handleInput}
                    value={formData.adviser}
                    required
                  />
                </div>

                {/* Purpose */}
                <div className="form-control">
                  <label className="label py-1">
                    <span className="label-text font-medium flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Purpose
                    </span>
                  </label>
                  <input
                    type="text"
                    name="purpose"
                    className="input input-sm input-bordered min-h-11 w-full"
                    placeholder="Enter purpose of usage"
                    onChange={handleInput}
                    value={formData.purpose}
                    required
                  />
                </div>

                {/* Request Summary */}
                <div className="form-control">
                  <label className="label py-1">
                    <span className="label-text font-medium">Request Summary</span>
                    <span className="label-text-alt">{selectedItems.length} items</span>
                  </label>
                  <div className="bg-base-100 border border-base-300 rounded-lg h-24 overflow-y-auto">
                    {selectedItems.length === 0 ? (
                      <div className="p-3 text-sm text-base-content/50 text-center">
                        No items selected
                      </div>
                    ) : (
                      <div className="divide-y divide-base-200">
                        {selectedItems.map(([id, qty]) => {
                          const item = equipmentList.find((e) => e.equipmentID === id);
                          if (!item) return null;
                          return (
                            <div key={id} className="flex justify-between items-center px-3 py-2 text-sm">
                              <span>{item.name}</span>
                              <span className="badge badge-primary badge-sm">{qty} pcs</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Submit Button */}
                <button 
                  type="submit" 
                  className="btn btn-primary btn-block gap-2"
                  disabled={isSubmitting || selectedItems.length === 0}
                >
                  {isSubmitting ? (
                    <>
                      <span className="loading loading-spinner loading-sm"></span>
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Submit Request
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
      {isPreviewOpen && previewDetails && (
        <div
          className="modal modal-open modal-middle"
          onClick={(e) => {
            if (e.target === e.currentTarget) closePreview();
          }}
        >
          <div className="modal-box w-11/12 max-w-2xl max-h-[85dvh] overflow-y-auto p-4 sm:p-6">
            <button
              type="button"
              className="btn btn-sm min-h-11 btn-circle btn-ghost absolute right-4 top-4"
              aria-label="Close preview"
              onClick={(e) => {
                e.stopPropagation();
                closePreview();
              }}
            >
              ✕
            </button>
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-sm text-base-content/60">Equipment Preview</p>
                <h3 className="text-2xl font-bold leading-tight">{previewDetails.name}</h3>
                {previewDetails.equipmentID && (
                  <p className="text-sm text-base-content/60 mt-1">
                    ID: {previewDetails.equipmentID}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-base-200 rounded-xl p-4 flex items-center justify-center">
                  {previewDetails.imageLink ? (
                    <img
                      src={previewDetails.imageLink}
                      alt={previewDetails.name}
                      className="w-full max-h-80 object-contain rounded-lg"
                    />
                  ) : (
                    <div className="text-base-content/60 text-center py-12">
                      No image available
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-base-content/60 uppercase tracking-wide">Category</p>
                    <p className="text-lg font-semibold">
                      {previewDetails.category?.trim() || "Uncategorized"}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-2">
                      <div>
                        <span className="badge badge-ghost badge-sm">
                          Available: {previewDetails.available ?? 0}
                        </span>
                      </div>
                      <div>
                        <span className="badge badge-outline badge-sm">
                          Ongoing: {previewDetails.reserved ?? 0}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-base-content/60 uppercase tracking-wide">Type</p>
                      <p className="text-lg font-semibold">
                        {previewDetails.isDisposable ? "Disposable" : "Durable"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-base-content/60 uppercase tracking-wide">Status</p>
                      <p className="text-lg font-semibold">
                        {(previewDetails.available ?? 0) > 0 ? "In stock" : "Unavailable"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-action">
              <button
                className="btn"
                onClick={(e) => {
                  e.stopPropagation();
                  closePreview();
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Date range picker (mobile-friendly bottom sheet) */}
      {showDateCalendar && (
        <div
          className="modal modal-open modal-middle"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowDateCalendar(false);
          }}
        >
          <div className="modal-box w-11/12 max-w-lg max-h-[85dvh] overflow-y-auto p-4 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-bold text-lg">Select date range</h3>
                <p className="text-sm text-base-content/70">
                  {formData.startDate && !formData.endDate ? "Now select the return date." : "Pick usage and return dates."}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-sm min-h-11 btn-circle btn-ghost"
                aria-label="Close date picker"
                onClick={() => setShowDateCalendar(false)}
              >
                ✕
              </button>
            </div>

            <div className="mt-4 flex justify-center">
              <calendar-range
                key={calendarKey}
                value={getCalendarRangeValue()}
                min={getTodayDate()}
                ref={(el: HTMLElement | null) => {
                  if (el) {
                    el.removeEventListener("change", handleRangeChange);
                    el.addEventListener("change", handleRangeChange);
                  }
                }}
              >
                <calendar-month></calendar-month>
              </calendar-range>
            </div>

            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                className="btn min-h-11 btn-ghost flex-1"
                onClick={() => {
                  setFormData((prev) => ({ ...prev, startDate: "", endDate: "" }));
                  setCalendarKey((prev) => prev + 1);
                }}
              >
                Clear dates
              </button>
              <button
                type="button"
                className="btn min-h-11 btn-outline flex-1"
                onClick={() => {
                  const today = getTodayDate();
                  setFormData((prev) => ({ ...prev, startDate: today, endDate: today }));
                }}
              >
                Set to today
              </button>
              <button type="button" className="btn min-h-11 btn-primary flex-1" onClick={() => setShowDateCalendar(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RequestForm;
