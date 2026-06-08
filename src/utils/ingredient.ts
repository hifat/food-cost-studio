import type { Ingredient } from "../types";

export const getIngredientById = (id: string, ingredients: Ingredient[]) => {
  return ingredients.find((i) => i.id === id);
};
