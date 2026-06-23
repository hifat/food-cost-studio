import { useState, useMemo } from "react";
import { X, Plus, Save, RotateCcw, AlertCircle, ChevronUp, ChevronDown, ChefHat } from "lucide-react";
import type { Recipe, RecipeIngredient, UsageUnit, RecipeType } from "../../types";
import { USAGE_UNITS, RECIPE_TYPE_LABELS } from "../../types";
import { fmt, fmtTHB, computeRecipeIngredientActual } from "../../utils/calc";
import { useAppStore } from "../../store";
import SearchableSelect from "../../components/SearchableSelect";

interface RecipeFormProps {
  initial?: Recipe | null;
  onSave: (data: { name: string; type: RecipeType; serving_size: number; serving_unit: UsageUnit; include_overhead: boolean; ingredients: RecipeIngredient[] }) => void;
  onCancel?: () => void;
  showCancel?: boolean;
}

export default function RecipeForm({
  initial,
  onSave,
  onCancel,
  showCancel,
}: RecipeFormProps) {
  const ingredients = useAppStore((s) => s.ingredients);
  const setting = useAppStore((s) => s.setting);

  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<RecipeType>(initial?.type ?? "FOOD");
  const [servingSize, setServingSize] = useState<number>(initial?.serving_size ?? 1);
  const [servingUnit, setServingUnit] = useState<UsageUnit>(initial?.serving_unit ?? "piece");
  const [includeOverhead, setIncludeOverhead] = useState<boolean>(initial?.include_overhead ?? true);
  const [rows, setRows] = useState<RecipeIngredient[]>(
    initial ? initial.ingredients.map((r) => ({ ...r })) : [],
  );

  // Available ingredients (exclude sub-ingredients derived from recipes)
  const availableIngredients = useMemo(
    () => ingredients.filter((i) => !i.recipe_id),
    [ingredients],
  );

  const options = useMemo(
    () =>
      availableIngredients.map((i) => ({
        value: i.id,
        label: i.name,
        subLabel: `${fmt(i.purchase_quantity, 2)} ${i.purchase_unit} • ${fmtTHB(i.purchase_price)}`,
      })),
    [availableIngredients],
  );

  const visibleOptions = useMemo(
    () => options.filter((o) => !rows.some((r) => r.ingredient_id === o.value)),
    [options, rows],
  );

  const addRow = (id: string) => {
    if (!id) return;
    if (rows.some((r) => r.ingredient_id === id)) return;
    setRows((prev) => [
      ...prev,
      {
        ingredient_id: id,
        usage_quantity: 0,
        usage_unit: "gram",
        yield: 100,
        actual_price: 0,
      },
    ]);
  };

  const updateRow = (idx: number, patch: Partial<RecipeIngredient>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const removeRow = (idx: number) => {
    setRows(rows.filter((_, i) => i !== idx));
  };

  const moveRow = (idx: number, dir: "up" | "down") => {
    const next = [...rows];
    if (dir === "up" && idx > 0) {
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    } else if (dir === "down" && idx < next.length - 1) {
      [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
    }
    setRows(next);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      alert("Recipe name is required");
      return;
    }
    if (rows.length === 0) {
      if (!confirm("Save recipe with no ingredients?")) return;
    }
    // Re-compute actual_price before saving so the data on disk matches
    // the displayed totals.
    const computed = rows.map((r) => ({
      ...r,
      actual_price: computeRecipeIngredientActual(r, ingredients),
    }));
    onSave({ name: trimmed, type, serving_size: servingSize, serving_unit: servingUnit, include_overhead: includeOverhead, ingredients: computed });
    if (!initial) {
      // Reset only when creating
      setName("");
      setType("FOOD");
      setServingSize(1);
      setServingUnit("piece");
      setIncludeOverhead(true);
      setRows([]);
    }
  };

  const handleReset = () => {
    if (initial) {
      setName(initial.name);
      setType(initial.type);
      setServingSize(initial.serving_size ?? 1);
      setServingUnit(initial.serving_unit ?? "piece");
      setIncludeOverhead(initial.include_overhead ?? true);
      setRows(initial.ingredients.map((r) => ({ ...r })));
    } else {
      setName("");
      setType("FOOD");
      setServingSize(1);
      setServingUnit("piece");
      setIncludeOverhead(true);
      setRows([]);
    }
  };

  const total = rows.reduce(
    (s, r) => s + computeRecipeIngredientActual(r, ingredients),
    0,
  );
  
  const otherPct = setting?.other_percentage || 0;
  const estimatedTotalWithOverhead = total + (total * otherPct) / 100;

  return (
    <form onSubmit={handleSubmit} className="card p-5">
      <div className="flex items-start gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0">
          <ChefHat className="w-4 h-4" />
        </div>
        <div className="flex flex-col">
          <div className="flex items-center">
            <h2 className="text-base font-semibold text-slate-800">
              {initial ? "Edit Recipe" : "New Recipe"}
            </h2>
            {initial && (
              <span className="badge bg-amber-50 text-amber-700 border border-amber-200 ml-2">
                Editing
              </span>
            )}
          </div>
        </div>
        <div className="ml-auto text-right">
          <div className="text-[10px] uppercase tracking-wider text-slate-500">
            Live total
          </div>
          <div className="text-lg font-bold text-indigo-600">{fmtTHB(total)}</div>
          {includeOverhead && (
            <div className="mt-1.5 flex justify-end">
              <span className="badge bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold">
                With Overhead: {fmtTHB(estimatedTotalWithOverhead)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Name + type row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div className="md:col-span-2">
          <label className="label">Recipe Name</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Pad Kra Pao Sauce"
          />
        </div>
        <div>
          <label className="label">Type</label>
          <select
            className="input"
            value={type}
            onChange={(e) => setType(e.target.value as RecipeType)}
          >
            {(["FOOD", "DESERT", "SNACK", "INGREDIENT"] as RecipeType[]).map((t) => (
              <option key={t} value={t}>
                {RECIPE_TYPE_LABELS[t]}
                {t === "INGREDIENT" ? " (publishes cost)" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Serving row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <div>
          <label className="label">Serving Size</label>
          <input
            type="number"
            min="0"
            step="0.01"
            className="input"
            value={servingSize}
            onChange={(e) => setServingSize(Number(e.target.value) || 0)}
            placeholder="e.g. 1"
          />
        </div>
        <div>
          <label className="label">Serving Unit</label>
          <select
            className="input"
            value={servingUnit}
            onChange={(e) => setServingUnit(e.target.value as UsageUnit)}
          >
            {USAGE_UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <input 
          type="checkbox" 
          id="includeOverhead" 
          checked={includeOverhead} 
          onChange={(e) => setIncludeOverhead(e.target.checked)} 
          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
        />
        <label htmlFor="includeOverhead" className="text-sm font-medium text-slate-700">
          Include Overhead / Base Cost
        </label>
      </div>

      {/* Ingredients section — no `overflow-hidden` here so the picker dropdown
          can float above the form boundary. */}
      <div className="border border-slate-200 rounded-xl mb-4">
        <div className="px-4 py-2.5 bg-slate-50/70 border-b border-slate-200 rounded-t-xl flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
            Ingredients ({rows.length})
          </span>
          <span className="text-[10px] uppercase tracking-wider text-slate-400 hidden sm:inline">
            Qty · Unit · Yield (%) · Actual Price
          </span>
        </div>

        {availableIngredients.length === 0 ? (
          <div className="px-4 py-6 text-sm text-slate-600 flex items-start gap-2.5 bg-amber-50/40">
            <AlertCircle className="w-4 h-4 mt-0.5 text-amber-600 flex-shrink-0" />
            <div>
              <p className="font-medium text-amber-900">No ingredients available</p>
              <p className="text-amber-800/80 text-xs mt-0.5">
                Please add items to the <strong>Ingredients</strong> tab first, then
                come back here to compose your recipe.
              </p>
            </div>
          </div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-5 text-sm text-slate-500 text-center">
            Pick an ingredient from the dropdown below to start composing this recipe.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {rows.map((r, idx) => {
              const ing = ingredients.find((x) => x.id === r.ingredient_id);
              const cost = computeRecipeIngredientActual(r, ingredients);
              return (
                <div
                  key={`${r.ingredient_id}-${idx}`}
                  className="grid grid-cols-12 gap-2 items-start px-3 py-2.5"
                >
                  <div className="col-span-12 md:col-span-3">
                    <label className="md:hidden text-[10px] uppercase text-slate-400">Ingredient</label>
                    <div className="text-sm font-medium text-slate-800 truncate py-2">
                      {ing ? ing.name : (
                        <em className="text-rose-500">Removed ingredient</em>
                      )}
                    </div>
                  </div>
                  <div className="col-span-4 md:col-span-2">
                    <label className="text-[10px] uppercase text-slate-400">Qty</label>
                    <input
                      type="number"
                      step="0.0001"
                      min="0"
                      className="input"
                      value={r.usage_quantity}
                      onChange={(e) =>
                        updateRow(idx, { usage_quantity: Number(e.target.value) || 0 })
                      }
                    />
                  </div>
                  <div className="col-span-4 md:col-span-2">
                    <label className="text-[10px] uppercase text-slate-400">Unit</label>
                    <select
                      className="input"
                      value={r.usage_unit}
                      onChange={(e) =>
                        updateRow(idx, { usage_unit: e.target.value as UsageUnit })
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
                        value={r.yield}
                        onChange={(e) =>
                          updateRow(idx, { yield: Number(e.target.value) || 0 })
                        }
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">
                        %
                      </span>
                    </div>
                  </div>
                  <div className="col-span-10 md:col-span-2 text-right">
                    <div className="text-[10px] uppercase text-slate-400">
                      Actual Price
                    </div>
                    <div className="text-sm font-semibold text-indigo-600 mt-1.5">
                      {fmtTHB(cost)}
                    </div>
                  </div>
                  <div className="col-span-2 md:col-span-1 flex flex-col items-end gap-1 pt-1">
                    <button
                      type="button"
                      onClick={() => removeRow(idx)}
                      className="p-1.5 rounded-md text-slate-500 hover:text-rose-600 hover:bg-rose-50"
                      title="Remove"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => moveRow(idx, "up")}
                        disabled={idx === 0}
                        className="p-1 rounded text-slate-400 hover:text-indigo-600 disabled:opacity-30"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveRow(idx, "down")}
                        disabled={idx === rows.length - 1}
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

        {/* Add ingredient picker — `relative` here so the SearchableSelect's
            absolutely-positioned dropdown can float over the form. */}
        {availableIngredients.length > 0 && (
          <div className="relative px-3 py-3 bg-slate-50/40 border-t border-slate-200 rounded-b-xl">
            <label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold block mb-1.5">
              Add Ingredient
            </label>
            <SearchableSelect
              value=""
              onChange={addRow}
              options={visibleOptions}
              placeholder={
                visibleOptions.length === 0
                  ? "All available ingredients added"
                  : "Search and pick an ingredient to add…"
              }
              emptyMessage="No matching ingredients"
            />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" className="btn-primary">
          {initial ? (
            <>
              <Save className="w-4 h-4" /> Save Changes
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" /> Add Recipe
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
