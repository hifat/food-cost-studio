import type { ReactNode } from "react";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
  count?: number;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
  fullWidth?: boolean;
  ariaLabel?: string;
}

export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  fullWidth = false,
  ariaLabel,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`inline-flex items-center gap-1 p-1 bg-slate-100/80 rounded-xl border border-slate-200/80 ${
        fullWidth ? "w-full" : ""
      }`}
    >
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(opt.value)}
            className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-all duration-150 ${
              fullWidth ? "flex-1" : ""
            } ${
              size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"
            } ${
              isActive
                ? "bg-white text-indigo-700 shadow-sm ring-1 ring-indigo-200/60"
                : "text-slate-600 hover:text-slate-800 hover:bg-white/50"
            }`}
          >
            {opt.icon}
            <span>{opt.label}</span>
            {typeof opt.count === "number" && (
              <span
                className={`ml-1 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-[10px] font-semibold ${
                  isActive
                    ? "bg-indigo-100 text-indigo-700"
                    : "bg-slate-200 text-slate-600"
                }`}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
