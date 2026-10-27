import type { AppState, Dish, DishDraft, WeekPlan } from "../domain/types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json" },
  });
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    throw new Error(body.error ?? `Erreur ${response.status}`);
  }
  return body as T;
}

export function fetchState(): Promise<AppState> {
  return request("/api/state");
}

export function generateDish(params: {
  tags: string[];
  note: string;
  servings: number;
  ingredients: string[];
  onlyIngredients: boolean;
  /** Plats déjà proposés pendant la session, à ne pas resservir. */
  recent: string[];
}): Promise<Dish> {
  return request("/api/generate", { method: "POST", body: JSON.stringify(params) });
}

/** Enregistre (ou met à jour) un plat. Le serveur l'oublie s'il n'est plus ni
    aimé ni prévu. */
export function saveDish(dish: DishDraft): Promise<Dish> {
  return request("/api/dishes", { method: "POST", body: JSON.stringify(dish) });
}

export function deleteDish(id: string): Promise<unknown> {
  return request(`/api/dishes/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function saveChecked(checked: string[]): Promise<unknown> {
  return request("/api/checked", { method: "POST", body: JSON.stringify({ checked }) });
}

export function savePlan(plan: WeekPlan): Promise<unknown> {
  return request("/api/plan", { method: "POST", body: JSON.stringify({ plan }) });
}

export function savePantry(pantry: string[]): Promise<unknown> {
  return request("/api/pantry", { method: "POST", body: JSON.stringify({ pantry }) });
}
