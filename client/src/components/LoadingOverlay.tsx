import React from "react";
import CircularProgress from "@mui/material/CircularProgress";

interface LoadingOverlayProps {
  show: boolean;
  message?: string;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ show, message }) => {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-4 bg-base-100/80 dark:bg-base-300/80 backdrop-blur-md">
      <CircularProgress size={64} thickness={4.5} />
      {message && (
        <p className="text-sm font-medium text-base-content/70 text-center">{message}</p>
      )}
    </div>
  );
};

export default LoadingOverlay;
