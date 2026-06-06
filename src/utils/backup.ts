import type { BackupData } from "../types";

const FILE_VERSION = 1;

export const downloadJSON = (data: unknown, filename: string) => {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const readJSONFile = (file: File): Promise<unknown> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || "");
        const parsed = JSON.parse(text);
        resolve(parsed);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error || new Error("Read error"));
    reader.readAsText(file);
  });

export const buildBackup = (state: {
  ingredients: BackupData["ingredients"];
  recipes: BackupData["recipes"];
  packages: BackupData["packages"];
  menus: BackupData["menus"];
  setting: BackupData["setting"];
}): BackupData => ({
  version: FILE_VERSION,
  exportedAt: new Date().toISOString(),
  ...state,
});

export const isBackupData = (value: unknown): value is BackupData => {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    Array.isArray(v.ingredients) &&
    Array.isArray(v.recipes) &&
    Array.isArray(v.packages) &&
    Array.isArray(v.menus) &&
    !!v.setting &&
    typeof v.setting === "object"
  );
};
