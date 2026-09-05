"use client";

import {
  useEffect,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import {
  deleteMatchProfile,
  setStatus,
  upsertMatchProfile,
} from "@/app/actions/match";
import type {
  CampusType,
  MatchProfile,
  ModePref,
  PartnerStatus,
} from "@/lib/types";

const MODE_LABELS: Record<ModePref, string> = {
  online: "Online",
  offline: "Offline",
  both: "Both",
};

const STATUS_LABELS: Record<PartnerStatus, string> = {
  available: "Available",
  busy: "Busy",
};

const cardClasses =
  "rounded-[20px] bg-[var(--card)] px-[18px] py-4 [box-shadow:var(--sh)]";

export function MyMatchCard({ profile }: { profile: MatchProfile | null }) {
  const [editing, setEditing] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);

  if (!profile) {
    return (
      <div className={cardClasses}>
        <p className="text-[17px] font-bold text-[var(--heading)]">
          Join the board
        </p>
        <p className="mt-1 text-[13.5px] text-[var(--muted)]">
          Your card is visible to signed-in ISB students — your WhatsApp number
          is only revealed on click.
        </p>
        <ProfileForm initial={null} submitLabel="Add my card" />
      </div>
    );
  }

  if (editing) {
    return (
      <div className={cardClasses}>
        <p className="text-[17px] font-bold text-[var(--heading)]">
          Edit your card
        </p>
        <ProfileForm
          initial={profile}
          submitLabel="Save changes"
          onCancel={() => setEditing(false)}
          onSaved={() => setEditing(false)}
        />
      </div>
    );
  }

  const available = profile.status === "available";

  return (
    <div className={`${cardClasses} flex flex-wrap items-center gap-4`}>
      <div className="min-w-[180px] flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[14.5px] font-bold text-[var(--heading)]">
            Your card
          </span>
          <Pill
            tone={available ? "done" : "revisit"}
            className="px-[9px] py-[3px] text-[11.5px]"
          >
            <span
              aria-hidden
              className="h-[6px] w-[6px] rounded-full"
              style={{
                background: available
                  ? "var(--done-dot)"
                  : "var(--revisit-dot)",
              }}
            />
            {STATUS_LABELS[profile.status]}
          </Pill>
        </div>
        <p className="mt-[3px] text-[12.5px] text-[var(--muted-2)]">
          {profile.workex_function} · {profile.campus} ·{" "}
          {profile.workex_industry}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <StatusToggle current={profile.status} />
        <Button
          variant="secondary"
          className="h-9 px-3.5"
          onClick={() => setEditing(true)}
        >
          Edit card
        </Button>
        <button
          type="button"
          onClick={() => setRemoveOpen(true)}
          className="text-[12.5px] font-semibold text-[var(--muted-2)] underline underline-offset-2 transition-colors hover:text-[var(--weak)]"
        >
          Remove
        </button>
      </div>
      {removeOpen && <RemoveCardDialog onClose={() => setRemoveOpen(false)} />}
    </div>
  );
}

const chipBase =
  "rounded-[9px] px-3 py-[7px] text-[12.5px] font-semibold transition-colors";
const chipSelected = `${chipBase} bg-[var(--accent)] text-[var(--on-accent)]`;
const chipUnselected = `${chipBase} border border-[var(--line-ctl)] bg-[var(--card)] text-[var(--slate)] hover:border-[var(--line-hover)]`;

