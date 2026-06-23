import { useState, useMemo } from "react";
import {
  X,
  Plus,
  Save,
  RotateCcw,
  UtensilsCrossed,
  Layers,
  ChefHat,
  Package as PackageIcon,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import type { Menu, MenuComponent, UsageUnit } from "../../types";
import { USAGE_UNITS } from "../../types";
import { useAppStore, newMenuComponent } from "../../store";
import {
  fmt,
  fmtTHB,
  fmtPct,
  computeMenuCost,
  computePlatformPrices,
  refreshComponentActualPrices,
  computeMenuComponentActual,
} from "../../utils/calc";
import SearchableSelect from "../../components/SearchableSelect";
import SegmentedControl from "../../components/SegmentedControl";
import EmptyState from "../../components/EmptyState";

type ComponentBucket = "ingredient" | "recipe" | "package";

interface MenuFormProps {
  initial?: Menu | null;
  onSave: (
    data: Omit<Menu, "id" | "cost_price">,
  ) => void;
  onCancel?: () => void;
  showCancel?: boolean;
}

const uid = (p: string) =>
  `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

export default function MenuForm({
  initial,
  onSave,
  onCancel,
  showCancel,
}: MenuFormProps) {
  const ingredients = useAppStore((s) => s.ingredients);
  const recipes = useAppStore((s) => s.recipes);
  const packages = useAppStore((s) => s.packages);
  const setting = useAppStore((s) => s.setting);

  const [name, setName] = useState(initial?.name ?? "");
  const [selling, setSelling] = useState(
    initial ? String(initial.selling_price) : "0",
  );
  const [ingRows, setIngRows] = useState<MenuComponent[]>(
    initial ? initial.ingredients.map((c) => ({ ...c, id: c.id || uid("cmp") })) : [],
  );
  const [recRows, setRecRows] = useState<MenuComponent[]>(
    initial ? initial.recipes.map((c) => ({ ...c, id: c.id || uid("cmp") })) : [],
  );
  const [pkgRows, setPkgRows] = useState<MenuComponent[]>(
    initial ? initial.packages.map((c) => ({ ...c, id: c.id || uid("cmp") })) : [],
  );

  // which tab is active in the "Add Component" section
  const [addTab, setAddTab] = useState<ComponentBucket>("ingredient");

  // --- option lists ---
  const availableIngredients = useMemo(
    () => ingredients.filter((i) => !i.recipe_id),
    [ingredients],
  );
  const availableRecipes = useMemo(
    () => recipes.filter((r) => r.type !== "INGREDIENT"),
    [recipes],
  );

  const ingOptions = useMemo(
    () =>
      availableIngredients.map((i) => ({
        value: i.id,
        label: i.name,
        subLabel: `${fmt(i.purchase_quantity, 2)} ${i.purchase_unit} • ${fmtTHB(i.purchase_price)}`,
        unit: i.purchase_unit as UsageUnit,
      })),
    [availableIngredients],
  );
  const recOptions = useMemo(
    () =>
      availableRecipes.map((r) => ({
        value: r.id,
        label: r.name,
        subLabel: `Recipe • ${r.ingredients.length} ingredients`,
        unit: (r.serving_unit || "piece") as UsageUnit,
      })),
    [availableRecipes],
  );
  const pkgOptions = useMemo(
    () =>
      packages.map((p) => ({
        value: p.id,
        label: p.name,
        subLabel: `${fmt(p.purchase_quantity, 2)} ${p.purchase_unit} • ${fmtTHB(p.purchase_price)}`,
        unit: p.purchase_unit as UsageUnit,
      })),
    [packages],
  );

  const visibleIngOptions = useMemo(
    () => ingOptions.filter((o) => !ingRows.some((r) => r.target_id === o.value)),
    [ingOptions, ingRows],
  );
  const visibleRecOptions = useMemo(
    () => recOptions.filter((o) => !recRows.some((r) => r.target_id === o.value)),
    [recOptions, recRows],
  );
  const visiblePkgOptions = useMemo(
    () => pkgOptions.filter((o) => !pkgRows.some((r) => r.target_id === o.value)),
    [pkgOptions, pkgRows],
  );

  // --- add / update / remove ---
  const addIngredient = (id: string) => {
    if (!id) return;
    const opt = ingOptions.find((o) => o.value === id);
    if (!opt) return;
    setIngRows((prev) => [
      ...prev,
      newMenuComponent(id, opt.unit),
    ]);
  };
  const addRecipeComp = (id: string) => {
    if (!id) return;
    const opt = recOptions.find((o) => o.value === id);
    if (!opt) return;
    setRecRows((prev) => [
      ...prev,
      newMenuComponent(id, opt.unit),
    ]);
  };
  const addPackage = (id: string) => {
    if (!id) return;
    const opt = pkgOptions.find((o) => o.value === id);
    if (!opt) return;
    setPkgRows((prev) => [
      ...prev,
      newMenuComponent(id, opt.unit),
    ]);
  };

  const updateIng = (idx: number, patch: Partial<MenuComponent>) =>
    setIngRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const updateRec = (idx: number, patch: Partial<MenuComponent>) =>
    setRecRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const updatePkg = (idx: number, patch: Partial<MenuComponent>) =>
    setPkgRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  const removeIng = (idx: number) =>
    setIngRows((prev) => prev.filter((_, i) => i !== idx));
  const removeRec = (idx: number) =>
    setRecRows((prev) => prev.filter((_, i) => i !== idx));
  const removePkg = (idx: number) => {
    setPkgRows(pkgRows.filter((_, i) => i !== idx));
  };

  const moveItem = <T,>(arr: T[], idx: number, dir: "up" | "down"): T[] => {
    const next = [...arr];
    if (dir === "up" && idx > 0) {
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    } else if (dir === "down" && idx < next.length - 1) {
      [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
    }
    return next;
  }; // --- computed preview ---
  // For the live preview, recompute every row's actual_price on the fly so
  // the numbers update instantly as the user types. This is independent of
  // what's stored on each component (which is the persisted truth).
  const previewIngRows = useMemo(
    () => refreshComponentActualPrices(ingRows, ingredients, recipes, packages, setting),
    [ingRows, ingredients, recipes, packages, setting],
  );
  const previewRecRows = useMemo(
    () => refreshComponentActualPrices(recRows, ingredients, recipes, packages, setting),
    [recRows, ingredients, recipes, packages, setting],
  );
  const previewPkgRows = useMemo(
    () => refreshComponentActualPrices(pkgRows, ingredients, recipes, packages, setting),
    [pkgRows, ingredients, recipes, packages, setting],
  );

  const previewMenu: Menu = useMemo(
    () => ({
      id: "preview",
      name,
      cost_price: 0,
      selling_price: Number(selling) || 0,
      ingredients: previewIngRows,
      recipes: previewRecRows,
      packages: previewPkgRows,
    }),
    [name, selling, previewIngRows, previewRecRows, previewPkgRows],
  );

  const previewCost = useMemo(
    () => computeMenuCost(previewMenu),
    [previewMenu],
  );

  const previewPrices = useMemo(
    () =>
      computePlatformPrices(
        { ...previewMenu, cost_price: previewCost },
        setting,
      ),
    [previewMenu, previewCost, setting],
  );

  const profit = (Number(selling) || 0) - previewCost;
  const margin =
    (Number(selling) || 0) > 0 ? (profit / (Number(selling) || 0)) * 100 : 0;

  // --- save ---
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      alert("Menu name is required");
      return;
    }
    // Persist the latest actual_price on every component so the stored cost
    // aggregates faithfully from `actual_price` sums.
    const ing = refreshComponentActualPrices(ingRows, ingredients, recipes, packages, setting);
    const rec = refreshComponentActualPrices(recRows, ingredients, recipes, packages, setting);
    const pkg = refreshComponentActualPrices(pkgRows, ingredients, recipes, packages, setting);
    onSave({
      name: trimmed,
      selling_price: Number(selling) || 0,
      ingredients: ing,
      recipes: rec,
      packages: pkg,
    });
    if (!initial) {
      setName("");
      setSelling("0");
      setIngRows([]);
      setRecRows([]);
      setPkgRows([]);
    }
  };

  const handleReset = () => {
    if (initial) {
      setName(initial.name);
      setSelling(String(initial.selling_price));
      setIngRows(initial.ingredients.map((c) => ({ ...c, id: c.id || uid("cmp") })));
      setRecRows(initial.recipes.map((c) => ({ ...c, id: c.id || uid("cmp") })));
      setPkgRows(initial.packages.map((c) => ({ ...c, id: c.id || uid("cmp") })));
    } else {
      setName("");
      setSelling("0");
      setIngRows([]);
      setRecRows([]);
      setPkgRows([]);
    }
  };

  // build lookup for component names
  const targetName = (targetId: string) => {
    const i = ingredients.find((x) => x.id === targetId);
    if (i) return i.name;
    const r = recipes.find((x) => x.id === targetId);
    if (r) return r.name;
    const p = packages.find((x) => x.id === targetId);
    if (p) return p.name;
    return "(removed)";
  };

  return (
    <form onSubmit={handleSubmit} className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
          <UtensilsCrossed className="w-4 h-4" />
        </div>
        <h2 className="text-base font-semibold text-slate-800">
          {initial ? "Edit Menu" : "New Menu"}
        </h2>
        {initial && (
          <span className="badge bg-amber-50 text-amber-700 border border-amber-200 ml-1">
            Editing
          </span>
        )}
      </div>

      {/* Name + selling price */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div className="md:col-span-2">
          <label className="label">Menu Name</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Pad Kra Pao with Rice"
          />
        </div>
        <div>
          <label className="label">Selling Price (THB)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            className="input"
            value={selling}
            onChange={(e) => setSelling(e.target.value)}
          />
        </div>
      </div>

      {/* Live price overview */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 mb-4">
        <StatBlock label="Food Cost" value={fmtTHB(previewCost)} tone="indigo" />
        <StatBlock
          label="Cost + Overhead"
          value={fmtTHB(previewPrices.costWithOverhead)}
          tone="amber"
        />
        <StatBlock
          label="Target Price"
          value={fmtTHB(previewPrices.targetSelling)}
          vatValue={previewPrices.vatTarget}
          tone="emerald"
        />
        <StatBlock
          label="Actual Price"
          value={fmtTHB(Number(selling) || 0)}
          vatValue={previewPrices.vatActual}
          tone="slate"
        />
        <StatBlock
          label="Profit / Margin"
          value={`${fmtTHB(profit)} / ${fmtPct(margin)}`}
          tone={profit >= 0 ? "sky" : "rose"}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 mb-5">
        <StatBlock
          label="Lineman"
          value={fmtTHB(previewPrices.lineman)}
          vatValue={previewPrices.vatLineman}
          tone="rose"
        />
        <StatBlock
          label="Grab"
          value={fmtTHB(previewPrices.grab)}
          vatValue={previewPrices.vatGrab}
          tone="rose"
        />
        <StatBlock
          label="Shopee Food"
          value={fmtTHB(previewPrices.shopeeFood)}
          vatValue={previewPrices.vatShopee}
          tone="rose"
        />
      </div>

      {/* Add Component section with 3 dedicated paths. No `overflow-hidden`
          so the SearchableSelect dropdowns can float above the form. */}
      <div className="border border-slate-200 rounded-xl mb-4">
        <div className="px-4 py-3 bg-slate-50/70 border-b border-slate-200 rounded-t-xl flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
            Add Component
          </span>
          <div className="ml-auto">
            <SegmentedControl
              size="sm"
              value={addTab}
              onChange={(val) => setAddTab(val as ComponentBucket)}
              options={[
                {
                  value: "ingredient",
                  label: "Ingredient",
                  icon: <Layers className="w-3.5 h-3.5" />,
                  count: ingRows.length,
                },
                {
                  value: "recipe",
                  label: "Recipe",
                  icon: <ChefHat className="w-3.5 h-3.5" />,
                  count: recRows.length,
                },
                {
                  value: "package",
                  label: "Package",
                  icon: <PackageIcon className="w-3.5 h-3.5" />,
                  count: pkgRows.length,
                },
              ]}
            />
          </div>
        </div>

        <div className="relative p-3 rounded-b-xl">
          {/* Ingredient path */}
          {addTab === "ingredient" && (
            <div>
              {availableIngredients.length === 0 ? (
                <EmptyState
                  title="No ingredients available"
                  description="Add items to the Ingredients tab first, then come back here to compose your menu."
                />
              ) : (
                <SearchableSelect
                  value=""
                  onChange={addIngredient}
                  options={visibleIngOptions}
                  placeholder="Search and pick an ingredient to add…"
                  emptyMessage="All available ingredients already added"
                />
              )}
            </div>
          )}

          {/* Recipe path */}
          {addTab === "recipe" && (
            <div>
              {availableRecipes.length === 0 ? (
                <EmptyState
                  title="No recipes available"
                  description="Create recipes first (other than Sub-Ingredient types), then come back to add them to menus."
                />
              ) : (
                <SearchableSelect
                  value=""
                  onChange={addRecipeComp}
                  options={visibleRecOptions}
                  placeholder="Search and pick a recipe to add…"
                  emptyMessage="All available recipes already added"
                />
              )}
            </div>
          )}

          {/* Package path */}
          {addTab === "package" && (
            <div>
              {packages.length === 0 ? (
                <EmptyState
                  title="No packages available"
                  description="Add packages (cups, boxes, bags) first, then come back to compose your menu."
                />
              ) : (
                <SearchableSelect
                  value=""
                  onChange={addPackage}
                  options={visiblePkgOptions}
                  placeholder="Search and pick a package to add…"
                  emptyMessage="All available packages already added"
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Components list — no `overflow-hidden` so dropdowns can escape */}
      <div className="border border-slate-200 rounded-xl mb-4">
        <ComponentList
          title="Ingredients"
          icon={<Layers className="w-3.5 h-3.5" />}
          items={previewIngRows}
          nameLookup={targetName}
          costLookup={(c) => c.actual_price}
          unitCostLookup={(c) => computeMenuComponentActual({ ...c, usage_quantity: 1 }, ingredients, recipes, packages, setting)}
          onUpdate={updateIng}
          onRemove={removeIng}
          onMove={(idx, dir) => setIngRows((prev) => moveItem(prev, idx, dir))}
        />
        <ComponentList
          title="Recipes"
          icon={<ChefHat className="w-3.5 h-3.5" />}
          items={previewRecRows}
          nameLookup={targetName}
          costLookup={(c) => c.actual_price}
          unitCostLookup={(c) => computeMenuComponentActual({ ...c, usage_quantity: 1 }, ingredients, recipes, packages, setting)}
          onUpdate={updateRec}
          onRemove={removeRec}
          onMove={(idx, dir) => setRecRows((prev) => moveItem(prev, idx, dir))}
        />
        <ComponentList
          title="Packages"
          icon={<PackageIcon className="w-3.5 h-3.5" />}
          items={previewPkgRows}
          nameLookup={targetName}
          costLookup={(c) => c.actual_price}
          unitCostLookup={(c) => computeMenuComponentActual({ ...c, usage_quantity: 1 }, ingredients, recipes, packages, setting)}
          onUpdate={updatePkg}
          onRemove={removePkg}
          onMove={(idx, dir) => setPkgRows((prev) => moveItem(prev, idx, dir))}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" className="btn-primary">
          {initial ? (
            <>
              <Save className="w-4 h-4" /> Save Changes
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" /> Add Menu
            </>
          )}
        </button>
        {showCancel && onCancel && (
          <button type="button" onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
        )}
        <button type="button" onClick={handleReset} className="btn-ghost">
          <RotateCcw className="w-4 h-4" />
          {initial ? "Revert" : "Clear"}
        </button>
      </div>
    </form>
  );
}

function StatBlock({
  label,
  value,
  vatValue,
  tone = "indigo",
}: {
  label: string;
  value: string;
  vatValue?: number | null;
  tone?: "indigo" | "emerald" | "amber" | "rose" | "slate" | "sky";
}) {
  const tones: Record<string, string> = {
    indigo: "from-indigo-500 to-indigo-600",
    emerald: "from-emerald-500 to-emerald-600",
    amber: "from-amber-500 to-amber-600",
    rose: "from-rose-500 to-rose-600",
    slate: "from-slate-500 to-slate-600",
    sky: "from-sky-500 to-sky-600",
  };
  return (
    <div className="card p-3 border-slate-200">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className="flex items-baseline gap-1.5 mt-1 flex-wrap">
        <span
          className={`text-base font-bold bg-gradient-to-br ${tones[tone]} bg-clip-text text-transparent`}
        >
          {value}
        </span>
        {vatValue !== undefined && vatValue !== null && (
          <span className="badge bg-slate-100 text-slate-600 border border-slate-200">
            +VAT {fmtTHB(vatValue)}
          </span>
        )}
      </div>
    </div>
  );
}

interface ComponentListProps {
  title: string;
  icon: React.ReactNode;
  items: MenuComponent[];
  nameLookup: (id: string) => string;
  costLookup: (comp: MenuComponent) => number;
  unitCostLookup: (comp: MenuComponent) => number;
  onUpdate: (idx: number, patch: Partial<MenuComponent>) => void;
  onRemove: (idx: number) => void;
  onMove: (idx: number, dir: "up" | "down") => void;
}

function ComponentList({
  title,
  icon,
  items,
  nameLookup,
  costLookup,
  unitCostLookup,
  onUpdate,
  onRemove,
  onMove,
}: ComponentListProps) {
  return (
    <div className="border-t border-slate-200 first:border-t-0">
      <div className="px-4 py-2 bg-slate-50/40 text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
        {icon}
        {title} <span className="text-slate-400">({items.length})</span>
      </div>
      {items.length === 0 ? (
        <div className="px-4 py-3 text-sm text-slate-400 italic">None added</div>
      ) : (
        <div className="divide-y divide-slate-100">
          {items.map((c, idx) => {
            const subtotalCost = costLookup(c);
            const qty = c.usage_quantity || 0;
            const costPerUnit = qty > 0 ? subtotalCost / qty : unitCostLookup(c);
            return (
              <div
                key={c.id}
                className="grid grid-cols-12 gap-2 items-start px-3 py-2.5"
              >
                <div className="col-span-12 md:col-span-2">
                  <label className="md:hidden text-[10px] uppercase text-slate-400">Name</label>
                  <div className="text-sm font-medium text-slate-800 truncate py-2">
                    {nameLookup(c.target_id)}
                  </div>
                </div>
                <div className="col-span-4 md:col-span-2">
                  <label className="text-[10px] uppercase text-slate-400">Qty</label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    className="input"
                    value={c.usage_quantity}
                    onChange={(e) =>
                      onUpdate(idx, { usage_quantity: Number(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="col-span-4 md:col-span-1">
                  <label className="text-[10px] uppercase text-slate-400">Unit</label>
                  <select
                    className="input"
                    value={c.usage_unit}
                    onChange={(e) =>
                      onUpdate(idx, { usage_unit: e.target.value as UsageUnit })
                    }
                  >
                    {USAGE_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-4 md:col-span-2">
                  <label className="text-[10px] uppercase text-slate-400">Yield (%)</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="1"
                      min="1"
                      max="100"
                      className="input pr-7"
                      value={c.yield}
                      onChange={(e) =>
                        onUpdate(idx, { yield: Number(e.target.value) || 0 })
                      }
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">
                      %
                    </span>
                  </div>
                </div>
                <div className="col-span-5 md:col-span-2 text-right">
                  <div className="text-[10px] uppercase text-slate-400">Cost per Unit</div>
                  <div className="text-sm font-semibold text-slate-600 mt-1.5">
                    {fmtTHB(costPerUnit)}
                  </div>
                </div>
                <div className="col-span-5 md:col-span-2 text-right">
                  <div className="text-[10px] uppercase text-slate-400">Subtotal Cost</div>
                  <div className="text-sm font-semibold text-indigo-600 mt-1.5">
                    {fmtTHB(qty > 0 ? subtotalCost : 0)}
                  </div>
                </div>
                <div className="col-span-2 md:col-span-1 flex flex-col items-end gap-1 pt-1">
                  <button
                    type="button"
                    onClick={() => onRemove(idx)}
                    className="p-1.5 rounded-md text-slate-500 hover:text-rose-600 hover:bg-rose-50"
                    title="Remove"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => onMove(idx, "up")}
                      disabled={idx === 0}
                      className="p-1 rounded text-slate-400 hover:text-indigo-600 disabled:opacity-30"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onMove(idx, "down")}
                      disabled={idx === items.length - 1}
                      className="p-1 rounded text-slate-400 hover:text-indigo-600 disabled:opacity-30"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
