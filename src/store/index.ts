import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  Ingredient,
  Recipe,
  Package,
  Menu,
  Setting,
  BackupData,
  RecipeIngredient,
  MenuComponent,
} from "../types";
import { computeRecipeTotalCost, computeMenuCost, round2, toNumber } from "../utils/calc";

const uid = (prefix = "id") =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const DEFAULT_SETTING: Setting = {
  food_cost_percentage: 35,
  lineman_gp_percentage: 32,
  grab_gp_percentage: 32,
  shopee_food_gp_percentage: 32,
  other_percentage: 10,
  vat_percentage: 7,
};

interface AppState {
  ingredients: Ingredient[];
  recipes: Recipe[];
  packages: Package[];
  menus: Menu[];
  setting: Setting;
  hasHydrated: boolean;

  // Ingredients
  addIngredient: (data: Omit<Ingredient, "id">) => Ingredient;
  updateIngredient: (id: string, patch: Partial<Ingredient>) => void;
  deleteIngredient: (id: string) => void;

  // Recipes
  addRecipe: (data: Omit<Recipe, "id">) => Recipe;
  updateRecipe: (id: string, patch: Partial<Omit<Recipe, "id">>) => void;
  deleteRecipe: (id: string) => void;

  // Packages
  addPackage: (data: Omit<Package, "id">) => Package;
  updatePackage: (id: string, patch: Partial<Package>) => void;
  deletePackage: (id: string) => void;

  // Menus
  addMenu: (data: Omit<Menu, "id" | "cost_price">) => Menu;
  updateMenu: (id: string, patch: Partial<Omit<Menu, "id" | "cost_price">>) => void;
  deleteMenu: (id: string) => void;

  // Setting
  updateSetting: (patch: Partial<Setting>) => void;

  // Backup
  exportAll: () => BackupData;
  importAll: (data: BackupData) => void;
  resetAll: () => void;

  setHasHydrated: (v: boolean) => void;
}

/**
 * Ensure that for any recipe with type "INGREDIENT", a corresponding
 * ingredient exists in the ingredient store, with purchase_price equal
 * to the computed cost of the recipe.
 */
const syncRecipeIngredients = (
  recipes: Recipe[],
  ingredients: Ingredient[],
): Ingredient[] => {
  let next = [...ingredients];

  for (const recipe of recipes) {
    if (recipe.type !== "INGREDIENT") continue;

    const totalCost = computeRecipeTotalCost(recipe, next);
    const existing = next.find((i) => i.recipe_id === recipe.id);

    if (existing) {
      // update
      next = next.map((i) =>
        i.recipe_id === recipe.id
          ? { ...i, purchase_price: round2(totalCost) }
          : i,
      );
    } else {
      // insert
      next.push({
        id: uid("ing"),
        name: recipe.name,
        purchase_quantity: 1,
        purchase_unit: "piece",
        purchase_price: round2(totalCost),
        url: "",
        recipe_id: recipe.id,
      });
    }
  }

  // Remove any auto-derived ingredients whose recipe is no longer INGREDIENT
  // (handles type changes like INGREDIENT -> FOOD)
  const validRecipeIds = new Set(
    recipes.filter((r) => r.type === "INGREDIENT").map((r) => r.id),
  );
  next = next.filter(
    (i) => !i.recipe_id || validRecipeIds.has(i.recipe_id),
  );

  return next;
};

/**
 * Recompute actual_price on every recipe ingredient & menu component,
 * then re-derive menu cost_price and recipe-derived ingredient prices.
 * This is the single source of truth for cascading updates.
 */
