import { useEffect, useState, type DragEvent, type FormEvent, type ReactNode } from "react";
import { parseIngredientLines } from "../domain/shopping";
import {
  DAYS,
  MEALS,
  slotKey,
  type Dish,
  type DishDraft,
  type PlanEntry,
  type WeekPlan,
} from "../domain/types";
import { DishCard, LikeButton } from "./DishCard";

const DRAG_TYPE = "application/x-keskonmanj-dish";

interface Props {
  dishes: Dish[];
  plan: WeekPlan;
  weeks: number;
  onPlanChange: (plan: WeekPlan, weeks: number) => void;
  onSave: (dish: DishDraft, patch?: Partial<Dish>) => Promise<Dish | null>;
  onDelete: (id: string) => Promise<void>;
}

const MAX_WEEKS = 8;

export function PlannedView({ dishes, plan, weeks, onPlanChange, onSave, onDelete }: Props) {
  // Le glisser-déposer HTML ne marche pas au doigt sur téléphone : on peut
  // aussi toucher un plat pour le sélectionner, puis toucher un créneau.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const byId = new Map(dishes.map((dish) => [dish.id, dish]));

  function setSlot(key: string, entry: PlanEntry | null) {
    const next = { ...plan };
    if (entry) next[key] = entry;
    else delete next[key];
    onPlanChange(next, weeks);
  }

  function removeLastWeek() {
    const keys = DAYS.flatMap((day) => MEALS.map((meal) => slotKey(weeks, day, meal)));
    const filled = keys.filter((key) => plan[key]).length;
    if (filled > 0 && !window.confirm(`Retirer la semaine ${weeks} et ses ${filled} créneau(x) remplis ?`)) return;
    onPlanChange(Object.fromEntries(Object.entries(plan).filter(([key]) => !keys.includes(key))), weeks - 1);
  }

  function placements(dishId: string): number {
    return Object.values(plan).filter((entry) => "dishId" in entry && entry.dishId === dishId).length;
  }

  return (
    <div className="stack">
      <section className="card">
        <div className="row between">
          <h2>{weeks > 1 ? "Les semaines" : "La semaine"}</h2>
          {Object.keys(plan).length > 0 && (
            <button
              className="link"
              onClick={() => window.confirm("Vider tous les créneaux ?") && onPlanChange({}, weeks)}
            >
              Tout vider
            </button>
          )}
        </div>

        {dishes.length > 0 ? (
          <>
            <p className="hint">
              Glisse un plat dans un créneau (ou touche-le, puis touche le créneau). Tu peux aussi
              écrire ce que tu veux dans une case.
            </p>
            <ul className="chips palette">
              {dishes.map((dish) => {
                const count = placements(dish.id);
                return (
                  <li key={dish.id}>
                    <button
                      className={selectedId === dish.id ? "chip dish-chip selected" : "chip dish-chip"}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData(DRAG_TYPE, dish.id);
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => setSelectedId((id) => (id === dish.id ? null : dish.id))}
                      aria-pressed={selectedId === dish.id}
                    >
                      {dish.name}
                      {count > 0 && <span className="badge">×{count}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <p className="hint">
            Les plats prévus apparaîtront ici pour les placer dans la semaine. En attendant, tu peux
            écrire directement dans les cases.
          </p>
        )}

        {Array.from({ length: weeks }, (_, i) => i + 1).map((week) => (
          <div key={week} className="week-block">
            {weeks > 1 && (
              <div className="week-title">
                <h3>Semaine {week}</h3>
                {week === weeks && (
                  <button className="link" onClick={removeLastWeek}>
                    Retirer cette semaine
                  </button>
                )}
              </div>
            )}
            <div className="week">
              <span />
              {MEALS.map((meal) => (
                <span key={meal} className="week-head">
                  {meal}
                </span>
              ))}
              {DAYS.map((day) => (
                <WeekRow key={day} day={day}>
                  {MEALS.map((meal) => {
                    const key = slotKey(week, day, meal);
                    const entry = plan[key];
                    return (
                      <Slot
                        key={key}
                        label={`${day} ${meal.toLowerCase()}${weeks > 1 ? `, semaine ${week}` : ""}`}
                        entry={entry}
                        dish={entry && "dishId" in entry ? byId.get(entry.dishId) : undefined}
                        selectedId={selectedId}
                        onChange={(next) => {
                          setSlot(key, next);
                          if (next && "dishId" in next) setSelectedId(null);
                        }}
                      />
                    );
                  })}
                </WeekRow>
              ))}
            </div>
          </div>
        ))}

        {weeks < MAX_WEEKS && (
          <button className="secondary wide add-week" onClick={() => onPlanChange(plan, weeks + 1)}>
            + Ajouter une semaine
          </button>
        )}
      </section>

      <ManualDishForm onSave={onSave} />

      {dishes.map((dish) => (
        <DishCard
          key={dish.id}
          dish={dish}
          onEdit={(patch) => onSave(dish, patch)}
          actions={
            <>
              <LikeButton dish={dish} onToggle={() => onSave(dish, { liked: !dish.liked })} />
              <button
                className="secondary"
                title="Retirer des plats prévus"
                onClick={() =>
                  // Un plat non aimé n'existe que par sa présence au menu :
                  // on le supprime franchement.
                  dish.liked ? onSave(dish, { planned: false }) : onDelete(dish.id)
                }
              >
                Fait / retirer
              </button>
            </>
          }
        />
      ))}
    </div>
  );
}

function WeekRow({ day, children }: { day: string; children: ReactNode }) {
  return (
    <>
      <span className="week-day">
        <span className="long">{day}</span>
        <span className="short">{day.slice(0, 3)}</span>
      </span>
      {children}
    </>
  );
}

interface SlotProps {
  label: string;
  entry: PlanEntry | undefined;
  /** Plat du créneau, absent s'il n'est plus prévu (le créneau est alors vide). */
  dish: Dish | undefined;
  selectedId: string | null;
  onChange: (entry: PlanEntry | null) => void;
}

function Slot({ label, entry, dish, selectedId, onChange }: SlotProps) {
  const savedText = entry && "text" in entry ? entry.text : "";
  const [text, setText] = useState(savedText);
  const [over, setOver] = useState(false);

  useEffect(() => setText(savedText), [savedText]);

  function commitText() {
    const value = text.trim();
    if (value === savedText) return;
    onChange(value ? { text: value } : null);
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setOver(false);
    const dishId = event.dataTransfer.getData(DRAG_TYPE);
    if (dishId) onChange({ dishId });
  }

  const classes = ["slot", over && "over", selectedId && "armed", dish && "filled"].filter(Boolean).join(" ");

  return (
    <div
      className={classes}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      // Avec un plat sélectionné, toucher la case le place au lieu
      // d'ouvrir le clavier dans le champ texte.
      onMouseDown={(e) => selectedId && e.preventDefault()}
      onClick={() => selectedId && onChange({ dishId: selectedId })}
    >
      {dish ? (
        <span
          className="slot-dish"
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData(DRAG_TYPE, dish.id);
            e.dataTransfer.effectAllowed = "copy";
          }}
        >
          <span className="slot-name">{dish.name}</span>
          <button
            className="slot-clear"
            aria-label={`Vider ${label}`}
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
          >
            ×
          </button>
        </span>
      ) : (
        <input
          aria-label={label}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commitText}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          placeholder="—"
          readOnly={selectedId !== null}
        />
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
      sources: [],
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
        + Ajouter un plat prévu à la main
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
