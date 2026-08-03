"use client";

import { ReactNode } from "react";

export function BuilderSection({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-[#10283f]/10 bg-white shadow-sm">
      <div className="border-b border-[#10283f]/8 px-6 py-4">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-[#a06e16]">
          Section {number}
        </p>
        <h2 className="mt-1 font-serif text-2xl font-semibold text-[#10283f]">{title}</h2>
      </div>
      <div className="space-y-6 px-6 py-6">{children}</div>
    </section>
  );
}

export function BuilderSubheading({ children }: { children: ReactNode }) {
  return (
    <h3 className="border-t border-[#10283f]/8 pt-5 text-sm font-bold uppercase tracking-[.14em] text-[#69757e] first:border-t-0 first:pt-0">
      {children}
    </h3>
  );
}

export function BuilderField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-[#263746]">{label}</span>
      {hint ? <span className="mb-2 block text-xs leading-5 text-[#69757e]">{hint}</span> : null}
      {children}
    </label>
  );
}

export function BuilderInput({
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-[#10283f]/15 px-4 py-3 outline-none focus:border-[#c68b1b] focus:ring-2 focus:ring-[#e8c273]/30 ${className}`}
    />
  );
}

export function BuilderTextarea({
  className = "",
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-xl border border-[#10283f]/15 px-4 py-3 outline-none focus:border-[#c68b1b] focus:ring-2 focus:ring-[#e8c273]/30 ${className}`}
    />
  );
}

export function BuilderRadioGroup<T extends string>({
  name,
  value,
  options,
  onChange,
}: {
  name: string;
  value: T;
  options: Array<{ id: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map((option) => (
        <label
          key={option.id}
          className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm ${
            value === option.id
              ? "border-[#c68b1b] bg-[#fff9eb] ring-2 ring-[#e8c273]/25"
              : "border-[#10283f]/10 hover:bg-[#faf8f3]"
          }`}
        >
          <input
            type="radio"
            name={name}
            checked={value === option.id}
            onChange={() => onChange(option.id)}
            className="accent-[#c68b1b]"
          />
          <span className="font-medium text-[#10283f]">{option.label}</span>
        </label>
      ))}
    </div>
  );
}

export function BuilderCheckboxGrid({
  options,
  values,
  onChange,
}: {
  options: Array<{ id: string; label: string }>;
  values: Record<string, boolean>;
  onChange: (id: string, checked: boolean) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {options.map((option) => (
        <label
          key={option.id}
          className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#10283f]/10 px-4 py-3 text-sm hover:bg-[#faf8f3]"
        >
          <input
            type="checkbox"
            checked={Boolean(values[option.id])}
            onChange={(event) => onChange(option.id, event.target.checked)}
            className="mt-0.5 accent-[#c68b1b]"
          />
          <span className="leading-6 text-[#263746]">{option.label}</span>
        </label>
      ))}
    </div>
  );
}