const recalculateAll = (state: {
  ingredients: Ingredient[];
  recipes: Recipe[];
  packages: Package[];
  menus: Menu[];
}): {
  ingredients: Ingredient[];
  recipes: Recipe[];
  menus: Menu[];
} => {
  // 1. Recompute each recipe's ingredient actual_price
  const recipes = state.recipes.map((r) => ({
    ...r,
    ingredients: r.ingredients.map((ri) => ({ ...ri })),
  }));

  // 2. Sync ingredients derived from recipes of type "INGREDIENT"
  const ingredients = syncRecipeIngredients(recipes, state.ingredients);

  // 3. Recompute menu cost_price based on freshest data
  const menus = state.menus.map((m) => {
    const cost = computeMenuCost(m, ingredients, recipes, state.packages);
    return { ...m, cost_price: cost };
  });

  return { ingredients, recipes, menus };
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ingredients: [],
      recipes: [],
      packages: [],
      menus: [],
      setting: DEFAULT_SETTING,
      hasHydrated: false,

      setHasHydrated: (v) => set({ hasHydrated: v }),

      addIngredient: (data) => {
        const ing: Ingredient = { id: uid("ing"), ...data };
        set((s) => {
          const merged = recalculateAll({
            ingredients: [...s.ingredients, ing],
            recipes: s.recipes,
            packages: s.packages,
            menus: s.menus,
          });
          return {
            ingredients: merged.ingredients,
            recipes: merged.recipes,
            menus: merged.menus,
          };
        });
        return ing;
      },

      updateIngredient: (id, patch) => {
        set((s) => {
          const merged = recalculateAll({
            ingredients: s.ingredients.map((i) =>
              i.id === id ? { ...i, ...patch } : i,
            ),
            recipes: s.recipes,
            packages: s.packages,
            menus: s.menus,
          });
          return {
            ingredients: merged.ingredients,
            recipes: merged.recipes,
            menus: merged.menus,
          };
        });
      },

      deleteIngredient: (id) => {
        set((s) => {
          // remove the ingredient, also strip it from any recipe/menu
          const nextIngs = s.ingredients.filter((i) => i.id !== id);
          const nextRecipes = s.recipes.map((r) => ({
            ...r,
            ingredients: r.ingredients.filter((ri) => ri.ingredient_id !== id),
          }));
          const nextMenus = s.menus.map((m) => ({
            ...m,
            ingredients: m.ingredients.filter((c) => c.target_id !== id),
          }));
          const merged = recalculateAll({
            ingredients: nextIngs,
            recipes: nextRecipes,
            packages: s.packages,
            menus: nextMenus,
          });
          return {
            ingredients: merged.ingredients,
            recipes: merged.recipes,
            menus: merged.menus,
          };
        });
      },

      addRecipe: (data) => {
        const recipe: Recipe = { id: uid("rec"), ...data };
        set((s) => {
          const merged = recalculateAll({
            ingredients: s.ingredients,
            recipes: [...s.recipes, recipe],
            packages: s.packages,
            menus: s.menus,
          });
          return {
            ingredients: merged.ingredients,
            recipes: merged.recipes,
            menus: merged.menus,
          };
        });
        return recipe;
      },

      updateRecipe: (id, patch) => {
        set((s) => {
          const nextRecipes = s.recipes.map((r) =>
            r.id === id
              ? {
                  ...r,
                  ...patch,
                  ingredients: patch.ingredients ?? r.ingredients,
                }
              : r,
          );
          const merged = recalculateAll({
            ingredients: s.ingredients,
            recipes: nextRecipes,
            packages: s.packages,
            menus: s.menus,
          });
          return {
            ingredients: merged.ingredients,
            recipes: merged.recipes,
            menus: merged.menus,
          };
        });
      },

      deleteRecipe: (id) => {
        set((s) => {
          const nextRecipes = s.recipes.filter((r) => r.id !== id);
          // remove recipe-derived ingredient
          const nextIngs = s.ingredients.filter((i) => i.recipe_id !== id);
          // remove from menus' recipe list
          const nextMenus = s.menus.map((m) => ({
            ...m,
            recipes: m.recipes.filter((c) => c.target_id !== id),
          }));
          const merged = recalculateAll({
            ingredients: nextIngs,
            recipes: nextRecipes,
            packages: s.packages,
            menus: nextMenus,
          });
          return {
            ingredients: merged.ingredients,
            recipes: merged.recipes,
            menus: merged.menus,
          };
        });
      },

      addPackage: (data) => {
        const pkg: Package = { id: uid("pkg"), ...data };
        set((s) => {
          const nextPkgs = [...s.packages, pkg];
          const nextMenus = s.menus.map((m) => ({
            ...m,
            cost_price: computeMenuCost(
              { ...m, packages: m.packages },
              s.ingredients,
              s.recipes,
              nextPkgs,
            ),
          }));
          return { packages: nextPkgs, menus: nextMenus };
        });
        return pkg;
      },

      updatePackage: (id, patch) => {
        set((s) => {
          const nextPkgs = s.packages.map((p) =>
            p.id === id ? { ...p, ...patch } : p,
          );
          const merged = recalculateAll({
            ingredients: s.ingredients,
            recipes: s.recipes,
            packages: nextPkgs,
            menus: s.menus,
          });
          return {
            packages: nextPkgs,
            ingredients: merged.ingredients,
            recipes: merged.recipes,
            menus: merged.menus,
          };
        });
      },

      deletePackage: (id) => {
        set((s) => {
          const nextPkgs = s.packages.filter((p) => p.id !== id);
          const nextMenus = s.menus.map((m) => ({
            ...m,
            packages: m.packages.filter((c) => c.target_id !== id),
          }));
          const merged = recalculateAll({
            ingredients: s.ingredients,
            recipes: s.recipes,
            packages: nextPkgs,
            menus: nextMenus,
          });
          return {
            packages: nextPkgs,
            ingredients: merged.ingredients,
            recipes: merged.recipes,
            menus: merged.menus,
          };
        });
      },

      addMenu: (data) => {
        const menu: Menu = { id: uid("menu"), cost_price: 0, ...data };
        set((s) => ({ menus: [...s.menus, menu] }));
        return menu;
      },

      updateMenu: (id, patch) => {
        set((s) => {
          const nextMenus = s.menus.map((m) => {
            if (m.id !== id) return m;
            const merged: Menu = {
              ...m,
              ...patch,
              ingredients: patch.ingredients ?? m.ingredients,
              recipes: patch.recipes ?? m.recipes,
              packages: patch.packages ?? m.packages,
            };
            const cost = computeMenuCost(
              merged,
              s.ingredients,
              s.recipes,
              s.packages,
            );
            return { ...merged, cost_price: cost };
          });
          return { menus: nextMenus };
        });
      },

      deleteMenu: (id) => {
        set((s) => ({ menus: s.menus.filter((m) => m.id !== id) }));
      },

      updateSetting: (patch) => {
        set((s) => ({ setting: { ...s.setting, ...patch } }));
      },

      exportAll: () => {
        const s = get();
        return {
          version: 1,
          exportedAt: new Date().toISOString(),
          ingredients: s.ingredients,
          recipes: s.recipes,
          packages: s.packages,
          menus: s.menus,
          setting: s.setting,
        };
      },

      importAll: (data) => {
        set({
          ingredients: Array.isArray(data.ingredients) ? data.ingredients : [],
          recipes: Array.isArray(data.recipes) ? data.recipes : [],
          packages: Array.isArray(data.packages) ? data.packages : [],
          menus: Array.isArray(data.menus) ? data.menus : [],
          setting: { ...DEFAULT_SETTING, ...(data.setting || {}) },
        });
        // recompute everything
        set((s) => {
          const merged = recalculateAll({
            ingredients: s.ingredients,
            recipes: s.recipes,
            packages: s.packages,
            menus: s.menus,
          });
          return {
            ingredients: merged.ingredients,
            recipes: merged.recipes,
            menus: merged.menus,
          };
        });
      },

      resetAll: () => {
        set({
          ingredients: [],
          recipes: [],
          packages: [],
          menus: [],
          setting: DEFAULT_SETTING,
        });
      },
    }),
    {
      name: "food-cost-calculator-v1",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        ingredients: s.ingredients,
        recipes: s.recipes,
        packages: s.packages,
        menus: s.menus,
        setting: s.setting,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);

/** Convenience: build a fresh RecipeIngredient (with computed actual_price = 0) */
export const newRecipeIngredient = (ingredientId: string): RecipeIngredient => ({
  ingredient_id: ingredientId,
  usage_quantity: 0,
  usage_unit: "gram",
  yield: 100,
  actual_price: 0,
});

/** Convenience: build a fresh MenuComponent */
export const newMenuComponent = (
  targetId: string,
  unit: MenuComponent["usage_unit"] = "piece",
): MenuComponent => ({
  id: uid("cmp"),
  target_id: targetId,
  usage_quantity: 0,
  usage_unit: unit,
  yield: 100,
  actual_price: 0,
});

// Keep toNumber re-export for components
export { toNumber };
