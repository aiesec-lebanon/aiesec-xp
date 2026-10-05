"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

export type ToastTone = "ok" | "error";
type ToastEntry = { id: number; message: string; tone: ToastTone };

const DURATION_MS = 4500;

const ToastContext = createContext<((message: string, tone?: ToastTone) => void) | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback(
    (message: string, tone: ToastTone = "ok") => {
      const id = nextId.current++;
      setToasts((current) => [...current, { id, message, tone }]);
      window.setTimeout(() => dismiss(id), DURATION_MS);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={addToast}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-90 flex-col items-end gap-2 px-4 sm:px-0"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={`toast-pop pointer-events-auto flex w-full items-start gap-2.5 rounded-xl px-3.5 py-2.5 text-[13px] font-semibold text-ink shadow-e2 ${
              toast.tone === "ok" ? "bg-apd-wash" : "bg-re-wash"
            }`}
          >
            <span
              aria-hidden
              className={`mt-1 size-2 flex-none rounded-full ${
                toast.tone === "ok" ? "bg-stage-apd" : "bg-stage-re"
              }`}
            />
            <span className="min-w-0 flex-1">{toast.message}</span>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss"
              className="flex-none text-ink-faint transition-colors hover:text-ink"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function useToast(): (message: string, tone?: ToastTone) => void {
  const addToast = useContext(ToastContext);
  if (!addToast) throw new Error("useToast must be used within a ToastProvider");
  return addToast;
}

export function useActionToast(state: { ok: boolean; message: string } | null): void {
  const toast = useToast();

  useEffect(() => {
    if (state) toast(state.message, state.ok ? "ok" : "error");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
}
