"use client";

import { ReactNode } from "react";
import { X } from "lucide-react";

interface ModalProps {
  onClose: () => void;
  title?: ReactNode;
  headerExtra?: ReactNode;
  children: ReactNode;
  maxWidth?: string;
  zIndex?: string;
}

export default function Modal({
  onClose,
  title,
  headerExtra,
  children,
  maxWidth = "max-w-md",
  zIndex = "z-[60]",
}: ModalProps) {
  return (
    <div
      className={`fixed inset-0 ${zIndex} bg-black/60 backdrop-blur-sm flex items-center justify-center p-4`}
      onClick={onClose}
    >
      <div
        className={`bg-base-200 text-base-content border border-base-300 rounded-2xl shadow-xl w-full ${maxWidth} max-h-[90vh] overflow-hidden flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || headerExtra) && (
          <div className="flex items-center justify-between gap-3 p-4 sm:p-6 border-b border-base-300 shrink-0 sticky top-0 bg-base-200 z-10">
            {title && (
              <h2 className="text-lg font-bold text-base-content truncate">{title}</h2>
            )}
            <div className="flex items-center gap-2 ml-auto">
              {headerExtra}
              <button
                onClick={onClose}
                aria-label="Zamknij"
                className="btn btn-ghost btn-sm btn-circle text-base-content/60 hover:text-base-content"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        )}
        <div className="overflow-y-auto flex-1 min-h-0">{children}</div>
      </div>
    </div>
  );
}
