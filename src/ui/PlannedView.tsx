import { useState, type FormEvent } from "react";
import { parseIngredientLines } from "../domain/shopping";
import type { Dish, DishDraft } from "../domain/types";
import { DishCard, LikeButton } from "./DishCard";

interface Props {
  dishes: Dish[];
  onSave: (dish: DishDraft, patch?: Partial<Dish>) => Promise<Dish | null>;
  onDelete: (id: string) => Promise<void>;
}

export function PlannedView({ dishes, onSave, onDelete }: Props) {
  return (
    <div className="stack">
      <ManualDishForm onSave={onSave} />

      {dishes.length === 0 ? (
        <p className="empty">Aucun plat prévu cette semaine. Génère-en un ou ajoute-le à la main.</p>
      ) : (
        dishes.map((dish) => (
          <DishCard
            key={dish.id}
            dish={dish}
            actions={
              <>
                <LikeButton dish={dish} onToggle={() => onSave(dish, { liked: !dish.liked })} />
                <button
                  className="secondary"
                  title="Retirer des plats prévus"
                  onClick={() =>
                    // Un plat manuel non aimé n'existe que par sa présence au
                    // menu : on le supprime franchement.
                    dish.liked ? onSave(dish, { planned: false }) : onDelete(dish.id)
                  }
                >
                  Fait / retirer
                </button>
              </>
            }
          />
        ))
      )}
    </div>
  );
}

function ManualDishForm({ onSave }: { onSave: Props["onSave"] }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [ingredients, setIngredients] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    const saved = await onSave({
      name: name.trim(),
      description: "",
      tags: [],
      servings: 2,
      prepMinutes: null,
      ingredients: parseIngredientLines(ingredients),
      steps: [],
      source: "manual",
      liked: false,
      planned: true,
      createdAt: new Date().toISOString(),
    });
    setSaving(false);
    if (saved) {
      setName("");
      setIngredients("");
      setOpen(false);
    }
  }

  if (!open) {
    return (
      <button className="secondary wide" onClick={() => setOpen(true)}>
        + Ajouter un plat à la main
      </button>
    );
  }

  return (
    <form className="card stack-sm" onSubmit={submit}>
      <h2>Ajouter un plat</h2>
      <label className="field">
        <span>Nom du plat</span>
        <input value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
      </label>
      <label className="field">
        <span>Ingrédients — un par ligne, quantité après « : » (optionnel)</span>
        <textarea
          rows={5}
          value={ingredients}
          onChange={(e) => setIngredients(e.target.value)}
          placeholder={"pâtes : 250 g\ncrème fraîche : 20 cl\nlardons"}
        />
      </label>
      <div className="row">
        <button type="submit" className="primary" disabled={saving}>
          Ajouter aux prévus
        </button>
        <button type="button" className="link" onClick={() => setOpen(false)}>
          Annuler
        </button>
      </div>
    </form>
  );
}
