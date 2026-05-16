import React from "react";

interface ConfirmDialogProps {
    open: boolean;
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    confirmClass?: string;
    onConfirm: () => void;
    onCancel: () => void;
}

export default function ConfirmDialog({
    open,
    title = "Confirm Action",
    message,
    confirmText = "Confirm",
    cancelText = "Cancel",
    confirmClass = "btn-primary",
    onConfirm,
    onCancel,
    }: ConfirmDialogProps) {
    if (!open) return null;

    return (
        <div className="modal modal-open">
        <div className="modal-box">
            <h3 className="font-bold text-lg">{title}</h3>

            <p className="py-4 text-base-content/80">
            {message}
            </p>

            <div className="modal-action">
            <button className="btn" onClick={onCancel}>
                {cancelText}
            </button>

            <button
                className={`btn ${confirmClass}`}
                onClick={onConfirm}
            >
                {confirmText}
            </button>
            </div>
        </div>

        {/* backdrop */}
        <div className="modal-backdrop" onClick={onCancel} />
        </div>
    );
}