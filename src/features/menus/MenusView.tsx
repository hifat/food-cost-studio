import { useState, useMemo, useRef } from "react";
import {
  Pencil,
  Trash2,
  BarChart3,
  TrendingUp,
  TrendingDown,
  UtensilsCrossed,
} from "lucide-react";
import { useAppStore } from "../../store";
import type { Menu } from "../../types";
import {
  fmt,
  fmtTHB,
  fmtPct,
  toNumber,
  round2,
  computeMenuComponentActual,
  computeMenuProfit,
  computePlatformPrices,
} from "../../utils/calc";
import Modal from "../../components/Modal";
import SearchInput from "../../components/SearchInput";
import PageHeader from "../../components/PageHeader";
import EmptyState from "../../components/EmptyState";
import MenuForm from "./MenuForm";

export default function MenusView() {
  const menus = useAppStore((s) => s.menus);
  const ingredients = useAppStore((s) => s.ingredients);
  const recipes = useAppStore((s) => s.recipes);
  const packages = useAppStore((s) => s.packages);
  const setting = useAppStore((s) => s.setting);
  const addMenu = useAppStore((s) => s.addMenu);
  const updateMenu = useAppStore((s) => s.updateMenu);
  const deleteMenu = useAppStore((s) => s.deleteMenu);

  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Menu | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Menu | null>(null);
  const [overview, setOverview] = useState<Menu | null>(null);
  const formAnchorRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? menus.filter((m) => m.name.toLowerCase().includes(q))
      : menus;
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [menus, query]);

  const handleSave = (data: Omit<Menu, "id" | "cost_price">) => {
    if (editing) {
      updateMenu(editing.id, data);
      setEditing(null);
    } else {
      addMenu(data);
    }
  };

  const handleEdit = (m: Menu) => {
    setEditing(m);
    requestAnimationFrame(() => {
      formAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const handleCancelEdit = () => {
    setEditing(null);
  };

  const handleDelete = (m: Menu) => {
    deleteMenu(m.id);
    if (editing?.id === m.id) setEditing(null);
    setConfirmDelete(null);
  };

  return (
    <div>
      <PageHeader
        title="Menus"
        description="Build menu items by composing ingredients, recipes, and packages. Get instant pricing for storefront and delivery platforms."
      />

      {/* Inline form (anchor for edit-scroll). The `key` prop forces a remount
          whenever the user opens a different menu for editing, ensuring the
          form's internal state re-initializes from the new `initial` prop. */}
      <div ref={formAnchorRef} className="mb-5">
        <MenuForm
          key={editing?.id ?? "__new__"}
          initial={editing}
          onSave={handleSave}
          onCancel={handleCancelEdit}
          showCancel={!!editing}
        />
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/40 flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <UtensilsCrossed className="w-4 h-4 text-indigo-500" />
            Menus
          </h2>
          <div className="ml-auto flex items-center gap-2">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Search menus…"
              className="w-full sm:w-64"
            />
            <div className="text-xs text-slate-500 whitespace-nowrap">
              {filtered.length} of {menus.length}
            </div>
          </div>
        </div>

        {menus.length === 0 ? (
          <EmptyState
            title="No menus yet"
            description="Create your first menu item using the form above to compute cost, profit, and delivery platform prices."
            icon={<BarChart3 className="w-7 h-7" />}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No menus match your search"
            description="Try a different search term."
          />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="table-th w-12">No.</th>
                  <th className="table-th">Menu Name</th>
                  <th className="table-th text-right">Cost Price</th>
                  <th className="table-th text-right">Selling Price</th>
                  <th className="table-th text-right">Profit (THB)</th>
                  <th className="table-th text-right">Margin %</th>
                  <th className="table-th w-44 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m, idx) => {
                  const { profit, margin } = computeMenuProfit(m);
                  const positive = profit >= 0;
                  return (
                    <tr
                      key={m.id}
                      className={`hover:bg-slate-50/60 transition ${editing?.id === m.id ? "bg-indigo-50/50" : ""
                        }`}
                    >
                      <td className="table-td text-slate-500">{idx + 1}</td>
                      <td className="table-td font-medium text-slate-800">{m.name}</td>
                      <td className="table-td text-right text-slate-700">
                        {fmtTHB(m.cost_price)}
                      </td>
                      <td className="table-td text-right font-medium text-slate-800">
                        {fmtTHB(m.selling_price)}
                      </td>
                      <td
                        className={`table-td text-right font-semibold ${positive ? "text-emerald-600" : "text-rose-600"
                          }`}
                      >
                        <span className="inline-flex items-center gap-1">
                          {positive ? (
                            <TrendingUp className="w-3.5 h-3.5" />
                          ) : (
                            <TrendingDown className="w-3.5 h-3.5" />
                          )}
                          {fmtTHB(profit)}
                        </span>
                      </td>
                      <td
                        className={`table-td text-right ${positive ? "text-emerald-600" : "text-rose-600"
                          }`}
                      >
                        {fmtPct(margin)}
                      </td>
                      <td className="table-td text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => setOverview(m)}
                            className="p-1.5 rounded-md text-indigo-600 hover:bg-indigo-50"
                            title="Overview"
                          >
                            <BarChart3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEdit(m)}
                            className="p-1.5 rounded-md text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setConfirmDelete(m)}
                            className="p-1.5 rounded-md text-slate-500 hover:text-rose-600 hover:bg-rose-50"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Overview Modal */}
      <OverviewModal
        menu={overview}
        ingredients={ingredients}
        recipes={recipes}
        packages={packages}
        setting={setting}
        onClose={() => setOverview(null)}
      />

      {/* Delete confirmation */}
      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete Menu"
        size="sm"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setConfirmDelete(null)}>
              Cancel
            </button>
            <button
              className="btn-danger"
              onClick={() => confirmDelete && handleDelete(confirmDelete)}
            >
              Delete
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          Are you sure you want to delete <strong>{confirmDelete?.name}</strong>?
        </p>
      </Modal>
    </div>
  );
}

// ----- Overview Modal -----

interface OverviewModalProps {
  menu: Menu | null;
  ingredients: ReturnType<typeof useAppStore.getState>["ingredients"];
  recipes: ReturnType<typeof useAppStore.getState>["recipes"];
  packages: ReturnType<typeof useAppStore.getState>["packages"];
  setting: ReturnType<typeof useAppStore.getState>["setting"];
  onClose: () => void;
}

function OverviewModal({
  menu,
  ingredients,
  recipes,
  packages,
  setting,
  onClose,
}: OverviewModalProps) {
  if (!menu) {
    return (
      <Modal open={false} onClose={onClose} title="Menu Overview" size="lg">
        <div />
      </Modal>
    );
  }

  const allComponents = [
    ...menu.ingredients.map((c) => ({ c, kind: "ingredient" as const })),
    ...menu.recipes.map((c) => ({ c, kind: "recipe" as const })),
    ...menu.packages.map((c) => ({ c, kind: "package" as const })),
  ];

  // Food Cost = sum of all component actual_price values across all three buckets
  const baseFoodCost = round2(
    allComponents.reduce((sum, { c }) => sum + toNumber(c.actual_price, 0), 0),
  );

  const prices = useMemo(
    () => computePlatformPrices(menu, setting, baseFoodCost),
    [menu, setting, baseFoodCost],
  );

  // Safe fallbacks: when `prices` is null (no menu), every value degrades to 0.
  const safePrices: NonNullable<typeof prices> = prices ?? {
    costWithOverhead: 0,
    targetSelling: 0,
    lineman: 0,
    grab: 0,
    shopeeFood: 0,
    vatFoodCost: 0,
    vatTarget: 0,
    vatActual: 0,
    vatLineman: 0,
    vatGrab: 0,
    vatShopee: 0,
  };

  return (
    <Modal
      open={!!menu}
      onClose={onClose}
      title={`Overview · ${menu.name}`}
      subtitle="Cost breakdown, target prices, and delivery platform recommendations."
      size="xl"
    >
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
        <PriceBlock
          label="Food Cost"
          value={baseFoodCost}
          vatValue={safePrices.vatFoodCost}
          tone="indigo"
        />
        <PriceBlock
          label="Target Selling Price"
          value={safePrices.targetSelling}
          vatValue={safePrices.vatTarget}
          tone="emerald"
          hint={`Based on ${setting.food_cost_percentage}% food cost`}
        />
        <PriceBlock
          label="Actual Selling Price"
          value={toNumber(menu.selling_price, 0)}
          vatValue={safePrices.vatActual}
          tone="slate"
        />
        <PriceBlock
          label="Lineman Price"
          value={safePrices.lineman}
          vatValue={safePrices.vatLineman}
          tone="rose"
          hint={`GP ${setting.lineman_gp_percentage}%`}
        />
        <PriceBlock
          label="Grab Price"
          value={safePrices.grab}
          vatValue={safePrices.vatGrab}
          tone="rose"
          hint={`GP ${setting.grab_gp_percentage}%`}
        />
        <PriceBlock
          label="Shopee Food Price"
          value={safePrices.shopeeFood}
          vatValue={safePrices.vatShopee}
          tone="rose"
          hint={`GP ${setting.shopee_food_gp_percentage}%`}
        />
      </div>

      <h3 className="text-sm font-semibold text-slate-700 mb-2">Component Breakdown</h3>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="min-w-full">
            <thead>
              <tr>
                <th className="table-th w-12">No.</th>
                <th className="table-th">Component Name</th>
                <th className="table-th">Type</th>
                <th className="table-th text-right">Usage Qty</th>
                <th className="table-th">Unit</th>
                <th className="table-th text-right">Cost per Unit</th>
                <th className="table-th text-right">Subtotal Cost</th>
              </tr>
            </thead>
            <tbody>
              {allComponents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="table-td text-center text-slate-400">
                    No components
                  </td>
                </tr>
              ) : (
                allComponents.map(({ c, kind }, idx) => {
                  const ing = ingredients.find((x) => x.id === c.target_id);
                  const rec = recipes.find((x) => x.id === c.target_id);
                  const pkg = packages.find((x) => x.id === c.target_id);
                  const name = ing?.name || rec?.name || pkg?.name || "(removed)";
                  // Prefer the stored actual_price; fall back to a live recompute
                  // so the breakdown is never empty if a component slipped
                  // through without a denormalized price.
                  const subtotalCost =
                    toNumber(c.actual_price, 0) > 0
                      ? toNumber(c.actual_price, 0)
                      : computeMenuComponentActual(c, ingredients, recipes, packages, setting);
                  const qty = c.usage_quantity || 0;
                  const costPerUnit = qty > 0 ? subtotalCost / qty : computeMenuComponentActual({ ...c, usage_quantity: 1 }, ingredients, recipes, packages, setting);

                  return (
                    <tr key={c.id} className="hover:bg-slate-50/60">
                      <td className="table-td text-slate-500">{idx + 1}</td>
                      <td className="table-td font-medium text-slate-800">{name}</td>
                      <td className="table-td">
                        <span className="badge bg-slate-100 text-slate-700 border border-slate-200">
                          {kind}
                        </span>
                      </td>
                      <td className="table-td text-right">{fmt(c.usage_quantity, 2)}</td>
                      <td className="table-td">{c.usage_unit}</td>
                      <td className="table-td text-right text-slate-600">
                        {fmtTHB(costPerUnit)}
                      </td>
                      <td className="table-td text-right font-semibold text-indigo-600">
                        {fmtTHB(qty > 0 ? subtotalCost : 0)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50/60">
                <td colSpan={6} className="table-td text-right font-semibold text-slate-700">
                  Total Cost Price (Base)
                </td>
                <td className="table-td text-right font-bold text-emerald-600">
                  {fmtTHB(baseFoodCost)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </Modal>
  );
}

function PriceBlock({
  label,
  value,
  vatValue,
  tone = "indigo",
  hint,
}: {
  label: string;
  value: number;
  vatValue: number | null;
  tone?: "indigo" | "emerald" | "amber" | "rose" | "slate";
  hint?: string;
}) {
  const tones: Record<string, string> = {
    indigo: "from-indigo-500 to-indigo-600",
    emerald: "from-emerald-500 to-emerald-600",
    amber: "from-amber-500 to-amber-600",
    rose: "from-rose-500 to-rose-600",
    slate: "from-slate-500 to-slate-600",
  };
  return (
    <div className="card p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className="flex items-baseline gap-2 mt-1">
        <span
          className={`text-lg font-bold bg-gradient-to-br ${tones[tone]} bg-clip-text text-transparent`}
        >
          {fmtTHB(value)}
        </span>
        {vatValue !== null && (
          <span className="badge bg-slate-100 text-slate-600 border border-slate-200">
            +VAT {fmtTHB(vatValue)}
          </span>
        )}
      </div>
      {hint && <div className="text-[10px] text-slate-400 mt-1">{hint}</div>}
    </div>
  );
}