function Segmented<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (next: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          disabled={disabled}
          onClick={() => onChange(option.value)}
          className={`${
            value === option.value ? chipSelected : chipUnselected
          } disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

const inputClasses =
  "h-10 w-full rounded-[var(--rs)] border border-[var(--line-ctl)] bg-[var(--card)] px-[13px] text-[13.5px] text-[var(--ink)] placeholder:text-[var(--muted-2)] max-desk:h-11 max-desk:text-[16px]";
const fieldLabelClasses =
  "mb-[7px] text-[12px] font-semibold text-[var(--muted)]";

function ProfileForm({
  initial,
  submitLabel,
  onCancel,
  onSaved,
}: {
  initial: MatchProfile | null;
  submitLabel: string;
  onCancel?: () => void;
  onSaved?: () => void;
}) {
  const [whatsapp, setWhatsapp] = useState(initial?.whatsapp_number ?? "");
  const [workexFunction, setWorkexFunction] = useState(
    initial?.workex_function ?? ""
  );
  const [workexIndustry, setWorkexIndustry] = useState(
    initial?.workex_industry ?? ""
  );
  const [campus, setCampus] = useState<CampusType | null>(
    initial?.campus ?? null
  );
  const [mode, setMode] = useState<ModePref>(initial?.mode_preference ?? "both");
  const [status, setStatusChoice] = useState<PartnerStatus>(
    initial?.status ?? "available"
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const incomplete =
    !whatsapp.trim() ||
    !workexFunction.trim() ||
    !workexIndustry.trim() ||
    campus === null;

  const submit = () => {
    if (incomplete || campus === null) return;
    startTransition(async () => {
      setError(null);
      const result = await upsertMatchProfile({
        whatsapp,
        workexFunction,
        workexIndustry,
        campus,
        mode,
        status,
      });
      // On a first join there is no local state to flip — revalidatePath
      // refreshes the RSC payload and the non-null profile prop takes over.
      if (result.ok) {
        onSaved?.();
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 desk:grid-cols-3">
        <div>
          <p className={fieldLabelClasses}>WhatsApp number</p>
          <input
            type="tel"
            aria-label="WhatsApp number"
            placeholder="+91 98765 43210"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            className={inputClasses}
          />
        </div>
        <div>
          <p className={fieldLabelClasses}>Work-ex function</p>
          <input
            type="text"
            aria-label="Work-ex function"
            placeholder="Product"
            maxLength={60}
            value={workexFunction}
            onChange={(e) => setWorkexFunction(e.target.value)}
            className={inputClasses}
          />
        </div>
        <div>
          <p className={fieldLabelClasses}>Work-ex industry</p>
          <input
            type="text"
            aria-label="Work-ex industry"
            placeholder="FMCG"
            maxLength={60}
            value={workexIndustry}
            onChange={(e) => setWorkexIndustry(e.target.value)}
            className={inputClasses}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-x-8 gap-y-4">
        <div>
          <p className={fieldLabelClasses}>Campus</p>
          <Segmented
            options={[
              { value: "Hyderabad" as const, label: "Hyderabad" },
              { value: "Mohali" as const, label: "Mohali" },
            ]}
            value={campus}
            onChange={setCampus}
          />
        </div>
        <div>
          <p className={fieldLabelClasses}>Mode</p>
          <Segmented
            options={(["online", "offline", "both"] as const).map((value) => ({
              value,
              label: MODE_LABELS[value],
            }))}
            value={mode}
            onChange={setMode}
          />
        </div>
        <div>
          <p className={fieldLabelClasses}>Status</p>
          <Segmented
            options={(["available", "busy"] as const).map((value) => ({
              value,
              label: STATUS_LABELS[value],
            }))}
            value={status}
            onChange={setStatusChoice}
          />
        </div>
      </div>
      {error && (
        <p className="text-[12.5px] font-semibold text-[var(--weak)]">
          {error}
        </p>
      )}
      <div className="flex items-center gap-2">
        <Button disabled={incomplete || pending} onClick={submit}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button variant="secondary" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}

function StatusToggle({ current }: { current: PartnerStatus }) {
  const [optimisticStatus, setOptimisticStatus] = useOptimistic(current);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const choose = (next: PartnerStatus) => {
    if (next === optimisticStatus) return;
    startTransition(async () => {
      setError(null);
      setOptimisticStatus(next);
      const result = await setStatus(next);
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-[3px] rounded-[11px] bg-[var(--thead)] p-[3px]">
        {(["available", "busy"] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={optimisticStatus === value}
            // Disabled while in flight: a second click before the server
            // settles would desync the optimistic value from the DB.
            disabled={pending}
            onClick={() => choose(value)}
            className={`rounded-[9px] px-3.5 py-[7px] text-[12.5px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              optimisticStatus === value
                ? "bg-[var(--accent)] text-[var(--on-accent)]"
                : "text-[var(--muted-2)] hover:text-[var(--ink)]"
            }`}
          >
            {STATUS_LABELS[value]}
          </button>
        ))}
      </div>
      {error && (
        <p className="text-[12.5px] font-semibold text-[var(--weak)]">
          {error}
        </p>
      )}
    </div>
  );
}

function RemoveCardDialog({ onClose }: { onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const panelRef = useRef<HTMLDivElement>(null);

  // Escape/backdrop must not close mid-delete — the discarded error would
  // leave the user unsure whether the card is gone.
  const closeUnlessPending = () => {
    if (!pending) onClose();
  };

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, pending]);

  const remove = () =>
    startTransition(async () => {
      const result = await deleteMatchProfile();
      if (result.ok) {
        onClose();
      } else {
        setError(result.error);
      }
    });

  return (
    <div
      className="cd-fade-in fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[var(--overlay)] p-6 backdrop-blur-[2px]"
      onClick={closeUnlessPending}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Remove your card"
        onClick={(e) => e.stopPropagation()}
        className="cd-scale-in flex max-h-[calc(100dvh-48px)] w-[440px] max-w-full flex-col gap-5 overflow-y-auto rounded-[var(--r-modal)] bg-[var(--card)] p-[26px] outline-none [box-shadow:var(--sh-modal)]"
      >
        <div>
          <h3 className="mb-1 text-[24px] tracking-[-0.02em]">
            Remove your card?
          </h3>
          <p className="text-[13.5px] text-[var(--muted)]">
            Your card and WhatsApp number will no longer be visible to other
            students.
          </p>
        </div>
        {error && (
          <p className="text-[12.5px] font-semibold text-[var(--weak)]">
            {error}
          </p>
        )}
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button disabled={pending} onClick={remove}>
            Remove card
          </Button>
        </div>
      </div>
    </div>
  );
}
