import { useState, useMemo, useRef } from "react";
import { Pencil, Trash2, ChefHat, Soup, Cake, Cookie, Beaker, BarChart3, Copy } from "lucide-react";
import { useAppStore } from "../../store";
import type { Recipe, RecipeType, UsageUnit } from "../../types";
import { RECIPE_TYPE_LABELS } from "../../types";
import { fmt, fmtTHB, computeRecipeTotalCost, calculateBaseUnitPrice, convertUnit, round2, toNumber } from "../../utils/calc";
import { getIngredientById } from "../../utils/ingredient";
import Modal from "../../components/Modal";
import SearchInput from "../../components/SearchInput";
import PageHeader from "../../components/PageHeader";
import EmptyState from "../../components/EmptyState";
import SegmentedControl from "../../components/SegmentedControl";
import RecipeForm from "./RecipeForm";

type FilterType = "ALL" | RecipeType;

const FILTER_OPTIONS: { value: FilterType; label: string; icon: React.ReactNode }[] = [
  { value: "FOOD", label: "Food", icon: <Soup className="w-3.5 h-3.5" /> },
  { value: "DESERT", label: "Dessert", icon: <Cake className="w-3.5 h-3.5" /> },
  { value: "SNACK", label: "Snack", icon: <Cookie className="w-3.5 h-3.5" /> },
  { value: "INGREDIENT", label: "Sub-Ingredient", icon: <Beaker className="w-3.5 h-3.5" /> },
];

