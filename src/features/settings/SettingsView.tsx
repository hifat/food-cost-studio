import { useState } from "react";
import { Save, RotateCcw, Sliders } from "lucide-react";
import { useAppStore } from "../../store";
import { fmtPct } from "../../utils/calc";
import PageHeader from "../../components/PageHeader";

interface SettingForm {
  food_cost_percentage: string;
  lineman_gp_percentage: string;
  grab_gp_percentage: string;
  shopee_food_gp_percentage: string;
  other_percentage: string;
  vat_percentage: string;
}

const toForm = (s: ReturnType<typeof useAppStore.getState>["setting"]): SettingForm => ({
  food_cost_percentage: String(s.food_cost_percentage),
  lineman_gp_percentage: String(s.lineman_gp_percentage),
  grab_gp_percentage: String(s.grab_gp_percentage),
  shopee_food_gp_percentage: String(s.shopee_food_gp_percentage),
  other_percentage: String(s.other_percentage),
  vat_percentage: String(s.vat_percentage),
});

const DEFAULTS: SettingForm = {
  food_cost_percentage: "35",
  lineman_gp_percentage: "32",
  grab_gp_percentage: "32",
  shopee_food_gp_percentage: "32",
  other_percentage: "10",
  vat_percentage: "7",
};

export default function SettingsView() {
  const setting = useAppStore((s) => s.setting);
  const updateSetting = useAppStore((s) => s.updateSetting);
  // Initialize from store on first mount; user changes are stored locally until "Save".
  const [form, setForm] = useState<SettingForm>(() => toForm(setting));
  const [saved, setSaved] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSetting({
      food_cost_percentage: Number(form.food_cost_percentage) || 0,
      lineman_gp_percentage: Number(form.lineman_gp_percentage) || 0,
      grab_gp_percentage: Number(form.grab_gp_percentage) || 0,
      shopee_food_gp_percentage: Number(form.shopee_food_gp_percentage) || 0,
      other_percentage: Number(form.other_percentage) || 0,
      vat_percentage: Number(form.vat_percentage) || 0,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    if (!confirm("Reset form to defaults (35/32/32/32/10/7)?")) return;
    setForm(DEFAULTS);
  };

  const handleReload = () => {
    setForm(toForm(setting));
  };

  const fields: { key: keyof SettingForm; label: string; hint: string }[] = [
    { key: "food_cost_percentage", label: "Target Food Cost %", hint: "Used to compute target selling price" },
    { key: "lineman_gp_percentage", label: "Lineman GP %", hint: "Platform commission applied backward" },
    { key: "grab_gp_percentage", label: "Grab GP %", hint: "Platform commission applied backward" },
    { key: "shopee_food_gp_percentage", label: "Shopee Food GP %", hint: "Platform commission applied backward" },
    { key: "other_percentage", label: "Other Expenses %", hint: "Overhead added to cost price" },
    { key: "vat_percentage", label: "VAT %", hint: "Added on top of selling price (+VAT badge)" },
  ];

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Global percentages used to compute prices, overhead, and delivery platform recommendations."
      />

      <form onSubmit={handleSubmit} className="card p-6 max-w-3xl">
        <div className="flex items-center gap-2 mb-5">
          <Sliders className="w-5 h-5 text-indigo-600" />
          <h2 className="text-base font-semibold text-slate-800">Global Multipliers</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {fields.map((f) => (
            <div key={f.key}>
              <label className="label">{f.label}</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="input pr-9"
                  value={form[f.key]}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                  %
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">{f.hint}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
          <strong>Preview:</strong>{" "}
          Target Food Cost {fmtPct(Number(form.food_cost_percentage) || 0)} •{" "}
          Lineman {fmtPct(Number(form.lineman_gp_percentage) || 0)} •{" "}
          Grab {fmtPct(Number(form.grab_gp_percentage) || 0)} •{" "}
          Shopee {fmtPct(Number(form.shopee_food_gp_percentage) || 0)} •{" "}
          Other {fmtPct(Number(form.other_percentage) || 0)} •{" "}
          VAT {fmtPct(Number(form.vat_percentage) || 0)}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <button type="submit" className="btn-primary">
            <Save className="w-4 h-4" /> Save Settings
          </button>
          <button type="button" onClick={handleReset} className="btn-secondary">
            <RotateCcw className="w-4 h-4" /> Reset Form to Defaults
          </button>
          <button type="button" onClick={handleReload} className="btn-ghost">
            Reload from saved
          </button>
          {saved && (
            <span className="text-sm text-emerald-600 font-medium ml-2 animate-pulse">
              ✓ Saved
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
