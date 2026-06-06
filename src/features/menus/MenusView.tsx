import { useState, useMemo } from "react";
import { Pencil, Trash2, Plus, X, BarChart3, Search, TrendingUp, TrendingDown } from "lucide-react";
import {
  useAppStore,
  newMenuComponent,
} from "../../store";
import type {
  Menu,
  MenuComponent,
  UsageUnit,
} from "../../types";
import { USAGE_UNITS } from "../../types";
import {
  fmt,
  fmtTHB,
  fmtPct,
  computeMenuCost,
  computeMenuComponentActual,
  computeMenuProfit,
  computePlatformPrices,
  costPerPurchaseUnit,
} from "../../utils/calc";
import Modal from "../../components/Modal";
import SearchInput from "../../components/SearchInput";
import PageHeader from "../../components/PageHeader";
import EmptyState from "../../components/EmptyState";
import SearchableSelect from "../../components/SearchableSelect";

type TargetKind = "ingredient" | "recipe" | "package";

interface FormState {
  name: string;
  selling_price: string;
  ingredients: MenuComponent[];
  recipes: MenuComponent[];
  packages: MenuComponent[];
}

const emptyForm: FormState = {
  name: "",
  selling_price: "0",
  ingredients: [],
  recipes: [],
  packages: [],
};

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
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formOpen, setFormOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Menu | null>(null);
  const [overview, setOverview] = useState<Menu | null>(null);
  const [targetSearch, setTargetSearch] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? menus.filter((m) => m.name.toLowerCase().includes(q))
      : menus;
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [menus, query]);

  // -------- form helpers ----------

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
    setTargetSearch("");
  };

  const openEdit = (m: Menu) => {
    setEditing(m);
    setForm({
      name: m.name,
      selling_price: String(m.selling_price),
      ingredients: [...m.ingredients],
      recipes: [...m.recipes],
      packages: [...m.packages],
    });
    setFormOpen(true);
    setTargetSearch("");
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
    setForm(emptyForm);
  };

  // Build unified target options
  const allTargets = useMemo(() => {
    const opts: { value: string; label: string; subLabel: string; kind: TargetKind; unit: UsageUnit }[] = [];

    ingredients
      .filter((i) => !i.recipe_id)
      .forEach((i) =>
        opts.push({
          value: `ing:${i.id}`,
          label: i.name,
          subLabel: `Ingredient • ${fmt(i.purchase_quantity, 2)} ${i.purchase_unit} • ${fmtTHB(i.purchase_price)}`,
          kind: "ingredient",
          unit: i.purchase_unit,
        }),
      );
    recipes
      .filter((r) => r.type !== "INGREDIENT")
      .forEach((r) =>
        opts.push({
          value: `rec:${r.id}`,
          label: r.name,
          subLabel: `Recipe • ${r.ingredients.length} ingredients • ${fmtTHB(computeMenuCostForRecipe(r, ingredients))}`,
          kind: "recipe",
          unit: "piece",
        }),
      );
    packages.forEach((p) =>
      opts.push({
        value: `pkg:${p.id}`,
        label: p.name,
        subLabel: `Package • ${fmt(p.purchase_quantity, 2)} ${p.purchase_unit} • ${fmtTHB(p.purchase_price)}`,
        kind: "package",
        unit: p.purchase_unit,
      }),
    );
    return opts;
  }, [ingredients, recipes, packages]);

  const filteredTargets = useMemo(() => {
    const q = targetSearch.trim().toLowerCase();
    if (!q) return allTargets;
    return allTargets.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.subLabel.toLowerCase().includes(q),
    );
  }, [allTargets, targetSearch]);

  const addTarget = (val: string) => {
    if (!val) return;
    const [kind, id] = val.split(":");
    const opt = allTargets.find((o) => o.value === val);
    if (!opt) return;
    const comp = newMenuComponent(id, opt.unit);
    if (kind === "ing") {
      if (form.ingredients.some((c) => c.target_id === id)) return;
      setForm({ ...form, ingredients: [...form.ingredients, comp] });
    } else if (kind === "rec") {
      if (form.recipes.some((c) => c.target_id === id)) return;
      setForm({ ...form, recipes: [...form.recipes, comp] });
    } else if (kind === "pkg") {
      if (form.packages.some((c) => c.target_id === id)) return;
      setForm({ ...form, packages: [...form.packages, comp] });
    }
  };

  const updateComponent = (
    bucket: "ingredients" | "recipes" | "packages",
    idx: number,
    patch: Partial<MenuComponent>,
  ) => {
    const next = form[bucket].map((c, i) => (i === idx ? { ...c, ...patch } : c));
    setForm({ ...form, [bucket]: next });
  };

  const removeComponent = (
    bucket: "ingredients" | "recipes" | "packages",
    idx: number,
  ) => {
    setForm({
      ...form,
      [bucket]: form[bucket].filter((_, i) => i !== idx),
    });
  };

  const handleSave = () => {
    const name = form.name.trim();
    if (!name) {
      alert("Menu name is required");
      return;
    }
    const selling = Number(form.selling_price) || 0;
    const built: Omit<Menu, "id" | "cost_price"> = {
      name,
      selling_price: selling,
      ingredients: form.ingredients,
      recipes: form.recipes,
      packages: form.packages,
    };
    if (editing) {
      updateMenu(editing.id, built);
    } else {
      addMenu(built);
    }
    closeForm();
  };

  const handleDelete = (m: Menu) => {
    deleteMenu(m.id);
    setConfirmDelete(null);
  };

  // live preview cost
  const previewCost = useMemo(() => {
    return computeMenuCost(
      {
        id: "preview",
        name: form.name,
        cost_price: 0,
        selling_price: Number(form.selling_price) || 0,
        ingredients: form.ingredients,
        recipes: form.recipes,
        packages: form.packages,
      },
      ingredients,
      recipes,
      packages,
    );
  }, [form, ingredients, recipes, packages]);

  const previewPrices = useMemo(
    () =>
      computePlatformPrices(
        {
          id: "preview",
          name: "",
          cost_price: previewCost,
          selling_price: Number(form.selling_price) || 0,
          ingredients: [],
          recipes: [],
          packages: [],
        },
        setting,
      ),
    [previewCost, form.selling_price, setting],
  );

  return (
    <div>
      <PageHeader
        title="Menus"
        description="Build menu items by composing ingredients, recipes, and packages. Get instant pricing for storefront and delivery platforms."
        action={{ label: "Add Menu", onClick: openCreate, icon: <Plus className="w-4 h-4" /> }}
      />

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/40 flex flex-wrap items-center gap-3">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search menus…"
            className="w-full sm:w-72"
          />
          <div className="ml-auto text-xs text-slate-500">
            {filtered.length} of {menus.length} items
          </div>
        </div>

        {menus.length === 0 ? (
          <EmptyState
            title="No menus yet"
            description="Create your first menu item to compute cost, profit, and delivery platform prices."
            icon={<BarChart3 className="w-7 h-7" />}
            action={
              <button onClick={openCreate} className="btn-primary">
                <Plus className="w-4 h-4" /> Add Menu
              </button>
            }
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
                    <tr key={m.id} className="hover:bg-slate-50/60 transition">
                      <td className="table-td text-slate-500">{idx + 1}</td>
                      <td className="table-td font-medium text-slate-800">{m.name}</td>
                      <td className="table-td text-right text-slate-700">
                        {fmtTHB(m.cost_price)}
                      </td>
                      <td className="table-td text-right font-medium text-slate-800">
                        {fmtTHB(m.selling_price)}
                      </td>
                      <td className={`table-td text-right font-semibold ${positive ? "text-emerald-600" : "text-rose-600"}`}>
                        <span className="inline-flex items-center gap-1">
                          {positive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                          {fmtTHB(profit)}
                        </span>
                      </td>
                      <td className={`table-td text-right ${positive ? "text-emerald-600" : "text-rose-600"}`}>
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
                            onClick={() => openEdit(m)}
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

      {/* Create/Edit Modal */}
      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editing ? "Edit Menu" : "Add Menu"}
        subtitle="Compose your menu from ingredients, recipes, and packages."
        size="2xl"
        footer={
          <>
            <button className="btn-secondary" onClick={closeForm}>
              Cancel
            </button>
            <button className="btn-primary" onClick={handleSave}>
              {editing ? "Save Changes" : "Add Menu"}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          <div>
            <label className="label">Menu Name</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Pad Kra Pao with Rice"
              autoFocus
            />
          </div>
          <div>
            <label className="label">Selling Price (THB)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="input"
              value={form.selling_price}
              onChange={(e) => setForm({ ...form, selling_price: e.target.value })}
            />
          </div>
        </div>

        {/* Real-time overview panel */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
          <StatBlock label="Food Cost" value={fmtTHB(previewCost)} tone="indigo" />
          <StatBlock label="Cost + Overhead" value={fmtTHB(previewPrices.costWithOverhead)} tone="amber" />
          <StatBlock
            label="Target Price"
            value={fmtTHB(previewPrices.targetSelling)}
            vatValue={previewPrices.vatTarget}
            tone="emerald"
          />
          <StatBlock
            label="Actual Price"
            value={fmtTHB(Number(form.selling_price) || 0)}
            vatValue={previewPrices.vatActual}
            tone="slate"
          />
          <StatBlock
            label="Profit / Margin"
            value={`${fmtTHB((Number(form.selling_price) || 0) - previewCost)} / ${(Number(form.selling_price) || 0) > 0 ? fmtPct(((Number(form.selling_price) || 0) - previewCost) / (Number(form.selling_price) || 0) * 100) : "0.00%"}`}
            tone="sky"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
          <StatBlock label="Lineman" value={fmtTHB(previewPrices.lineman)} vatValue={previewPrices.vatLineman} tone="rose" />
          <StatBlock label="Grab" value={fmtTHB(previewPrices.grab)} vatValue={previewPrices.vatGrab} tone="rose" />
          <StatBlock label="Shopee Food" value={fmtTHB(previewPrices.shopeeFood)} vatValue={previewPrices.vatShopee} tone="rose" />
        </div>

        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-slate-50/70 border-b border-slate-200 flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-700">Components</h3>
            <div className="ml-auto flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-initial sm:w-72">
                <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                <input
                  className="w-full pl-8 pr-2 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                  placeholder="Search ingredients, recipes, packages…"
                  value={targetSearch}
                  onChange={(e) => setTargetSearch(e.target.value)}
                />
              </div>
            </div>
          </div>

          <ComponentTable
            title="Ingredients"
            bucket="ingredients"
            items={form.ingredients}
            ingredients={ingredients}
            recipes={recipes}
            packages={packages}
            onUpdate={(idx, patch) => updateComponent("ingredients", idx, patch)}
            onRemove={(idx) => removeComponent("ingredients", idx)}
          />
          <ComponentTable
            title="Recipes"
            bucket="recipes"
            items={form.recipes}
            ingredients={ingredients}
            recipes={recipes}
            packages={packages}
            onUpdate={(idx, patch) => updateComponent("recipes", idx, patch)}
            onRemove={(idx) => removeComponent("recipes", idx)}
          />
          <ComponentTable
            title="Packages"
            bucket="packages"
            items={form.packages}
            ingredients={ingredients}
            recipes={recipes}
            packages={packages}
            onUpdate={(idx, patch) => updateComponent("packages", idx, patch)}
            onRemove={(idx) => removeComponent("packages", idx)}
          />

          <div className="px-3 pb-3">
            <div className="text-xs text-slate-500 mb-1.5 font-semibold uppercase tracking-wide">
              Add Component
            </div>
            <SearchableSelect
              value=""
              onChange={addTarget}
              options={filteredTargets}
              placeholder="Pick an ingredient, recipe, or package…"
              emptyMessage="No matching components."
            />
          </div>
        </div>
      </Modal>

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
            <button className="btn-danger" onClick={() => confirmDelete && handleDelete(confirmDelete)}>
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

// ----- sub components -----

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
    <div className="card p-3">
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

interface ComponentTableProps {
  title: string;
  bucket: "ingredients" | "recipes" | "packages";
  items: MenuComponent[];
  ingredients: ReturnType<typeof useAppStore.getState>["ingredients"];
  recipes: ReturnType<typeof useAppStore.getState>["recipes"];
  packages: ReturnType<typeof useAppStore.getState>["packages"];
  onUpdate: (idx: number, patch: Partial<MenuComponent>) => void;
  onRemove: (idx: number) => void;
}

function ComponentTable({
  title,
  items,
  ingredients,
  recipes,
  packages,
  onUpdate,
  onRemove,
}: ComponentTableProps) {
  return (
    <div className="border-t border-slate-200">
      <div className="px-4 py-2 bg-slate-50/40 text-xs font-semibold uppercase tracking-wider text-slate-500">
        {title} ({items.length})
      </div>
      {items.length === 0 ? (
        <div className="px-4 py-3 text-sm text-slate-400">None</div>
      ) : (
        <div className="px-3 py-2 space-y-1.5">
          {items.map((c, idx) => {
            const name = lookupName(c.target_id, ingredients, recipes, packages, c);
            const cost = computeMenuComponentActual(c, ingredients, recipes, packages);
            return (
              <div
                key={c.id}
                className="grid grid-cols-12 gap-2 items-center p-2 rounded-lg bg-slate-50/60 border border-slate-200"
              >
                <div className="col-span-12 sm:col-span-3 text-sm font-medium text-slate-800 truncate">
                  {name}
                </div>
                <div className="col-span-3 sm:col-span-1 text-xs text-slate-500">No.</div>
                <div className="col-span-9 sm:col-span-2 text-sm text-slate-700">
                  {idx + 1}
                </div>
                <div className="col-span-3 sm:col-span-1 text-xs text-slate-500">Qty</div>
                <div className="col-span-9 sm:col-span-2">
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    className="input"
                    value={c.usage_quantity}
                    onChange={(e) => onUpdate(idx, { usage_quantity: Number(e.target.value) || 0 })}
                  />
                </div>
                <div className="col-span-3 sm:col-span-1 text-xs text-slate-500">Unit</div>
                <div className="col-span-9 sm:col-span-2">
                  <select
                    className="input"
                    value={c.usage_unit}
                    onChange={(e) => onUpdate(idx, { usage_unit: e.target.value as UsageUnit })}
                  >
                    {USAGE_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-6 sm:col-span-2 text-right">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">
                    Unit Cost
                  </div>
                  <div className="text-sm font-semibold text-indigo-600">
                    {fmtTHB(cost)}
                  </div>
                </div>
                <div className="col-span-6 sm:col-span-1 text-right">
                  <button
                    onClick={() => onRemove(idx)}
                    className="p-1.5 rounded-md text-slate-500 hover:text-rose-600 hover:bg-rose-50"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function lookupName(
  targetId: string,
  ingredients: ReturnType<typeof useAppStore.getState>["ingredients"],
  recipes: ReturnType<typeof useAppStore.getState>["recipes"],
  packages: ReturnType<typeof useAppStore.getState>["packages"],
  component?: MenuComponent,
): string {
  const i = ingredients.find((x) => x.id === targetId);
  if (i) return i.name;
  const r = recipes.find((x) => x.id === targetId);
  if (r) return r.name;
  const p = packages.find((x) => x.id === targetId);
  if (p) return p.name;
  void component;
  return "(removed)";
}

function computeMenuCostForRecipe(
  recipe: import("../../types").Recipe,
  ingredients: ReturnType<typeof useAppStore.getState>["ingredients"],
): number {
  return recipe.ingredients.reduce(
    (sum, ri) =>
      sum +
      (() => {
        const ing = ingredients.find((x) => x.id === ri.ingredient_id);
        if (!ing || ing.purchase_quantity <= 0) return 0;
        const cpu = ing.purchase_price / ing.purchase_quantity;
        const conv = (() => {
          if (ri.usage_unit === ing.purchase_unit) return ri.usage_quantity;
          if (ri.usage_unit === "kg" && ing.purchase_unit === "gram") return ri.usage_quantity * 1000;
          if (ri.usage_unit === "gram" && ing.purchase_unit === "kg") return ri.usage_quantity / 1000;
          if (
            (ri.usage_unit === "ml" || ri.usage_unit === "gram" || ri.usage_unit === "piece") &&
            (ing.purchase_unit === "ml" || ing.purchase_unit === "gram" || ing.purchase_unit === "piece")
          )
            return ri.usage_quantity;
          return 0;
        })();
        const raw = conv * cpu;
        const y = (ri.yield || 100) / 100;
        return y === 0 ? raw : raw / y;
      })(),
    0,
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
  const prices = useMemo(
    () => (menu ? computePlatformPrices(menu, setting) : null),
    [menu, setting],
  );

  if (!menu || !prices) {
    return (
      <Modal open={!!menu} onClose={onClose} title="Menu Overview" size="lg">
        <div className="text-sm text-slate-500">No data.</div>
      </Modal>
    );
  }

  const allComponents = [
    ...menu.ingredients.map((c) => ({ c, kind: "ingredient" as const })),
    ...menu.recipes.map((c) => ({ c, kind: "recipe" as const })),
    ...menu.packages.map((c) => ({ c, kind: "package" as const })),
  ];

  return (
    <Modal
      open={!!menu}
      onClose={onClose}
      title={`Overview · ${menu.name}`}
      subtitle="Cost breakdown, target prices, and delivery platform recommendations."
      size="xl"
    >
      {/* Top metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
        <PriceBlock
          label="Food Cost"
          value={menu.cost_price}
          vatValue={null}
          tone="indigo"
        />
        <PriceBlock
          label="Cost + Overhead"
          value={prices.costWithOverhead}
          vatValue={null}
          tone="amber"
          hint={`+${setting.other_percentage}% other expenses`}
        />
        <PriceBlock
          label="Target Selling Price"
          value={prices.targetSelling}
          vatValue={prices.vatTarget}
          tone="emerald"
          hint={`Based on ${setting.food_cost_percentage}% food cost`}
        />
        <PriceBlock
          label="Actual Store Selling"
          value={menu.selling_price}
          vatValue={prices.vatActual}
          tone="slate"
        />
        <PriceBlock
          label="Lineman Price"
          value={prices.lineman}
          vatValue={prices.vatLineman}
          tone="rose"
          hint={`GP ${setting.lineman_gp_percentage}%`}
        />
        <PriceBlock
          label="Grab Price"
          value={prices.grab}
          vatValue={prices.vatGrab}
          tone="rose"
          hint={`GP ${setting.grab_gp_percentage}%`}
        />
        <PriceBlock
          label="Shopee Food Price"
          value={prices.shopeeFood}
          vatValue={prices.vatShopee}
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
                <th className="table-th text-right">Base Cost</th>
                <th className="table-th text-right">Unit Cost</th>
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
                  const base =
                    ing || rec
                      ? costPerPurchaseUnit(
                          ing || {
                            purchase_quantity: 1,
                            purchase_unit: "piece",
                            purchase_price: computeMenuCostForRecipe(rec!, ingredients),
                          },
                        )
                      : costPerPurchaseUnit(pkg!);
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
                        {fmtTHB(base)}
                      </td>
                      <td className="table-td text-right font-semibold text-indigo-600">
                        {fmtTHB(c.actual_price)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50/60">
                <td colSpan={6} className="table-td text-right font-semibold text-slate-700">
                  Total Cost Price
                </td>
                <td className="table-td text-right font-bold text-emerald-600">
                  {fmtTHB(menu.cost_price)}
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
