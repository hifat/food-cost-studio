import { useState, useMemo } from "react";
import { Pencil, Trash2, Plus, ChefHat, X, Search } from "lucide-react";
import { useAppStore, newRecipeIngredient } from "../../store";
import type { Recipe, RecipeIngredient, UsageUnit, RecipeType } from "../../types";
import { USAGE_UNITS, RECIPE_TYPES, RECIPE_TYPE_LABELS } from "../../types";
import { fmt, fmtTHB, computeRecipeTotalCost, computeRecipeIngredientActual } from "../../utils/calc";
import Modal from "../../components/Modal";
import SearchInput from "../../components/SearchInput";
import PageHeader from "../../components/PageHeader";
import EmptyState from "../../components/EmptyState";
import SearchableSelect from "../../components/SearchableSelect";

interface FormState {
  name: string;
  type: RecipeType;
  ingredients: RecipeIngredient[];
}

const emptyForm: FormState = {
  name: "",
  type: "FOOD",
  ingredients: [],
};

export default function RecipesView() {
  const recipes = useAppStore((s) => s.recipes);
  const ingredients = useAppStore((s) => s.ingredients);
  const addRecipe = useAppStore((s) => s.addRecipe);
  const updateRecipe = useAppStore((s) => s.updateRecipe);
  const deleteRecipe = useAppStore((s) => s.deleteRecipe);

  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Recipe | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formOpen, setFormOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Recipe | null>(null);
  const [ingQuery, setIngQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? recipes.filter(
          (r) =>
            r.name.toLowerCase().includes(q) ||
            RECIPE_TYPE_LABELS[r.type].toLowerCase().includes(q),
        )
      : recipes;
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [recipes, query]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
    setIngQuery("");
  };

  const openEdit = (r: Recipe) => {
    setEditing(r);
    setForm({ name: r.name, type: r.type, ingredients: [...r.ingredients] });
    setFormOpen(true);
    setIngQuery("");
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
    setForm(emptyForm);
  };

  const addIngredientRow = (id: string) => {
    if (!id) return;
    if (form.ingredients.some((ri) => ri.ingredient_id === id)) return;
    setForm({ ...form, ingredients: [...form.ingredients, newRecipeIngredient(id)] });
  };

  const updateRow = (idx: number, patch: Partial<RecipeIngredient>) => {
    const next = form.ingredients.map((ri, i) => (i === idx ? { ...ri, ...patch } : ri));
    setForm({ ...form, ingredients: next });
  };

  const removeRow = (idx: number) => {
    setForm({
      ...form,
      ingredients: form.ingredients.filter((_, i) => i !== idx),
    });
  };

  const handleSave = () => {
    const name = form.name.trim();
    if (!name) {
      alert("Recipe name is required");
      return;
    }
    if (form.ingredients.length === 0) {
      if (!confirm("Save recipe with no ingredients?")) return;
    }
    // Re-compute actual_price on every row before saving (store keeps it denormalized)
    const ingredientsWithCost = form.ingredients.map((ri) => ({
      ...ri,
      actual_price: computeRecipeIngredientActual(ri, ingredients),
    }));
    const payload = {
      name,
      type: form.type,
      ingredients: ingredientsWithCost,
    };
    if (editing) {
      updateRecipe(editing.id, payload);
    } else {
      addRecipe(payload);
    }
    closeForm();
  };

  const handleDelete = (r: Recipe) => {
    deleteRecipe(r.id);
    setConfirmDelete(null);
  };

  // Available ingredient options for the in-form picker
  const availableIngredients = useMemo(() => {
    return ingredients.filter((i) => !i.recipe_id); // exclude sub-ingredients derived from recipes
  }, [ingredients]);

  const ingOptions = useMemo(
    () =>
      availableIngredients
        .filter((i) => i.name.toLowerCase().includes(ingQuery.toLowerCase()))
        .map((i) => ({
          value: i.id,
          label: i.name,
          subLabel: `${fmt(i.purchase_quantity, 2)} ${i.purchase_unit} • ${fmtTHB(i.purchase_price)}`,
        })),
    [availableIngredients, ingQuery],
  );

  // Quick-add row when only one item remains
  const handleAddByValue = (val: string) => {
    if (val) addIngredientRow(val);
  };

  // Form-level preview total
  const previewTotal = useMemo(
    () =>
      form.ingredients.reduce(
        (sum, ri) => sum + computeRecipeIngredientActual(ri, ingredients),
        0,
      ),
    [form.ingredients, ingredients],
  );

  return (
    <div>
      <PageHeader
        title="Recipes"
        description="Compose raw materials into reusable sub-recipes. Mark a recipe as Sub-Ingredient to publish its cost back to the Ingredients store."
        action={{ label: "Add Recipe", onClick: openCreate, icon: <Plus className="w-4 h-4" /> }}
      />

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/40 flex flex-wrap items-center gap-3">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search recipes…"
            className="w-full sm:w-72"
          />
          <div className="ml-auto text-xs text-slate-500">
            {filtered.length} of {recipes.length} recipes
          </div>
        </div>

        {recipes.length === 0 ? (
          <EmptyState
            title="No recipes yet"
            description="Build your first sub-recipe or full dish to compute its cost automatically."
            action={
              <button onClick={openCreate} className="btn-primary">
                <Plus className="w-4 h-4" /> Add Recipe
              </button>
            }
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
                  <th className="table-th text-right">Usage Qty</th>
                  <th className="table-th">Usage Unit</th>
                  <th className="table-th text-right">Raw Material Cost</th>
                  <th className="table-th text-right">Cost Per Unit</th>
                  <th className="table-th w-32 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, idx) => {
                  const total = computeRecipeTotalCost(r, ingredients);
                  // By default, a recipe is 1 piece / 1 unit of output
                  const usageQty = 1;
                  const usageUnit: UsageUnit = "piece";
                  const ingNames = r.ingredients
                    .map((ri) => {
                      const ing = ingredients.find((x) => x.id === ri.ingredient_id);
                      return ing ? ing.name : "(removed)";
                    })
                    .join(", ");
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/60 transition">
                      <td className="table-td text-slate-500">{idx + 1}</td>
                      <td className="table-td">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-800">{r.name}</span>
                          {r.type === "INGREDIENT" && (
                            <span className="badge bg-amber-50 text-amber-700 border border-amber-200">
                              <ChefHat className="w-3 h-3 mr-0.5" /> sub-ingredient
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
                        {fmt(usageQty, 2)}
                      </td>
                      <td className="table-td text-slate-600">
                        {usageUnit}
                      </td>
                      <td className="table-td text-right font-medium text-slate-800">
                        {fmtTHB(total)}
                      </td>
                      <td className="table-td text-right text-slate-600">
                        {fmtTHB(total)}
                      </td>
                      <td className="table-td text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => openEdit(r)}
                            className="p-1.5 rounded-md text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
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

      {/* Create/Edit Modal */}
      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editing ? "Edit Recipe" : "Add Recipe"}
        subtitle="Define ingredients, their usage, and yield to compute the recipe's cost."
        size="2xl"
        footer={
          <>
            <button className="btn-secondary" onClick={closeForm}>
              Cancel
            </button>
            <button className="btn-primary" onClick={handleSave}>
              {editing ? "Save Changes" : "Add Recipe"}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          <div>
            <label className="label">Recipe Name</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Pad Kra Pao Sauce"
              autoFocus
            />
          </div>
          <div>
            <label className="label">Type</label>
            <select
              className="input"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as RecipeType })}
            >
              {RECIPE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {RECIPE_TYPE_LABELS[t]}
                  {t === "INGREDIENT" ? " (publishes cost to Ingredients)" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-slate-50/70 border-b border-slate-200 flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-700">Ingredients</h3>
            <div className="ml-auto flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-initial sm:w-72">
                <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                <input
                  className="w-full pl-8 pr-2 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                  placeholder="Filter ingredients…"
                  value={ingQuery}
                  onChange={(e) => setIngQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="p-3">
            {form.ingredients.length === 0 ? (
              <div className="text-sm text-slate-500 text-center py-6">
                No ingredients yet. Pick from the list below to add one.
              </div>
            ) : (
              <div className="space-y-2">
                {form.ingredients.map((ri, idx) => {
                  const ing = ingredients.find((x) => x.id === ri.ingredient_id);
                  const cost = computeRecipeIngredientActual(ri, ingredients);
                  return (
                    <div
                      key={`${ri.ingredient_id}-${idx}`}
                      className="grid grid-cols-12 gap-2 items-center p-2 rounded-lg bg-slate-50/60 border border-slate-200"
                    >
                      <div className="col-span-12 sm:col-span-4 text-sm font-medium text-slate-800 truncate">
                        {ing ? ing.name : <em className="text-rose-500">Removed</em>}
                      </div>
                      <div className="col-span-4 sm:col-span-2">
                        <input
                          type="number"
                          step="0.0001"
                          min="0"
                          className="input"
                          value={ri.usage_quantity}
                          onChange={(e) =>
                            updateRow(idx, { usage_quantity: Number(e.target.value) || 0 })
                          }
                          placeholder="Qty"
                        />
                      </div>
                      <div className="col-span-4 sm:col-span-2">
                        <select
                          className="input"
                          value={ri.usage_unit}
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
                      <div className="col-span-3 sm:col-span-2">
                        <div className="relative">
                          <input
                            type="number"
                            step="1"
                            min="1"
                            max="100"
                            className="input pr-7"
                            value={ri.yield}
                            onChange={(e) =>
                              updateRow(idx, { yield: Number(e.target.value) || 0 })
                            }
                            placeholder="Yield"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                            %
                          </span>
                        </div>
                      </div>
                      <div className="col-span-12 sm:col-span-1 text-right text-sm font-semibold text-slate-800">
                        {fmtTHB(cost)}
                      </div>
                      <div className="col-span-1 text-right">
                        <button
                          onClick={() => removeRow(idx)}
                          className="p-1.5 rounded-md text-slate-500 hover:text-rose-600 hover:bg-rose-50"
                          title="Remove"
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

          <div className="px-3 pb-3">
            <div className="text-xs text-slate-500 mb-1.5 font-semibold uppercase tracking-wide">
              Add Ingredient
            </div>
            <SearchableSelect
              value=""
              onChange={handleAddByValue}
              options={ingOptions.filter(
                (o) => !form.ingredients.some((ri) => ri.ingredient_id === o.value),
              )}
              placeholder="Pick an ingredient to add…"
              emptyMessage={
                availableIngredients.length === 0
                  ? "Create ingredients first."
                  : "No matching ingredients."
              }
            />
          </div>

          <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/70 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              {form.ingredients.length} ingredient
              {form.ingredients.length === 1 ? "" : "s"} • {form.ingredients.length} row
              {form.ingredients.length === 1 ? "" : "s"}
            </span>
            <div className="text-sm font-semibold text-slate-800">
              Total Cost: <span className="text-indigo-600">{fmtTHB(previewTotal)}</span>
            </div>
          </div>
        </div>
      </Modal>

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
            <button className="btn-danger" onClick={() => confirmDelete && handleDelete(confirmDelete)}>
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
