import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

// Minimal toast system (no dependency). Mount <ToastProvider> once high in the tree;
// call useToast().toast(message, tone) anywhere below it. Auto-dismisses after ~3.2s.

type ToastTone = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  toast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}

const TONE: Record<ToastTone, { border: string; text: string; icon: string }> = {
  success: { border: "border-safe", text: "text-safe", icon: "✓" },
  error: { border: "border-danger", text: "text-danger", icon: "✕" },
  info: { border: "border-brand", text: "text-brand", icon: "ℹ" },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, tone: ToastTone = "info") => {
      const id = (idRef.current += 1);
      setItems((prev) => [...prev, { id, message, tone }]);
      setTimeout(() => dismiss(id), 3200);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[70] flex w-80 max-w-[90vw] flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`animate-fadein pointer-events-auto flex items-start gap-3 rounded-[14px] border-l-4 bg-white p-3 shadow-lg ${TONE[t.tone].border}`}
          >
            <span className={`text-[16px] font-bold ${TONE[t.tone].text}`}>
              {TONE[t.tone].icon}
            </span>
            <span className="flex-1 text-[14px] text-ink">{t.message}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="text-muted transition-colors hover:text-ink"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
