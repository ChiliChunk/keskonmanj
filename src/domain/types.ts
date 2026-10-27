export interface Ingredient {
  name: string;
  quantity: string;
}

export interface Dish {
  id: string;
  name: string;
  description: string;
  tags: string[];
  servings: number;
  prepMinutes: number | null;
  ingredients: Ingredient[];
  steps: string[];
  source: "llm" | "manual";
  liked: boolean;
  planned: boolean;
  createdAt: string;
}

/** Plat pas encore enregistré : le serveur lui attribue son id. */
export type DishDraft = Omit<Dish, "id"> & { id?: string };

export interface AppState {
  dishes: Dish[];
  /** Clés (voir `ingredientKey`) des ingrédients déjà achetés. */
  checked: string[];
}

export const TAGS = [
  "healthy",
  "protéiné",
  "qui cale",
  "gras / réconfortant",
  "léger",
  "végétarien",
  "rapide",
  "pas cher",
  "épicé",
  "de saison",
  "batch cooking",
] as const;