export default function RecipesView() {
  const recipes = useAppStore((s) => s.recipes);
  const ingredients = useAppStore((s) => s.ingredients);
  const setting = useAppStore((s) => s.setting);
  const addRecipe = useAppStore((s) => s.addRecipe);
  const updateRecipe = useAppStore((s) => s.updateRecipe);
  const deleteRecipe = useAppStore((s) => s.deleteRecipe);

  const [typeFilter, setTypeFilter] = useState<FilterType>("FOOD");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Recipe | null>(null);
  const [overview, setOverview] = useState<Recipe | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Recipe | null>(null);
  const formAnchorRef = useRef<HTMLDivElement>(null);

  const handleDuplicate = (r: Recipe) => {
    addRecipe({
      name: r.name + " (Copy)",
      type: r.type,
      serving_size: r.serving_size,
      serving_unit: r.serving_unit,
      include_overhead: r.include_overhead,
      ingredients: r.ingredients.map(ri => ({ ...ri })),
    });
  };

  // Counts per type for badges
  const counts = useMemo(() => {
    const c: Record<FilterType, number> = {
      ALL: recipes.length,
      FOOD: 0,
      DESERT: 0,
      SNACK: 0,
      INGREDIENT: 0,
    };
    for (const r of recipes) c[r.type] += 1;
    return c;
  }, [recipes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return recipes
      .filter((r) => (typeFilter === "ALL" ? true : r.type === typeFilter))
      .filter((r) => {
        if (!q) return true;
        return (
          r.name.toLowerCase().includes(q) ||
          RECIPE_TYPE_LABELS[r.type].toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [recipes, typeFilter, query]);

  const handleSave = (data: {
    name: string;
    type: RecipeType;
    serving_size: number;
    serving_unit: UsageUnit;
    include_overhead: boolean;
    ingredients: Recipe["ingredients"];
  }) => {
    if (editing) {
      updateRecipe(editing.id, data);
      setEditing(null);
    } else {
      addRecipe(data);
    }
  };

  const handleEdit = (r: Recipe) => {
    setEditing(r);
    // Smoothly scroll the inline form into view
    requestAnimationFrame(() => {
      formAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const handleCancelEdit = () => {
    setEditing(null);
  };

  const handleDelete = (r: Recipe) => {
    deleteRecipe(r.id);
    if (editing?.id === r.id) setEditing(null);
    setConfirmDelete(null);
  };

  // Filter options with live counts
  const filterOptionsWithCounts = FILTER_OPTIONS.map((o) => ({
    ...o,
    count: counts[o.value],
  }));

  return (
    <div>
      <PageHeader
        title="Recipes"
        description="Compose raw materials into reusable sub-recipes. Mark a recipe as Sub-Ingredient to publish its cost back to the Ingredients store."
      />

      {/* Segmented filter */}
      <div className="mb-4 flex flex-wrap items-center gap-3 justify-between">
        <SegmentedControl
          ariaLabel="Filter recipes by type"
          options={filterOptionsWithCounts}
          value={typeFilter}
          onChange={(val) => setTypeFilter(val as FilterType)}
        />
        <div className="flex items-center gap-2">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search recipes…"
            className="w-full sm:w-64"
          />
        </div>
      </div>

      {/* Inline Recipe Form (anchor for edit-scroll) */}
      <div ref={formAnchorRef} className="mb-5">
        <RecipeForm
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
            <ChefHat className="w-4 h-4 text-indigo-500" />
            {typeFilter === "ALL"
              ? "All Recipes"
              : `${RECIPE_TYPE_LABELS[typeFilter]} Recipes`}
          </h2>
          <div className="ml-auto text-xs text-slate-500">
            {filtered.length} of {recipes.length} recipes
          </div>
        </div>

        {recipes.length === 0 ? (
          <EmptyState
            title="No recipes yet"
            description="Build your first sub-recipe or full dish using the form above."
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            title={
              typeFilter === "ALL"
                ? "No recipes match your search"
                : `No ${RECIPE_TYPE_LABELS[typeFilter as RecipeType]} recipes`
            }
            description="Switch the filter above or create one using the form."
          />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="table-th w-12">No.</th>
                  <th className="table-th">Menu / Recipe Name</th>
                  <th className="table-th w-32">Type</th>
                  <th className="table-th">Ingredients Used</th>
                  <th className="table-th text-right">Serving Size</th>
                  <th className="table-th">Serving Unit</th>
                  <th className="table-th text-right">Material Cost</th>
                  <th className="table-th text-right">Cost Per Unit</th>
                  <th className="table-th w-32 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, idx) => {
                  const total = computeRecipeTotalCost(r, ingredients);
                  const servingSize = r.serving_size || 0;
                  const servingUnit = r.serving_unit || "piece";
                  const otherPct = toNumber(setting.other_percentage, 0);
                  const includeOverhead = r.include_overhead ?? true;
                  const adjustedTotal = includeOverhead 
                    ? round2(total + (total * otherPct) / 100)
                    : round2(total);
                  const costPerUnit = servingSize > 0 ? adjustedTotal / servingSize : 0;
                  const ingNames = r.ingredients
                    .map((ri) => {
                      const ing = ingredients.find((x) => x.id === ri.ingredient_id);
                      return ing ? ing.name : "(removed)";
                    })
                    .join(", ");
                  return (
                    <tr
                      key={r.id}
                      className={`hover:bg-slate-50/60 transition ${
                        editing?.id === r.id ? "bg-indigo-50/50" : ""
                      }`}
                    >
                      <td className="table-td text-slate-500">{idx + 1}</td>
                      <td className="table-td">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-800">{r.name}</span>
                          {r.type === "INGREDIENT" && (
                            <span className="badge bg-amber-50 text-amber-700 border border-amber-200">
                              <ChefHat className="w-3 h-3 mr-0.5" /> sub
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="table-td">
                        <span className="badge bg-slate-100 text-slate-700 border border-slate-200">
                          {RECIPE_TYPE_LABELS[r.type]}
                        </span>
                      </td>
                      <td className="table-td max-w-xs">
                        <span className="line-clamp-2 text-slate-600 text-xs">
                          {ingNames || <em className="text-slate-400">none</em>}
                        </span>
                      </td>
                      <td className="table-td text-right text-slate-700">
                        {fmt(servingSize, 2)}
                      </td>
                      <td className="table-td text-slate-600">{servingUnit}</td>
                      <td className="table-td text-right font-medium text-slate-800">
                        {fmtTHB(adjustedTotal)}
                      </td>
                      <td className="table-td text-right text-slate-600">
                        {fmtTHB(costPerUnit)} / {servingUnit}
                      </td>
                      <td className="table-td text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => setOverview(r)}
                            className="p-1.5 rounded-md text-indigo-600 hover:bg-indigo-50"
                            title="Overview"
                          >
                            <BarChart3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEdit(r)}
                            className="p-1.5 rounded-md text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDuplicate(r)}
                            className="p-1.5 rounded-md text-slate-500 hover:text-sky-600 hover:bg-sky-50"
                            title="Duplicate"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setConfirmDelete(r)}
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
      <RecipeOverviewModal
        recipe={overview}
        ingredients={ingredients}
        setting={setting}
        onClose={() => setOverview(null)}
      />

      {/* Delete confirmation */}
      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete Recipe"
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
          {confirmDelete?.type === "INGREDIENT" && (
            <> The auto-generated ingredient will also be removed.</>
          )}
        </p>
      </Modal>
    </div>
  );
}

// ----- Recipe Overview Modal -----

interface RecipeOverviewModalProps {
  recipe: Recipe | null;
  ingredients: ReturnType<typeof useAppStore.getState>["ingredients"];
  setting: ReturnType<typeof useAppStore.getState>["setting"];
  onClose: () => void;
}

function RecipeOverviewModal({
  recipe,
  ingredients,
  setting,
  onClose,
}: RecipeOverviewModalProps) {
  if (!recipe) {
    return (
      <Modal open={false} onClose={onClose} title="Recipe Overview" size="lg">
        <div />
      </Modal>
    );
  }

  const foodCost = round2(
    recipe.ingredients.reduce((sum, ri) => sum + toNumber(ri.actual_price, 0), 0)
  );

  const otherPct = toNumber(setting.other_percentage, 0);
  const includeOverhead = recipe.include_overhead ?? true;
  const adjustedFoodCost = includeOverhead 
    ? round2(foodCost + (foodCost * otherPct) / 100)
    : foodCost;

  return (
    <Modal
      open={!!recipe}
      onClose={onClose}
      title={`Overview · ${recipe.name}`}
      subtitle="Recipe cost breakdown with overhead adjustment."
      size="xl"
    >
      <div className="grid grid-cols-1 md:grid-cols-1 gap-3 mb-5">
        <PriceBlockWithBadge
          label="Food Cost"
          value={adjustedFoodCost}
          badgeValue={foodCost}
          badgeLabel="Raw Cost"
          tone="indigo"
          hint={includeOverhead ? `Base cost + ${otherPct.toFixed(2)}% other expenses` : "Base cost (Overhead excluded)"}
        />
      </div>

      <h3 className="text-sm font-semibold text-slate-700 mb-2">Ingredient Breakdown</h3>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="min-w-full">
            <thead>
              <tr>
                <th className="table-th w-12">No.</th>
                <th className="table-th">Ingredient Name</th>
                <th className="table-th text-right">Usage Qty</th>
                <th className="table-th">Unit</th>
                <th className="table-th text-right">Cost (Raw)</th>
                <th className="table-th text-right">Actual Cost (Yield)</th>
              </tr>
            </thead>
            <tbody>
              {recipe.ingredients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="table-td text-center text-slate-400">
                    No ingredients
                  </td>
                </tr>
              ) : (
                recipe.ingredients.map((ri, idx) => {
                  const ing = getIngredientById(ri.ingredient_id, ingredients);
                  const name = ing ? ing.name : "(removed)";
                  
                  let rawCost = 0;
                  let actualCost = 0;

                  if (ing) {
                    const baseUnitPrice = calculateBaseUnitPrice(ing);
                    const convertedQty = convertUnit(ri.usage_quantity, ri.usage_unit, ing.purchase_unit);
                    rawCost = baseUnitPrice * convertedQty;
                    const yieldDivisor = (ri.yield || 100) / 100;
                    actualCost = yieldDivisor === 0 ? rawCost : rawCost / yieldDivisor;
                  } else {
                    // Fallback to stored actual price if ingredient was removed
                    actualCost = ri.actual_price || 0;
                  }

                  return (
                    <tr key={`${ri.ingredient_id}-${idx}`} className="hover:bg-slate-50/60">
                      <td className="table-td text-slate-500">{idx + 1}</td>
                      <td className="table-td font-medium text-slate-800">{name}</td>
                      <td className="table-td text-right">{fmt(ri.usage_quantity, 2)}</td>
                      <td className="table-td">{ri.usage_unit}</td>
                      <td className="table-td text-right text-slate-600">
                        {fmtTHB(round2(rawCost))}
                      </td>
                      <td className="table-td text-right font-semibold text-indigo-600">
                        {fmtTHB(round2(actualCost))}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50/60">
                <td colSpan={5} className="table-td text-right font-semibold text-slate-700">
                  Total Food Cost
                </td>
                <td className="table-td text-right font-bold text-emerald-600">
                  {fmtTHB(foodCost)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </Modal>
  );
}

function PriceBlockWithBadge({
  label,
  value,
  badgeValue,
  badgeLabel,
  tone = "indigo",
  hint,
}: {
  label: string;
  value: number;
  badgeValue: number;
  badgeLabel: string;
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
        <span className="badge bg-slate-100 text-slate-600 border border-slate-200 text-xs">
          {badgeLabel}: {fmtTHB(badgeValue)}
        </span>
      </div>
      {hint && <div className="text-[10px] text-slate-400 mt-1">{hint}</div>}
    </div>
  );
}
