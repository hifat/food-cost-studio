import type {
  Ingredient,
  Package,
  Recipe,
  RecipeIngredient,
  Menu,
  MenuComponent,
  Setting,
  UsageUnit,
} from "../types";

const safeDiv = (a: number, b: number, fallback = 0): number => {
  if (!isFinite(a) || !isFinite(b) || b === 0) return fallback;
  return a / b;
};

export const calculateBaseUnitPrice = (ingredient: { purchase_price: number; purchase_quantity: number }) => {
  return safeDiv(toNumber(ingredient.purchase_price, 0), toNumber(ingredient.purchase_quantity, 0), 0);
};

export const convertUnit = (
  value: number,
  from: UsageUnit,
  to: UsageUnit,
): number => {
  if (!isFinite(value)) return 0;
  if (from === to) return value;
  if (from === "kg" && to === "gram") return value * 1000;
  if (from === "gram" && to === "kg") return value / 1000;
  if (
    (from === "piece" || from === "ml" || from === "gram") &&
    (to === "piece" || to === "ml" || to === "gram")
  ) {
    return value;
  }
  return 0;
};

export const toNumber = (v: unknown, fallback = 0): number => {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return isFinite(n) ? n : fallback;
  }
  return fallback;
};

export const round2 = (n: number): number => {
  if (!isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
};

export const fmt = (n: number, digits = 2): string => {
  const v = toNumber(n, 0);
  return v.toFixed(digits);
};

export const fmtTHB = (n: number): string => `฿${fmt(n, 2)}`;

export const fmtPct = (n: number): string => `${fmt(n, 2)}%`;

/**
 * Convert a quantity from a usage unit to the purchase unit.
 * Supports kg<->gram conversions (1 kg = 1000 g).
 * Other unit combinations fall back to the raw quantity when compatible,
 * or 0 if they cannot be compared.
 */
export const convertToPurchaseUnit = (
  usageQty: number,
  usageUnit: UsageUnit,
  purchaseUnit: UsageUnit,
): number => {
  if (!isFinite(usageQty)) return 0;
  if (usageUnit === purchaseUnit) return usageQty;

  // kg <-> gram
  if (usageUnit === "kg" && purchaseUnit === "gram") return usageQty * 1000;
  if (usageUnit === "gram" && purchaseUnit === "kg") return usageQty / 1000;

  // piece, ml, gram are base units treated as 1:1
  if (
    (usageUnit === "piece" || usageUnit === "ml" || usageUnit === "gram") &&
    (purchaseUnit === "piece" || purchaseUnit === "ml" || purchaseUnit === "gram")
  ) {
    return usageQty;
  }

  return 0;
};

export interface Purchasable {
  purchase_quantity: number;
  purchase_unit: UsageUnit;
  purchase_price: number;
}

export const costPerPurchaseUnit = (p: Purchasable): number => {
  if (!p || toNumber(p.purchase_quantity, 0) <= 0) return 0;
  return safeDiv(toNumber(p.purchase_price, 0), toNumber(p.purchase_quantity, 0), 0);
};

/**
 * Compute the cost contributed by a single component (ingredient / recipe / package)
 * given usage quantity, unit, and yield percentage.
 *
 *   actual_price = (usage_quantity_in_purchase_unit * cost_per_purchase_unit) / (yield/100)
 */
export const calculateComponentCost = (
  usageQty: number,
  usageUnit: UsageUnit,
  yieldPct: number,
  target: Purchasable | null | undefined,
): number => {
  if (!target) return 0;
  const qty = toNumber(usageQty, 0);
  const purchaseQty = toNumber(target.purchase_quantity, 0);
  if (purchaseQty <= 0) return 0;

  const converted = convertToPurchaseUnit(qty, usageUnit, target.purchase_unit);
  const costPerUnit = costPerPurchaseUnit(target);
  const rawCost = converted * costPerUnit;

  const yieldDivisor = toNumber(yieldPct, 100) / 100;
  if (yieldDivisor === 0) return round2(rawCost);
  return round2(safeDiv(rawCost, yieldDivisor, 0));
};

export const computeRecipeIngredientActual = (
  ri: RecipeIngredient,
  ingredients: Ingredient[],
): number => {
  const ing = ingredients.find((x) => x.id === ri.ingredient_id);
  return calculateComponentCost(ri.usage_quantity, ri.usage_unit, ri.yield, ing);
};

export const computeRecipeTotalCost = (recipe: Recipe, ingredients: Ingredient[]): number => {
  return round2(
    recipe.ingredients.reduce(
      (sum, ri) => sum + computeRecipeIngredientActual(ri, ingredients),
      0,
    ),
  );
};

export const computeMenuComponentActual = (
  comp: MenuComponent,
  ingredients: Ingredient[],
  recipes: Recipe[],
  packages: Package[],
): number => {
  // Try ingredient first
  const ing = ingredients.find((x) => x.id === comp.target_id);
  if (ing) return calculateComponentCost(comp.usage_quantity, comp.usage_unit, comp.yield, ing);

  // Try recipe (recipes are exposed as ingredients via recipe_id sync, but we also look up by id directly)
  const recipe = recipes.find((x) => x.id === comp.target_id);
  if (recipe) {
    const recipeCost = computeRecipeTotalCost(recipe, ingredients);
    // We treat the recipe as a 1-unit "package" costing recipeCost
    const recipeAsPurchasable: Purchasable = {
      purchase_quantity: 1,
      purchase_unit: "piece",
      purchase_price: recipeCost,
    };
    return calculateComponentCost(
      comp.usage_quantity,
      comp.usage_unit,
      comp.yield,
      recipeAsPurchasable,
    );
  }

  const pkg = packages.find((x) => x.id === comp.target_id);
  if (pkg) return calculateComponentCost(comp.usage_quantity, comp.usage_unit, comp.yield, pkg);

  return 0;
};

export const computeMenuCost = (menu: Menu): number => {
  // Sum the actual_price stored on every component across all three buckets.
  // The caller is responsible for ensuring each component's actual_price is
  // up to date (see refreshComponentActualPrices below).
  const all = [...menu.ingredients, ...menu.recipes, ...menu.packages];
  return round2(all.reduce((sum, comp) => sum + toNumber(comp.actual_price, 0), 0));
};

/**
 * Returns a fresh copy of `comps` where each component's `actual_price`
 * has been recomputed from the current ingredient/recipe/package data.
 * Safe with empty arrays and missing targets.
 */
export const refreshComponentActualPrices = (
  comps: MenuComponent[],
  ingredients: Ingredient[],
  recipes: Recipe[],
  packages: Package[],
): MenuComponent[] =>
  comps.map((c) => ({
    ...c,
    actual_price: round2(
      computeMenuComponentActual(c, ingredients, recipes, packages),
    ),
  }));

export const computeMenuProfit = (menu: Menu): { profit: number; margin: number } => {
  const cp = toNumber(menu.cost_price, 0);
  const sp = toNumber(menu.selling_price, 0);
  const profit = round2(sp - cp);
  const margin = sp > 0 ? round2((profit / sp) * 100) : 0;
  return { profit, margin };
};

export interface PlatformPrices {
  costWithOverhead: number;
  targetSelling: number;
  lineman: number;
  grab: number;
  shopeeFood: number;
  vatTarget: number;
  vatActual: number;
  vatLineman: number;
  vatGrab: number;
  vatShopee: number;
}

export const computeTargetSellingPrice = (costWithOverhead: number, foodCostPct: number) => {
  return foodCostPct > 0 ? round2(safeDiv(costWithOverhead, foodCostPct / 100, 0)) : 0;
};

export const computePlatformPrices = (
  menu: Menu,
  setting: Setting,
): PlatformPrices => {
  const cp = toNumber(menu.cost_price, 0);
  const sp = toNumber(menu.selling_price, 0);
  const otherPct = toNumber(setting.other_percentage, 0);
  const foodCostPct = toNumber(setting.food_cost_percentage, 1);
  const linemanPct = toNumber(setting.lineman_gp_percentage, 0);
  const grabPct = toNumber(setting.grab_gp_percentage, 0);
  const shopeePct = toNumber(setting.shopee_food_gp_percentage, 0);
  const vatPct = toNumber(setting.vat_percentage, 0);

  const costWithOverhead = round2(cp + (cp * otherPct) / 100);

  const targetSelling = computeTargetSellingPrice(costWithOverhead, foodCostPct);

  const backCalc = (price: number, pct: number) =>
    pct >= 100 ? 0 : round2(safeDiv(price, 1 - pct / 100, 0));

  const lineman = backCalc(sp, linemanPct);
  const grab = backCalc(sp, grabPct);
  const shopeeFood = backCalc(sp, shopeePct);

  const addVat = (price: number) => round2(price * (1 + vatPct / 100));

  return {
    costWithOverhead,
    targetSelling,
    lineman,
    grab,
    shopeeFood,
    vatTarget: addVat(targetSelling),
    vatActual: addVat(sp),
    vatLineman: addVat(lineman),
    vatGrab: addVat(grab),
    vatShopee: addVat(shopeeFood),
  };
};

export const computeRecipeType = (type: string): "FOOD" | "DESERT" | "SNACK" | "INGREDIENT" => {
  if (type === "DESERT" || type === "SNACK" || type === "INGREDIENT" || type === "FOOD")
    return type;
  return "FOOD";
};

/** Public helper used by UI to label a target item by id */
export const lookupTargetName = (
  targetId: string,
  ingredients: Ingredient[],
  recipes: Recipe[],
  packages: Package[],
): { name: string; kind: "ingredient" | "recipe" | "package" | "unknown" } => {
  const i = ingredients.find((x) => x.id === targetId);
  if (i) return { name: i.name, kind: "ingredient" };
  const r = recipes.find((x) => x.id === targetId);
  if (r) return { name: r.name, kind: "recipe" };
  const p = packages.find((x) => x.id === targetId);
  if (p) return { name: p.name, kind: "package" };
  return { name: "Unknown", kind: "unknown" };
};
