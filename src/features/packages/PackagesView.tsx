import { useState, useMemo } from "react";
import { ExternalLink, Pencil, Trash2, Plus, Package as PackageIcon } from "lucide-react";
import { useAppStore } from "../../store";
import type { Package as PackageType, UsageUnit } from "../../types";
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

export default function PackagesView() {
  const packages = useAppStore((s) => s.packages);
  const addPackage = useAppStore((s) => s.addPackage);
  const updatePackage = useAppStore((s) => s.updatePackage);
  const deletePackage = useAppStore((s) => s.deletePackage);

  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<PackageType | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formOpen, setFormOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<PackageType | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? packages.filter((p) => p.name.toLowerCase().includes(q))
      : packages;
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [packages, query]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (pkg: PackageType) => {
    setEditing(pkg);
    setForm({
      name: pkg.name,
      purchase_quantity: String(pkg.purchase_quantity),
      purchase_unit: pkg.purchase_unit,
      purchase_price: String(pkg.purchase_price),
      url: pkg.url,
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
      alert("Package name is required");
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
      updatePackage(editing.id, payload);
    } else {
      addPackage(payload);
    }
    closeForm();
  };

  const handleDelete = (pkg: PackageType) => {
    deletePackage(pkg.id);
    setConfirmDelete(null);
  };

  return (
    <div>
      <PageHeader
        title="Packages"
        description="Pre-packaged items like cups, boxes, and bags that contribute to menu cost."
        action={{ label: "Add Package", onClick: openCreate, icon: <Plus className="w-4 h-4" /> }}
      />

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/40 flex flex-wrap items-center gap-3">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search packages by name…"
            className="w-full sm:w-72"
          />
          <div className="ml-auto text-xs text-slate-500">
            {filtered.length} of {packages.length} items
          </div>
        </div>

        {packages.length === 0 ? (
          <EmptyState
            title="No packages yet"
            description="Add packaging supplies — cups, bags, boxes — that are part of your serving cost."
            icon={<PackageIcon className="w-7 h-7" />}
            action={
              <button onClick={openCreate} className="btn-primary">
                <Plus className="w-4 h-4" /> Add Package
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="table-th w-12">No.</th>
                  <th className="table-th">Package Name</th>
                  <th className="table-th">Purchase Qty</th>
                  <th className="table-th">Unit</th>
                  <th className="table-th text-right">Cost (THB)</th>
                  <th className="table-th text-right">Per Unit</th>
                  <th className="table-th w-32 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((pkg, idx) => {
                  const cpu = costPerPurchaseUnit(pkg);
                  return (
                    <tr key={pkg.id} className="hover:bg-slate-50/60 transition">
                      <td className="table-td text-slate-500">{idx + 1}</td>
                      <td className="table-td">
                        <button
                          type="button"
                          onClick={() => {
                            if (pkg.url) window.open(pkg.url, "_blank", "noopener,noreferrer");
                          }}
                          disabled={!pkg.url}
                          className={`inline-flex items-center gap-1.5 font-medium ${
                            pkg.url
                              ? "text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                              : "text-slate-700 cursor-default"
                          }`}
                        >
                          {pkg.name}
                          {pkg.url && <ExternalLink className="w-3.5 h-3.5" />}
                        </button>
                      </td>
                      <td className="table-td">{fmt(pkg.purchase_quantity, 2)}</td>
                      <td className="table-td">{pkg.purchase_unit}</td>
                      <td className="table-td text-right font-medium text-slate-800">
                        {fmtTHB(pkg.purchase_price)}
                      </td>
                      <td className="table-td text-right text-slate-600">
                        {fmtTHB(cpu)} <span className="text-[11px] text-slate-400">/ {pkg.purchase_unit}</span>
                      </td>
                      <td className="table-td text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => openEdit(pkg)}
                            className="p-1.5 rounded-md text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setConfirmDelete(pkg)}
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

      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editing ? "Edit Package" : "Add Package"}
        subtitle={editing ? "Update purchase info for this package item." : "Register a new packaging item."}
        size="md"
        footer={
          <>
            <button className="btn-secondary" onClick={closeForm}>
              Cancel
            </button>
            <button className="btn-primary" onClick={handleSave}>
              {editing ? "Save Changes" : "Add Package"}
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
              placeholder="e.g. Take-away Cup 16oz"
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
            <label className="label">Cost (THB)</label>
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
              Clicking the package name will open this link in a new tab.
            </p>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete Package"
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
          will be removed from any menu using it.
        </p>
      </Modal>
    </div>
  );
}
