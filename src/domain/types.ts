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

/** Un créneau du menu : soit un plat prévu, soit un texte libre
    (« restes », « resto avec Paul »…). */
export type PlanEntry = { dishId: string } | { text: string };

/** Clé de créneau : `${jour}-${repas}`, voir `slotKey`. */
export type WeekPlan = Record<string, PlanEntry>;

export interface AppState {
  dishes: Dish[];
  /** Clés (voir `ingredientKey`) des ingrédients déjà achetés. */
  checked: string[];
  plan: WeekPlan;
  /** Ingrédients toujours à la maison, masqués de la liste de courses. */
  pantry: string[];
}

export const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"] as const;
export const MEALS = ["Midi", "Soir"] as const;

export function slotKey(day: string, meal: string): string {
  return `${day}-${meal}`.toLowerCase();
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
