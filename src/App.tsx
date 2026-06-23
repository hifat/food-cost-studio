import { useState, useRef } from "react";
import {
  Calculator,
  Layers,
  ChefHat,
  Package as PackageIcon,
  UtensilsCrossed,
  Settings as SettingsIcon,
  Download,
  Upload,
  Database,
  TrendingUp,
} from "lucide-react";
import { useAppStore } from "./store";
import { downloadJSON, readJSONFile, buildBackup, isBackupData } from "./utils/backup";

import { fmtTHB, fmtPct, computeMenuProfit } from "./utils/calc";
import IngredientsView from "./features/ingredients/IngredientsView";
import RecipesView from "./features/recipes/RecipesView";
import PackagesView from "./features/packages/PackagesView";
import MenusView from "./features/menus/MenusView";
import SettingsView from "./features/settings/SettingsView";

type TabId = "dashboard" | "ingredients" | "recipes" | "packages" | "menus" | "settings";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "dashboard", label: "Dashboard", icon: <Calculator className="w-4 h-4" /> },
  { id: "ingredients", label: "Ingredients", icon: <Layers className="w-4 h-4" /> },
  { id: "packages", label: "Packages", icon: <PackageIcon className="w-4 h-4" /> },
  { id: "recipes", label: "Recipes", icon: <ChefHat className="w-4 h-4" /> },
  { id: "menus", label: "Menus", icon: <UtensilsCrossed className="w-4 h-4" /> },
  { id: "settings", label: "Settings", icon: <SettingsIcon className="w-4 h-4" /> },
];

