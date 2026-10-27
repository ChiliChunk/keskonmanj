from __future__ import annotations

import anthropic
from pydantic import BaseModel

MODEL = "claude-sonnet-5-5"


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


SYSTEM = (
    "Tu proposes des plats faits maison pour la semaine d'un particulier en France. "
    "Ingrédients trouvables en supermarché, quantités pour le nombre de personnes demandé. "
    "Chaque ingrédient a un nom court et générique, au singulier, sans la quantité "
    "(ex. « oignon », « filet de poulet », « riz basmati ») pour pouvoir être "
    "regroupé dans une liste de courses ; la quantité va dans le champ dédié "
    "(ex. « 2 », « 300 g », « 1 c. à soupe »). Étapes courtes et concrètes. "
    "Réponds en français."
)

_client: anthropic.Anthropic | None = None


def _get_client() -> anthropic.Anthropic:
    # Créé à la demande : la clé n'est lue depuis .env qu'au démarrage du serveur.
    global _client
    if _client is None:
        _client = anthropic.Anthropic()
    return _client


def generate_dish(tags: list[str], note: str, servings: int, avoid: list[str]) -> dict:
    lines = [f"Propose un plat pour {servings} personne(s)."]
    if tags:
        lines.append("Critères : " + ", ".join(tags) + ".")
    if note.strip():
        lines.append("Précision : " + note.strip())
    if avoid:
        # Évite de reproposer ce qui est déjà dans la bibliothèque ou au menu.
        lines.append("Évite ces plats déjà connus : " + "; ".join(avoid[-60:]) + ".")

    try:
        response = _get_client().beta.messages.parse(
            model=MODEL,
            max_tokens=16000,
            system=SYSTEM,
            output_config={"effort": "low"},
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            output_format=Recipe,
            messages=[{"role": "user", "content": "\n".join(lines)}],
        )
    except anthropic.AuthenticationError as error:
        raise GenerationError("Clé API Anthropic refusée (server/.env).") from error
    except anthropic.RateLimitError as error:
        raise GenerationError("Trop de requêtes, réessaie dans un instant.") from error
    except anthropic.APIStatusError as error:
        raise GenerationError(f"Erreur API Anthropic ({error.status_code}) : {error.message}") from error
    except anthropic.APIConnectionError as error:
        raise GenerationError("Impossible de joindre l'API Anthropic.") from error

    if response.stop_reason == "refusal" or response.parsed_output is None:
        raise GenerationError("Claude n'a pas renvoyé de recette exploitable, réessaie.")

    recipe = response.parsed_output
    return {
        "name": recipe.name,
        "description": recipe.description,
        "tags": tags,
        "servings": servings,
        "prepMinutes": recipe.prep_minutes,
        "ingredients": [i.model_dump() for i in recipe.ingredients],
        "steps": recipe.steps,
        "source": "llm",
    }
