"use client";

/**
 * components/ui/PasswordInput.tsx
 * --------------------------------------------------------------------
 * Password field with a show/hide eye toggle on the right. Used for every
 * password input (login, signup, change, reset) so the behaviour is
 * consistent. Toggle is tabIndex=-1 so keyboard tabbing skips it and goes
 * straight to the next field.
 */
import { useState } from "react";

const inputStyles =
  "h-14 w-full rounded-none border border-border-strong bg-bg-elevated pl-4 pr-12 text-sm text-text placeholder:text-text-subtle focus:border-accent focus:outline-none";

type Props = {
  value: string;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
  placeholder?: string;
  autoComplete?: string;
  minLength?: number;
  required?: boolean;
  "aria-invalid"?: boolean;
};

export function PasswordInput({
  value,
  onChange,
  placeholder,
  autoComplete,
  minLength,
  required,
  "aria-invalid": ariaInvalid,
}: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        minLength={minLength}
        required={required}
        aria-invalid={ariaInvalid}
        className={inputStyles}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute right-0 top-0 flex h-14 w-12 items-center justify-center text-text-subtle transition-colors hover:text-accent"
      >
        {visible ? <EyeOff /> : <Eye />}
      </button>
    </div>
  );
}

function Eye() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOff() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}
