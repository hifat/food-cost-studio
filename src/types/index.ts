export type UsageUnit = "gram" | "kg" | "ml" | "piece";

export const USAGE_UNITS: UsageUnit[] = ["gram", "kg", "ml", "piece"];

export const UNIT_LABELS: Record<UsageUnit, string> = {
  gram: "gram",
  kg: "kg",
  ml: "ml",
  piece: "piece",
};

export interface Ingredient {
  id: string;
  name: string;
  purchase_quantity: number;
  purchase_unit: UsageUnit;
  purchase_price: number;
  url: string;
  recipe_id?: string;
}

export type RecipeType = "FOOD" | "DESERT" | "SNACK" | "INGREDIENT";

export const RECIPE_TYPES: RecipeType[] = ["FOOD", "DESERT", "SNACK", "INGREDIENT"];

export const RECIPE_TYPE_LABELS: Record<RecipeType, string> = {
  FOOD: "Food",
  DESERT: "Dessert",
  SNACK: "Snack",
  INGREDIENT: "Sub-Ingredient",
};

export interface RecipeIngredient {
  ingredient_id: string;
  usage_quantity: number;
  usage_unit: UsageUnit;
  yield: number;
  actual_price: number;
}

export interface Recipe {
  id: string;
  name: string;
  type: RecipeType;
  serving_size: number;
  serving_unit: UsageUnit;
  ingredients: RecipeIngredient[];
}

export interface Package {
  id: string;
  name: string;
  purchase_quantity: number;
  purchase_unit: UsageUnit;
  purchase_price: number;
  url: string;
}

export interface MenuComponent {
  id: string;
  target_id: string;
  usage_quantity: number;
  usage_unit: UsageUnit;
  yield: number;
  actual_price: number;
}

export interface Menu {
  id: string;
  name: string;
  cost_price: number;
  selling_price: number;
  ingredients: MenuComponent[];
  recipes: MenuComponent[];
  packages: MenuComponent[];
}

export interface Setting {
  food_cost_percentage: number;
  lineman_gp_percentage: number;
  grab_gp_percentage: number;
  shopee_food_gp_percentage: number;
  other_percentage: number;
  vat_percentage: number;
}

export interface BackupData {
  version: number;
  exportedAt: string;
  ingredients: Ingredient[];
  recipes: Recipe[];
  packages: Package[];
  menus: Menu[];
  setting: Setting;
}
