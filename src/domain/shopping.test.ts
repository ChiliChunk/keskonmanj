import { describe, expect, it } from "vitest";
import { buildShoppingList, ingredientKey, parseIngredientLines } from "./shopping";
import type { Dish } from "./types";

function dish(name: string, planned: boolean, ingredients: Dish["ingredients"]): Dish {
  return {
    id: name,
    name,
    description: "",
    tags: [],
    servings: 2,
    prepMinutes: null,
    ingredients,
    steps: [],
    source: "manual",
    liked: false,
    planned,
    createdAt: "",
  };
}

describe("ingredientKey", () => {
  it("regroupe casse, espaces et pluriel simple", () => {
    expect(ingredientKey("  Oignons ")).toBe(ingredientKey("oignon"));
    expect(ingredientKey("Filets  de poulet")).toBe(ingredientKey("filet de poulet"));
    expect(ingredientKey("poireaux")).toBe(ingredientKey("poireau"));
  });

  it("ne tronque pas les mots courts", () => {
    expect(ingredientKey("riz")).toBe("riz");
  });
});

describe("buildShoppingList", () => {
  it("n'inclut que les plats prévus et fusionne les ingrédients communs", () => {
    const list = buildShoppingList([
      dish("Curry", true, [
        { name: "Oignon", quantity: "2" },
        { name: "riz", quantity: "200 g" },
      ]),
      dish("Soupe", true, [{ name: "oignons", quantity: "1" }]),
      dish("Tarte", false, [{ name: "farine", quantity: "250 g" }]),
    ]);

    expect(list.map((line) => line.name)).toEqual(["Oignon", "riz"]);
    expect(list[0]?.needs).toEqual([
      { dish: "Curry", quantity: "2" },
      { dish: "Soupe", quantity: "1" },
    ]);
  });
});

describe("parseIngredientLines", () => {
  it("sépare nom et quantité sur « : » et ignore les lignes vides", () => {
    expect(parseIngredientLines("riz : 200 g\n\n  carotte\n: 3")).toEqual([
      { name: "riz", quantity: "200 g" },
      { name: "carotte", quantity: "" },
    ]);
  });
});
