import { useState, useMemo } from "react";
import { ExternalLink, Pencil, Trash2, Plus, ChefHat } from "lucide-react";
import { useAppStore } from "../../store";
import type { Ingredient, UsageUnit } from "../../types";
import { USAGE_UNITS } from "../../types";
import { fmt, fmtTHB, costPerPurchaseUnit } from "../../utils/calc";
import Modal from "../../components/Modal";
import SearchInput from "../../components/SearchInput";
import PageHeader from "../../components/PageHeader";
import EmptyState from "../../components/EmptyState";

interface FormState {
  name: string;
  purchase_quantity: string;
  purchase_unit: UsageUnit;
  purchase_price: string;
  url: string;
}

const emptyForm: FormState = {
  name: "",
  purchase_quantity: "1",
  purchase_unit: "piece",
  purchase_price: "0",
  url: "",
};

export default function IngredientsView() {
  const ingredients = useAppStore((s) => s.ingredients);
  const addIngredient = useAppStore((s) => s.addIngredient);
  const updateIngredient = useAppStore((s) => s.updateIngredient);
  const deleteIngredient = useAppStore((s) => s.deleteIngredient);

  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formOpen, setFormOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Ingredient | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? ingredients.filter((i) => i.name.toLowerCase().includes(q))
      : ingredients;
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [ingredients, query]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (ing: Ingredient) => {
    setEditing(ing);
    setForm({
      name: ing.name,
      purchase_quantity: String(ing.purchase_quantity),
      purchase_unit: ing.purchase_unit,
      purchase_price: String(ing.purchase_price),
      url: ing.url,
    });
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
    setForm(emptyForm);
  };

  const handleSave = () => {
    const name = form.name.trim();
    if (!name) {
      alert("Ingredient name is required");
      return;
    }
    const payload = {
      name,
      purchase_quantity: Number(form.purchase_quantity) || 0,
      purchase_unit: form.purchase_unit,
      purchase_price: Number(form.purchase_price) || 0,
      url: form.url.trim(),
    };
    if (editing) {
      updateIngredient(editing.id, payload);
    } else {
      addIngredient(payload);
    }
    closeForm();
  };

  const handleDelete = (ing: Ingredient) => {
    deleteIngredient(ing.id);
    setConfirmDelete(null);
  };

  return (
    <div>
      <PageHeader
        title="Ingredients"
        description="Raw materials used across all recipes and menus. Prices cascade in real-time."
        action={{ label: "Add Ingredient", onClick: openCreate, icon: <Plus className="w-4 h-4" /> }}
      />

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/40 flex flex-wrap items-center gap-3">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search ingredients by name…"
            className="w-full sm:w-72"
          />
          <div className="ml-auto text-xs text-slate-500">
            {filtered.length} of {ingredients.length} items
          </div>
        </div>

        {ingredients.length === 0 ? (
          <EmptyState
            title="No ingredients yet"
            description="Add your first raw material to start building recipes and menus."
            action={
              <button onClick={openCreate} className="btn-primary">
                <Plus className="w-4 h-4" /> Add Ingredient
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="table-th w-12">No.</th>
                  <th className="table-th">Ingredient Name</th>
                  <th className="table-th">Purchase Qty</th>
                  <th className="table-th">Unit</th>
                  <th className="table-th text-right">Cost (THB)</th>
                  <th className="table-th text-right">Per Unit</th>
                  <th className="table-th w-32 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((ing, idx) => {
                  const cpu = costPerPurchaseUnit(ing);
                  return (
                    <tr key={ing.id} className="hover:bg-slate-50/60 transition">
                      <td className="table-td text-slate-500">{idx + 1}</td>
                      <td className="table-td">
                        <button
                          type="button"
                          onClick={() => {
                            if (ing.url) window.open(ing.url, "_blank", "noopener,noreferrer");
                          }}
                          disabled={!ing.url}
                          className={`inline-flex items-center gap-1.5 font-medium ${
                            ing.url
                              ? "text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                              : "text-slate-700 cursor-default"
                          }`}
                        >
                          {ing.name}
                          {ing.recipe_id && (
                            <span className="badge bg-amber-50 text-amber-700 border border-amber-200">
                              <ChefHat className="w-3 h-3 mr-0.5" /> sub
                            </span>
                          )}
                          {ing.url && <ExternalLink className="w-3.5 h-3.5" />}
                        </button>
                      </td>
                      <td className="table-td">{fmt(ing.purchase_quantity, 2)}</td>
                      <td className="table-td">{ing.purchase_unit}</td>
                      <td className="table-td text-right font-medium text-slate-800">
                        {fmtTHB(ing.purchase_price)}
                      </td>
                      <td className="table-td text-right text-slate-600">
                        {fmtTHB(cpu)} <span className="text-[11px] text-slate-400">/ {ing.purchase_unit}</span>
                      </td>
                      <td className="table-td text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => openEdit(ing)}
                            className="p-1.5 rounded-md text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setConfirmDelete(ing)}
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
        title={editing ? "Edit Ingredient" : "Add Ingredient"}
        subtitle={editing ? "Update purchase information for this item." : "Register a new raw material with purchase info."}
        size="md"
        footer={
          <>
            <button
              className="btn-secondary"
              onClick={closeForm}
            >
              Cancel
            </button>
            <button className="btn-primary" onClick={handleSave}>
              {editing ? "Save Changes" : "Add Ingredient"}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="label">Name</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Chicken Breast"
              autoFocus
            />
          </div>
          <div>
            <label className="label">Purchase Quantity</label>
            <input
              type="number"
              step="0.0001"
              min="0"
              className="input"
              value={form.purchase_quantity}
              onChange={(e) => setForm({ ...form, purchase_quantity: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Purchase Unit</label>
            <select
              className="input"
              value={form.purchase_unit}
              onChange={(e) => setForm({ ...form, purchase_unit: e.target.value as UsageUnit })}
            >
              {USAGE_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Purchase Cost (THB)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="input"
              value={form.purchase_price}
              onChange={(e) => setForm({ ...form, purchase_price: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Reference URL (optional)</label>
            <input
              className="input"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              placeholder="https://…"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Clicking the ingredient name will open this link in a new tab.
            </p>
          </div>
        </div>
      </Modal>

      {/* Delete confirmation */}
      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete Ingredient"
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
          Are you sure you want to delete <strong>{confirmDelete?.name}</strong>? It
          will be removed from all recipes and menus that use it.
        </p>
      </Modal>
    </div>
  );
}
