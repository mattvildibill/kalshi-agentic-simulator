import { useEffect, useRef, type ReactNode } from "react";

export const money = (cents: number, decimals = 2) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(cents / 100);
export const signedMoney = (cents: number) =>
  `${cents > 0 ? "+" : ""}${money(cents)}`;
export const percent = (value: number) => `${Math.round(value * 100)}%`;
export function date(value?: string | null, withTime = false) {
  if (!value) return "Not yet recorded";
  if (!Number.isFinite(Date.parse(value))) return "Unavailable";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(withTime
      ? { hour: "numeric", minute: "2-digit", timeZoneName: "short" as const }
      : {}),
    timeZone: "America/Los_Angeles",
  }).format(new Date(value));
}

export function Icon({
  name,
  className = "",
}: {
  name:
    | "arrow"
    | "search"
    | "research"
    | "activity"
    | "check"
    | "clock"
    | "close"
    | "shield";
  className?: string;
}) {
  const paths = {
    arrow: <path d="M7 17 17 7M7 7h10v10" />,
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 5 5" />
      </>
    ),
    research: (
      <>
        <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" />
        <path d="M14 3v6h6M8 13h8M8 17h5" />
      </>
    ),
    activity: <path d="M2 12h5l3-8 4 16 3-8h5" />,
    check: <path d="m5 12 4 4L19 6" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    close: <path d="m6 6 12 12M6 18 18 6" />,
    shield: (
      <>
        <path d="m12 3 8 3v5c0 5-8 10-8 10S4 16 4 11V6l8-3Z" />
        <path d="m8.5 11.5 2.5 2.5 4.5-5" />
      </>
    ),
  };
  return (
    <svg
      className={`icon ${className}`}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

export function EmptyState({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="empty-state">
      <Icon name="research" />
      <h3>{title}</h3>
      <div>{children}</div>
    </div>
  );
}

export function DetailDialog({
  titleId,
  label,
  onClose,
  children,
}: {
  titleId: string;
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const focused = document.activeElement;
    const overflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      if (focused instanceof HTMLElement && focused.isConnected)
        focused.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="detail-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const bounds = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom
          )
            onClose();
        }
      }}
    >
      <div className="detail-top">
        <span className="eyebrow">{label}</span>
        <button
          type="button"
          className="icon-button"
          aria-label="Close market detail"
          onClick={onClose}
          autoFocus
        >
          <Icon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
