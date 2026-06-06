import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  tone?: "indigo" | "emerald" | "amber" | "rose" | "slate" | "sky";
  icon?: ReactNode;
}

const toneMap: Record<NonNullable<StatCardProps["tone"]>, string> = {
  indigo: "from-indigo-500 to-indigo-600",
  emerald: "from-emerald-500 to-emerald-600",
  amber: "from-amber-500 to-amber-600",
  rose: "from-rose-500 to-rose-600",
  slate: "from-slate-500 to-slate-600",
  sky: "from-sky-500 to-sky-600",
};

export default function StatCard({ label, value, hint, tone = "indigo", icon }: StatCardProps) {
  return (
    <div className="card p-4 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </div>
        {icon && <div className="text-slate-400">{icon}</div>}
      </div>
      <div className={`text-xl font-bold bg-gradient-to-br ${toneMap[tone]} bg-clip-text text-transparent`}>
        {value}
      </div>
      {hint && <div className="text-[11px] text-slate-400">{hint}</div>}
    </div>
  );
}
