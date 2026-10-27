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
  /** Recettes trouvées sur le web qui ressemblent au plat (photos, liens). */
  sources: Source[];
}

export interface Source {
  title: string;
  url: string;
  image: string | null;
}

/** Plat pas encore enregistré : le serveur lui attribue son id. */
export type DishDraft = Omit<Dish, "id"> & { id?: string };

/** Un créneau du menu : soit un plat prévu, soit un texte libre
    (« restes », « resto avec Paul »…). */
export type PlanEntry = { dishId: string } | { text: string };

/** Clé de créneau, voir `slotKey`. */
export type WeekPlan = Record<string, PlanEntry>;

export interface AppState {
  dishes: Dish[];
  /** Clés (voir `ingredientKey`) des ingrédients déjà achetés. */
  checked: string[];
  plan: WeekPlan;
  /** Ingrédients toujours à la maison, masqués de la liste de courses. */
  pantry: string[];
  /** Nombre de semaines affichées dans le menu (au moins 1). */
  weeks: number;
  /** Tags ajoutés par l'utilisateur, en plus de `TAGS`. */
  customTags: string[];
}

export const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"] as const;
export const MEALS = ["Midi", "Soir"] as const;

/** La première semaine garde des clés sans préfixe (« lundi-midi ») : c'est
    le format d'avant l'ajout des semaines supplémentaires, déjà enregistré. */
export function slotKey(week: number, day: string, meal: string): string {
  const base = `${day}-${meal}`.toLowerCase();
  return week === 1 ? base : `s${week}-${base}`;
}

export const TAGS = ["healthy", "protéiné", "qui cale", "gras / réconfortant", "léger", "végétarien", "rapide"] as const;
