import { useState } from "react";
import { generateDish } from "../data/api";
import { TAGS, type Dish, type DishDraft } from "../domain/types";
import { DishCard, LikeButton } from "./DishCard";

interface Props {
  dishes: Dish[];
  onSave: (dish: DishDraft, patch?: Partial<Dish>) => Promise<Dish | null>;
  onError: (message: string) => void;
}

export function GenerateView({ dishes, onSave, onError }: Props) {
  const [tags, setTags] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [servings, setServings] = useState(2);
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [ingredientInput, setIngredientInput] = useState("");
  const [onlyIngredients, setOnlyIngredients] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [generated, setGenerated] = useState<Dish | null>(null);
  const [loading, setLoading] = useState(false);

  // Une fois aimé ou prévu, le plat généré vit dans la liste partagée : c'est
  // elle qui fait foi pour ses drapeaux.
  const current = generated ? (dishes.find((d) => d.id === generated.id) ?? generated) : null;

  function toggleTag(tag: string) {
    setTags((previous) =>
      previous.includes(tag) ? previous.filter((t) => t !== tag) : [...previous, tag],
    );
  }

  /** Accepte aussi une liste collée d'un coup (« courgette, feta, oeufs »). */
  function addIngredients(text: string) {
    const names = text
      .split(/[,;\n]/)
      .map((name) => name.trim())
      .filter(Boolean);
    setIngredients((previous) => [
      ...previous,
      ...names.filter((name) => !previous.some((p) => p.toLowerCase() === name.toLowerCase())),
    ]);
    setIngredientInput("");
  }

  async function generate() {
    // Ce qui reste tapé dans le champ compte aussi : sinon un ingrédient
    // saisi sans appuyer sur Entrée serait ignoré sans prévenir.
    const pending = ingredientInput.trim();
    const allIngredients = pending ? [...ingredients, pending] : ingredients;
    if (pending) addIngredients(pending);
    setLoading(true);
    try {
      const dish = await generateDish({
        tags,
        note,
        servings,
        ingredients: allIngredients,
        onlyIngredients: onlyIngredients && allIngredients.length > 0,
        recent,
      });
      setGenerated(dish);
      setRecent((previous) => [...previous, dish.name]);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function update(patch: Partial<Dish>) {
    if (!current) return;
    const saved = await onSave(
      { ...current, createdAt: current.createdAt || new Date().toISOString() },
      patch,
    );
    if (saved) setGenerated(saved);
  }

  return (
    <div className="stack">
      <section className="card">
        <h2>Envie de quoi ?</h2>
        <ul className="chips">
          {TAGS.map((tag) => (
            <li key={tag}>
              <button
                className={tags.includes(tag) ? "chip on" : "chip"}
                onClick={() => toggleTag(tag)}
                aria-pressed={tags.includes(tag)}
              >
                {tag}
              </button>
            </li>
          ))}
        </ul>

        <div className="field ingredients-field">
          <span>Ingrédients que j'ai déjà (optionnel)</span>
          <div className="tag-input">
            {ingredients.map((name) => (
              <span key={name} className="chip on removable">
                {name}
                <button
                  aria-label={`Retirer ${name}`}
                  onClick={() => setIngredients((previous) => previous.filter((p) => p !== name))}
                >
                  ×
                </button>
              </span>
            ))}
            <input
              value={ingredientInput}
              onChange={(e) => setIngredientInput(e.target.value)}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === ",") && ingredientInput.trim()) {
                  e.preventDefault();
                  addIngredients(ingredientInput);
                } else if (e.key === "Backspace" && !ingredientInput && ingredients.length > 0) {
                  setIngredients((previous) => previous.slice(0, -1));
                }
              }}
              onBlur={() => ingredientInput.trim() && addIngredients(ingredientInput)}
              placeholder={ingredients.length ? "Ajouter…" : "ex. courgette, feta, oeufs — Entrée pour valider"}
            />
          </div>
          {ingredients.length > 0 && (
            <label className="checkbox">
              <input
                type="checkbox"
                checked={onlyIngredients}
                onChange={(e) => setOnlyIngredients(e.target.checked)}
              />
              Uniquement ces ingrédients (+ basiques du placard)
            </label>
          )}
        </div>

        <div className="row">
          <label className="field grow">
            <span>Précision (optionnel)</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="ex. avec les courgettes qui me restent"
            />
          </label>
          <label className="field">
            <span>Personnes</span>
            <input
              type="number"
              min={1}
              max={12}
              value={servings}
              onChange={(e) => setServings(Math.max(1, Number(e.target.value) || 1))}
            />
          </label>
        </div>

        <button className="primary" onClick={generate} disabled={loading}>
          {loading ? "Claude réfléchit…" : generated ? "Autre idée" : "Générer un plat"}
        </button>
      </section>

      {current && (
        // Grisé pendant la génération suivante, pour qu'on voie que « Autre
        // idée » travaille.
        <div className={loading ? "fading" : undefined}>
          <DishCard
            key={current.id}
            dish={current}
            defaultOpen
            actions={
              <>
                <LikeButton dish={current} onToggle={() => update({ liked: !current.liked })} />
                <button
                  className={current.planned ? "secondary on" : "secondary"}
                  onClick={() => update({ planned: !current.planned })}
                >
                  {current.planned ? "✓ Prévu" : "Prévoir"}
                </button>
              </>
            }
          />
        </div>
      )}
    </div>
  );
}
