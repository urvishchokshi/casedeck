"use client";

import { useState } from "react";

const chatIcon = (
  <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden>
    <path
      d="M10 2.5a7.5 7.5 0 00-6.4 11.4L2.5 17.5l3.7-1.05A7.5 7.5 0 1010 2.5z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * The number is already in the server-rendered payload for every signed-in
 * user — this click gate is UX friction against casual scraping-by-eye, not
 * a security boundary (documented in CLAUDE.md).
 */
export function RevealWhatsApp({ number }: { number: string }) {
  const [revealed, setRevealed] = useState(false);

  if (!revealed) {
    return (
      <button
        type="button"
        onClick={() => setRevealed(true)}
        className="flex h-[38px] w-full items-center justify-center gap-2 whitespace-nowrap rounded-[var(--rs)] bg-[var(--accent)] text-[12.5px] font-semibold text-[var(--on-accent)] transition-colors hover:bg-[var(--accent-hover)]"
      >
        {chatIcon}
        Reveal WhatsApp number
      </button>
    );
  }

  // wa.me wants the full international number as bare digits (no +).
  return (
    <a
      href={`https://wa.me/${number.replace(/\D/g, "")}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex h-[38px] w-full items-center justify-center gap-2 whitespace-nowrap rounded-[var(--rs)] bg-[var(--accent-tint)] text-[12.5px] font-semibold text-[var(--accent)] transition-colors hover:bg-[var(--nav-hover)]"
    >
      {chatIcon}
      Open WhatsApp
    </a>
  );
}
