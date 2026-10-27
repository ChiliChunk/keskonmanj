from __future__ import annotations

import random

import anthropic
from pydantic import BaseModel

MODEL = "claude-sonnet-5-5"
MAX_COUNT = 5

CUISINES = [
    "française de bistrot",
    "française de grand-mère",
    "italienne",
    "méditerranéenne",
    "libanaise",
    "marocaine",
    "indienne",
    "thaïe",
    "japonaise",
    "coréenne",
    "mexicaine",
    "espagnole",
    "grecque",
    "vietnamienne",
    "américaine",
]


class GenerationError(Exception):
    pass


class Ingredient(BaseModel):
    name: str
    quantity: str


class Recipe(BaseModel):
    name: str
    description: str
    prep_minutes: int
    ingredients: list[Ingredient]
    steps: list[str]


class Menu(BaseModel):
    recipes: list[Recipe]


SYSTEM = (
    "Tu proposes des plats faits maison pour la semaine d'un particulier en France. "
    "Ingrédients trouvables en supermarché, quantités pour le nombre de personnes demandé. "
    "Chaque ingrédient a un nom court et générique, au singulier, sans la quantité "
    "(ex. « oignon », « filet de poulet », « riz basmati ») pour pouvoir être "
    "regroupé dans une liste de courses ; la quantité va dans le champ dédié "
    "(ex. « 2 », « 300 g », « 1 c. à soupe »). Étapes courtes et concrètes. "
    "Le nom du plat est un nom de recette courant, qu'on retrouverait en le "
    "cherchant sur un site de recettes. Réponds en français."
)

_client: anthropic.Anthropic | None = None


def get_client() -> anthropic.Anthropic:
    # Créé à la demande : la clé n'est lue depuis .env qu'au démarrage du serveur.
    global _client
    if _client is None:
        _client = anthropic.Anthropic()
    return _client


def api_errors(error: Exception) -> GenerationError:
    if isinstance(error, anthropic.AuthenticationError):
        return GenerationError("Clé API Anthropic refusée (server/.env).")
    if isinstance(error, anthropic.RateLimitError):
        return GenerationError("Trop de requêtes, réessaie dans un instant.")
    if isinstance(error, anthropic.APIStatusError):
        return GenerationError(f"Erreur API Anthropic ({error.status_code}) : {error.message}")
    return GenerationError("Impossible de joindre l'API Anthropic.")


def generate_dishes(
    count: int,
    tags: list[str],
    note: str,
    servings: int,
    avoid: list[str],
    ingredients: list[str],
    only_ingredients: bool,
) -> list[dict]:
    count = max(1, min(MAX_COUNT, count))
    # Tous les plats dans une seule réponse plutôt qu'en appels parallèles :
    # le modèle voit ce qu'il a déjà proposé et varie de lui-même.
    if count == 1:
        lines = [f"Propose un plat pour {servings} personne(s)."]
    else:
        lines = [f"Propose {count} plats bien différents les uns des autres, pour {servings} personne(s) chacun."]
    if tags:
        lines.append("Critères : " + ", ".join(tags) + ".")
    if ingredients:
        lines.append("Les plats doivent utiliser ces ingrédients que j'ai déjà : " + ", ".join(ingredients) + ".")
        if only_ingredients:
            lines.append(
                "N'ajoute aucun autre ingrédient, sauf les basiques de placard "
                "(sel, poivre, huile, beurre, épices courantes, farine, sucre, eau)."
            )
    if note.strip():
        lines.append("Précision : " + note.strip())
    if avoid:
        # Évite de reproposer ce qui est déjà dans la bibliothèque ou au menu.
        lines.append(
            "Propose quelque chose de vraiment différent de ces plats déjà connus "
            "ou déjà proposés : " + "; ".join(avoid[-60:]) + "."
        )
    if not note.strip():
        # À critères identiques, le modèle retombe vite sur les mêmes
        # classiques : des pistes tirées au hasard suffisent à varier.
        picks = random.sample(CUISINES, k=min(count + 1, len(CUISINES)))
        lines.append("Pour varier, tu peux t'inspirer de ces cuisines : " + ", ".join(picks) + ".")

    try:
        response = get_client().beta.messages.parse(
            model=MODEL,
            max_tokens=16000,
            system=SYSTEM,
            output_config={"effort": "low"},
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            output_format=Menu,
            messages=[{"role": "user", "content": "\n".join(lines)}],
        )
    except anthropic.APIError as error:
        raise api_errors(error) from error

    if response.stop_reason == "refusal" or response.parsed_output is None:
        raise GenerationError("Claude n'a pas renvoyé de recette exploitable, réessaie.")

    return [
        {
            "name": recipe.name,
            "description": recipe.description,
            "tags": tags,
            "servings": servings,
            "prepMinutes": recipe.prep_minutes,
            "ingredients": [i.model_dump() for i in recipe.ingredients],
            "steps": recipe.steps,
            "source": "llm",
        }
        for recipe in response.parsed_output.recipes[:count]
    ]
