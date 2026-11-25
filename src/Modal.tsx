import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);

  const dismiss = () => {
    const dialog = ref.current;
    if (!dialog?.animate || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      close();
      return;
    }
    if (dialog.dataset.closing) return;
    dialog.dataset.closing = "true";
    dialog.animate(
      [
        { transform: "translateY(0) scale(1)", opacity: 1 },
        { transform: "translateY(65px) scale(.94)", opacity: 0 },
      ],
      { duration: 190, easing: "ease-in", fill: "forwards" }
    ).finished.then(close, close);
  };

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  }, []);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        dismiss();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) dismiss();
      }}
    >
      <div
        className="modal-head"
        onTouchStart={(e) => {
          const finger = e.touches[0];
          touch.current = e.touches.length === 1 ? { x: finger.clientX, y: finger.clientY } : null;
        }}
        onTouchCancel={() => {
          touch.current = null;
        }}
        onTouchEnd={(e) => {
          const start = touch.current;
          const finger = e.changedTouches[0];
          touch.current = null;
          if (
            start &&
            finger &&
            finger.clientY - start.y > 46 &&
            finger.clientY - start.y > Math.abs(finger.clientX - start.x) * 1.5
          )
            dismiss();
        }}
      >
        <h2>{title}</h2>
        <button className="icon-btn" onClick={dismiss} aria-label="Close dialog">
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
