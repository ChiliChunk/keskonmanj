import type { Dish } from "./types";

export interface ShoppingLine {
  key: string;
  name: string;
  /** Une entrée par plat : les quantités ne sont pas additionnées, leurs
      unités (« 1 boîte », « 200 g », « 1 c. à soupe ») étant rarement
      compatibles. */
  needs: { dish: string; quantity: string }[];
}

/** Clé de regroupement : insensible à la casse, aux espaces et à un pluriel
    simple en -s/-x, pour que « Oignons » et « oignon » tombent ensemble. */
export function ingredientKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word) => (word.length > 3 ? word.replace(/[sx]$/, "") : word))
    .join(" ");
}

export function buildShoppingList(dishes: Dish[]): ShoppingLine[] {
  const lines = new Map<string, ShoppingLine>();
  for (const dish of dishes) {
    if (!dish.planned) continue;
    for (const ingredient of dish.ingredients) {
      const key = ingredientKey(ingredient.name);
      if (!key) continue;
      let line = lines.get(key);
      if (!line) {
        line = { key, name: ingredient.name.trim(), needs: [] };
        lines.set(key, line);
      }
      line.needs.push({ dish: dish.name, quantity: ingredient.quantity });
    }
  }
  return [...lines.values()].sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

/** Un élément du placard couvre aussi ses variantes : « huile » masque
    « huile d'olive », mais « sel » ne masque pas « selle d'agneau » ni
    « poivre » le « poivron ». */
export function isInPantry(key: string, pantry: string[]): boolean {
  return pantry.some((item) => {
    const pantryKey = ingredientKey(item);
    return pantryKey !== "" && (key === pantryKey || key.startsWith(pantryKey + " "));
  });
}

/** Saisie libre d'un plat manuel : un ingrédient par ligne, quantité
    optionnelle après « : » (« riz : 200 g »). */
export function parseIngredientLines(text: string): Dish["ingredients"] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separator = line.indexOf(":");
      if (separator === -1) return { name: line, quantity: "" };
      return {
        name: line.slice(0, separator).trim(),
        quantity: line.slice(separator + 1).trim(),
      };
    })
    .filter((ingredient) => ingredient.name);
}
