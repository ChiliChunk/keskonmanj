import { useCallback, useEffect, useRef, useState } from "react";
import { deleteDish, fetchState, saveChecked, saveDish, savePantry, savePlan } from "./data/api";
import type { Dish, DishDraft, WeekPlan } from "./domain/types";
import { GenerateView } from "./ui/GenerateView";
import { LibraryView } from "./ui/LibraryView";
import { PlannedView } from "./ui/PlannedView";
import { ShoppingView } from "./ui/ShoppingView";

type Tab = "generate" | "planned" | "shopping" | "library";

/** Reflet local du nettoyage fait par le serveur quand un plat n'est plus
    prévu : ses créneaux redeviennent libres. */
function withoutDish(plan: WeekPlan, dishId: string): WeekPlan {
  return Object.fromEntries(
    Object.entries(plan).filter(([, entry]) => !("dishId" in entry) || entry.dishId !== dishId),
  );
}

export function App() {
  const [tab, setTab] = useState<Tab>("generate");
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [checked, setChecked] = useState<string[]>([]);
  const [plan, setPlan] = useState<WeekPlan>({});
  const [pantry, setPantry] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchState()
      .then((state) => {
        setDishes(state.dishes);
        setChecked(state.checked);
        setPlan(state.plan);
        setPantry(state.pantry);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  // Deux clics rapprochés (♡ puis « Prévoir ») partent chacun d'une copie du
  // plat prise au rendu : sans file d'attente, le second écraserait le
  // premier avec un `liked` périmé. Les enregistrements sont donc
  // sérialisés, et chaque modification est appliquée sur la dernière version
  // renvoyée par le serveur.
  const latest = useRef(new Map<string, Dish>());
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const upsert = useCallback((draft: DishDraft, patch: Partial<Dish> = {}): Promise<Dish | null> => {
    const run = queue.current.then(async () => {
      const base = (draft.id && latest.current.get(draft.id)) || draft;
      try {
        const saved = await saveDish({ ...base, ...patch });
        latest.current.set(saved.id, saved);
        setDishes((previous) => {
          const others = previous.filter((d) => d.id !== saved.id);
          return saved.liked || saved.planned ? [...others, saved] : others;
        });
        if (!saved.planned) setPlan((previous) => withoutDish(previous, saved.id));
        return saved;
      } catch (e) {
        setError((e as Error).message);
        return null;
      }
    });
    queue.current = run;
    return run;
  }, []);

  const remove = useCallback(async (id: string) => {
    try {
      await deleteDish(id);
      latest.current.delete(id);
      setDishes((previous) => previous.filter((d) => d.id !== id));
      setPlan((previous) => withoutDish(previous, id));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const updateChecked = useCallback((next: string[]) => {
    setChecked(next);
    saveChecked(next).catch((e: Error) => setError(e.message));
  }, []);

  const updatePlan = useCallback((next: WeekPlan) => {
    setPlan(next);
    savePlan(next).catch((e: Error) => setError(e.message));
  }, []);

  const updatePantry = useCallback((next: string[]) => {
    setPantry(next);
    savePantry(next).catch((e: Error) => setError(e.message));
  }, []);

  const planned = dishes.filter((d) => d.planned);
  const liked = dishes.filter((d) => d.liked);

  const tabs: { id: Tab; label: string }[] = [
    { id: "generate", label: "Générer" },
    { id: "planned", label: `Prévus (${planned.length})` },
    { id: "shopping", label: "Courses" },
    { id: "library", label: `Aimés (${liked.length})` },
  ];

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="brand">
          <img src="/icon.png" alt="" />
          Keskonmanj
        </h1>
        <nav className="tabs">
          {tabs.map((t) => (
            <button
              key={t.id}
              className={t.id === tab ? "tab active" : "tab"}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      {error && (
        <div className="error" role="alert">
          {error}
          <button className="link" onClick={() => setError(null)}>
            Fermer
          </button>
        </div>
      )}

      {/* Les onglets restent montés et sont seulement masqués : changer
          d'onglet ne doit pas faire perdre le plat généré ni la saisie en
          cours. */}
      <main>
        <div hidden={tab !== "generate"}>
          <GenerateView dishes={dishes} onSave={upsert} onError={setError} />
        </div>
        <div hidden={tab !== "planned"}>
          <PlannedView
            dishes={planned}
            plan={plan}
            onPlanChange={updatePlan}
            onSave={upsert}
            onDelete={remove}
          />
        </div>
        <div hidden={tab !== "shopping"}>
          <ShoppingView
            dishes={planned}
            checked={checked}
            onCheckedChange={updateChecked}
            pantry={pantry}
            onPantryChange={updatePantry}
          />
        </div>
        <div hidden={tab !== "library"}>
          <LibraryView dishes={liked} onSave={upsert} />
        </div>
      </main>
    </div>
  );
}
