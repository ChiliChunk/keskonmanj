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

  async function generate() {
    setLoading(true);
    try {
      setGenerated(await generateDish({ tags, note, servings }));
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
      )}
    </div>
  );
}