export default function App() {
  const [active, setActive] = useState<TabId>("dashboard");
  const exportAll = useAppStore((s) => s.exportAll);
  const importAll = useAppStore((s) => s.importAll);
  const hasHydrated = useAppStore((s) => s.hasHydrated);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const data = buildBackup(exportAll());
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    downloadJSON(data, `food-cost-backup-${stamp}.json`);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = await readJSONFile(file);
      if (!isBackupData(parsed)) {
        alert("Invalid backup file format.");
        return;
      }
      if (
        !confirm(
          "This will replace all current data with the imported backup. Continue?",
        )
      )
        return;
      importAll(parsed);
      alert("Data imported successfully.");
    } catch (err) {
      console.error(err);
      alert("Failed to import: " + (err as Error).message);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="min-h-full flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-emerald-500 flex items-center justify-center text-white shadow-md">
                <Calculator className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                  Food Cost Studio
                </h1>
                <p className="text-[11px] text-slate-500 leading-tight">
                  Menu pricing &amp; profitability calculator
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExport}
                className="btn-secondary hidden sm:inline-flex"
                title="Export data"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                className="btn-secondary hidden sm:inline-flex"
                title="Import data"
              >
                <Upload className="w-4 h-4" />
                Import
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={handleImport}
              />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-t border-slate-200 bg-slate-50/40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex gap-1 overflow-x-auto scrollbar-thin -mb-px">
              {TABS.map((t) => {
                const isActive = active === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setActive(t.id)}
                    className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${isActive
                        ? "border-indigo-600 text-indigo-700"
                        : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                      }`}
                  >
                    {t.icon}
                    {t.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {!hasHydrated ? (
          <div className="text-center text-slate-400 py-12 text-sm">Loading…</div>
        ) : (
          <>
            {active === "dashboard" && <Dashboard />}
            {active === "ingredients" && <IngredientsView />}
            {active === "recipes" && <RecipesView />}
            {active === "packages" && <PackagesView />}
            {active === "menus" && <MenusView />}
            {active === "settings" && <SettingsView />}
          </>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2">
          <span>
            <Database className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />
            Data is stored locally in your browser.
          </span>
          <span className="flex items-center gap-2">
            <button onClick={handleExport} className="hover:text-indigo-600 inline-flex items-center gap-1">
              <Download className="w-3.5 h-3.5" /> Export
            </button>
            <span className="text-slate-300">•</span>
            <button onClick={() => fileRef.current?.click()} className="hover:text-indigo-600 inline-flex items-center gap-1">
              <Upload className="w-3.5 h-3.5" /> Import
            </button>
          </span>
        </div>
      </footer>
    </div>
  );
}

// --------- Dashboard ---------

function Dashboard() {
  const ingredients = useAppStore((s) => s.ingredients);
  const recipes = useAppStore((s) => s.recipes);
  const packages = useAppStore((s) => s.packages);
  const menus = useAppStore((s) => s.menus);
  const setting = useAppStore((s) => s.setting);
  const importAll = useAppStore((s) => s.importAll);
  const exportAll = useAppStore((s) => s.exportAll);

  const totalCost = menus.reduce((s, m) => s + m.cost_price, 0);
  const totalRevenue = menus.reduce((s, m) => s + m.selling_price, 0);
  const totalProfit = totalRevenue - totalCost;
  const avgMargin =
    totalRevenue > 0
      ? menus.reduce((s, m) => s + computeMenuProfit(m).margin, 0) / menus.length
      : 0;

  const topMenus = [...menus]
    .map((m) => ({ m, ...computeMenuProfit(m) }))
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 5);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = await readJSONFile(file);
      if (!isBackupData(parsed)) {
        alert("Invalid backup file format.");
        return;
      }
      if (
        !confirm(
          "This will replace all current data with the imported backup. Continue?",
        )
      )
        return;
      importAll(buildBackup(parsed));
      alert("Data imported successfully.");
    } catch (err) {
      console.error(err);
      alert("Failed to import: " + (err as Error).message);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">
          Quick overview of your cost structure and most profitable menus.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <DashStat
          label="Ingredients"
          value={String(ingredients.filter((i) => !i.recipe_id).length)}
          hint={`${ingredients.length - ingredients.filter((i) => !i.recipe_id).length} sub-ingredients`}
          tone="indigo"
        />
        <DashStat
          label="Recipes"
          value={String(recipes.length)}
          hint={`${recipes.filter((r) => r.type === "INGREDIENT").length} published as ingredients`}
          tone="emerald"
        />
        <DashStat
          label="Packages"
          value={String(packages.length)}
          hint="Packaging supplies"
          tone="amber"
        />
        <DashStat
          label="Menus"
          value={String(menus.length)}
          hint="Active menu items"
          tone="sky"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <DashStat
          label="Total Cost"
          value={fmtTHB(totalCost)}
          hint="Sum of all menu costs"
          tone="rose"
          large
        />
        <DashStat
          label="Total Revenue"
          value={fmtTHB(totalRevenue)}
          hint="Sum of all menu selling prices"
          tone="indigo"
          large
        />
        <DashStat
          label="Projected Profit"
          value={fmtTHB(totalProfit)}
          hint={`Avg margin ${fmtPct(avgMargin)}`}
          tone={totalProfit >= 0 ? "emerald" : "rose"}
          large
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              Top Profitable Menus
            </h2>
          </div>
          {topMenus.length === 0 ? (
            <p className="text-sm text-slate-500">No menus yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {topMenus.map((row, idx) => (
                <li key={row.m.id} className="py-2.5 flex items-center gap-3">
                  <span className="w-6 h-6 rounded-md bg-slate-100 text-slate-600 text-xs font-semibold flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {row.m.name}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Cost {fmtTHB(row.m.cost_price)} • Sell {fmtTHB(row.m.selling_price)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-sm font-semibold ${row.profit >= 0 ? "text-emerald-600" : "text-rose-600"
                        }`}
                    >
                      {fmtTHB(row.profit)}
                    </p>
                    <p className="text-[11px] text-slate-500">{fmtPct(row.margin)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-5">
          <h2 className="text-base font-semibold text-slate-800 mb-3">Global Settings</h2>
          <div className="space-y-2 text-sm">
            <SettingRow label="Target Food Cost" value={fmtPct(setting.food_cost_percentage)} />
            <SettingRow label="Lineman GP" value={fmtPct(setting.lineman_gp_percentage)} />
            <SettingRow label="Grab GP" value={fmtPct(setting.grab_gp_percentage)} />
            <SettingRow label="Shopee Food GP" value={fmtPct(setting.shopee_food_gp_percentage)} />
            <SettingRow label="Other Expenses" value={fmtPct(setting.other_percentage)} />
            <SettingRow label="VAT" value={fmtPct(setting.vat_percentage)} />
          </div>
          <p className="text-[11px] text-slate-400 mt-3">
            Adjust these values in the Settings tab to see live recomputation everywhere.
          </p>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="text-base font-semibold text-slate-800 mb-2">Backup &amp; Restore</h2>
        <p className="text-sm text-slate-500 mb-4">
          Export your data to a JSON file, or import a previously exported backup to restore your
          state across browsers and devices.
        </p>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => {
            const data = exportAll();
            const stamp = new Date().toISOString().replace(/[:.]/g, "-");
            downloadJSON(data, `food-cost-backup-${stamp}.json`);
          }} className="btn-primary">
            <Download className="w-4 h-4" /> Export Data
          </button>
          <label className="btn-secondary cursor-pointer">
            <Upload className="w-4 h-4" /> Import Data
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={handleImport}
            />
          </label>
        </div>
      </div>
    </div>
  );
}

function DashStat({
  label,
  value,
  hint,
  tone = "indigo",
  large,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "indigo" | "emerald" | "amber" | "rose" | "sky";
  large?: boolean;
}) {
  const tones: Record<string, string> = {
    indigo: "from-indigo-500 to-indigo-600",
    emerald: "from-emerald-500 to-emerald-600",
    amber: "from-amber-500 to-amber-600",
    rose: "from-rose-500 to-rose-600",
    sky: "from-sky-500 to-sky-600",
  };
  return (
    <div className="card p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div
        className={`${large ? "text-2xl" : "text-xl"
          } font-bold bg-gradient-to-br ${tones[tone]} bg-clip-text text-transparent mt-1`}
      >
        {value}
      </div>
      {hint && <div className="text-[11px] text-slate-400 mt-1">{hint}</div>}
    </div>
  );
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-slate-600">{label}</span>
      <span className="font-semibold text-slate-800">{value}</span>
    </div>
  );
}
