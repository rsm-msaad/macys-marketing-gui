"""
MCP tool: generate_locale_variants.

Simulated transcreation of English campaign copy into Spanish (es) or
Quebec French (fr-CA). Does NOT call any external translation API.
Maintains a phrase substitution table that covers the common patterns
in Macys marketing copy: percent off claims, refresh language, taglines.
Phrases not in the table pass through unchanged, with a heuristic flag
in the result so callers can decide whether to route to a human editor.

Used by the localization-generator skill at workflow step 7.

CLI:
    python -m tools.generate_locale_variants "Up to 40 percent off. Refresh your routine." es
"""

from __future__ import annotations

import argparse
import re
import sys
from typing import Any

SUPPORTED_LANGUAGES: set[str] = {"es", "fr-CA"}

PHRASE_TRANSLATIONS: dict[str, dict[str, str]] = {
    "es": {
        "Refresh your routine for spring.": "Renueva tu rutina para la primavera.",
        "Refresh your routine.": "Renueva tu rutina.",
        "Refresh your routine": "Renueva tu rutina",
        "on your favorite Beauty brands.": "en tus marcas favoritas de belleza.",
        "on your favorite Beauty brands": "en tus marcas favoritas de belleza",
        "Spring Beauty": "Belleza de primavera",
        "The Magic of Macys": "La Magia de Macys",
        "Find Your Magic": "Encuentra Tu Magia",
        "Star Rewards": "Premios Star",
        "starting at": "desde",
        "percent off": "por ciento de descuento",
        "Up to": "Hasta",
        "ends Sunday": "termina el domingo",
        "limited time": "tiempo limitado",
        "while supplies last": "hasta agotar existencias",
    },
    "fr-CA": {
        "Refresh your routine for spring.": "Renouvelez votre routine pour le printemps.",
        "Refresh your routine.": "Renouvelez votre routine.",
        "Refresh your routine": "Renouvelez votre routine",
        "on your favorite Beauty brands.": "sur vos marques de beaute preferees.",
        "on your favorite Beauty brands": "sur vos marques de beaute preferees",
        "Spring Beauty": "Beaute du printemps",
        "The Magic of Macys": "La Magie de Macys",
        "Find Your Magic": "Trouvez Votre Magie",
        "Star Rewards": "Recompenses Star",
        "starting at": "a partir de",
        "percent off": "pourcent de rabais",
        "Up to": "Jusqu'a",
        "ends Sunday": "se termine dimanche",
        "limited time": "duree limitee",
        "while supplies last": "jusqu'a epuisement des stocks",
    },
}

_ENGLISH_STOPWORDS: set[str] = {
    "the", "and", "or", "of", "to", "in", "on", "with", "your", "you",
    "for", "from", "is", "are", "was", "were", "this", "that", "these",
    "those", "an", "at", "by", "be", "have", "has", "had",
}


def _translate(copy: str, target_language: str) -> tuple[str, list[str]]:
    """Apply phrase substitutions, return (translated_copy, applied_keys).

    Substitutions run in order of longest key first to avoid a shorter
    phrase clobbering a longer one. applied_keys records which phrases
    actually matched, so callers can audit coverage.
    """
    table = PHRASE_TRANSLATIONS[target_language]
    keys = sorted(table.keys(), key=len, reverse=True)
    translated = copy
    applied: list[str] = []
    for key in keys:
        if key in translated:
            translated = translated.replace(key, table[key])
            applied.append(key)
    return translated, applied


def _inject_regional_pricing(copy: str, regional_pricing: dict[str, Any]) -> str:
    """Append a regional price line to the translated copy.

    regional_pricing is expected to look like:
        {"effective_price_usd": 39.99, "currency": "USD"}
    or
        {"effective_price_local": 49.99, "currency": "CAD"}

    Returns the copy unchanged if the dict is empty or the price is missing.
    """
    if not regional_pricing:
        return copy
    currency = regional_pricing.get("currency", "USD")
    price = regional_pricing.get("effective_price_usd")
    if price is None:
        price = regional_pricing.get("effective_price_local")
    if price is None:
        return copy
    return f"{copy.rstrip()}\n{currency} {price:.2f}"


def _count_english_remnants(translated: str) -> int:
    """Heuristic, count English stopwords still present after translation."""
    tokens = re.findall(r"\b[a-zA-Z]+\b", translated.lower())
    return sum(1 for t in tokens if t in _ENGLISH_STOPWORDS)


def generate_locale_variants(
    copy: str,
    target_language: str,
    regional_pricing: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Produce a simulated localized variant of campaign copy.

    Args:
        copy: source English copy.
        target_language: 'es' or 'fr-CA'.
        regional_pricing: optional dict with currency and price to append.

    Returns:
        Dict with:
          status: 'pass', 'partial' (if many English stopwords remain),
                  or 'fail' (unsupported language).
          original_copy: input copy.
          translated_copy: localized result.
          target_language: echoed back.
          applied_pricing: regional_pricing echoed back, or None.
          applied_phrases: list of phrase keys that matched.
          unmatched_words: count of English stopwords still in the output.
    """
    if target_language not in SUPPORTED_LANGUAGES:
        return {
            "status": "fail",
            "original_copy": copy,
            "translated_copy": copy,
            "target_language": target_language,
            "applied_pricing": regional_pricing,
            "applied_phrases": [],
            "unmatched_words": 0,
            "error": f"Unsupported target language: {target_language}",
        }
    translated, applied = _translate(copy, target_language)
    translated = _inject_regional_pricing(translated, regional_pricing or {})
    unmatched = _count_english_remnants(translated)
    status = "partial" if unmatched > 4 else "pass"
    return {
        "status": status,
        "original_copy": copy,
        "translated_copy": translated,
        "target_language": target_language,
        "applied_pricing": regional_pricing,
        "applied_phrases": applied,
        "unmatched_words": unmatched,
    }


def _cli(argv: list[str]) -> int:
    """CLI entry, translate one piece of copy and print the result."""
    parser = argparse.ArgumentParser(description="Translate campaign copy.")
    parser.add_argument("copy")
    parser.add_argument("target_language", choices=sorted(SUPPORTED_LANGUAGES))
    args = parser.parse_args(argv)
    result = generate_locale_variants(args.copy, args.target_language)
    print(f"status: {result['status']}")
    print(f"original:   {result['original_copy']}")
    print(f"translated: {result['translated_copy']}")
    print(f"applied phrases: {result['applied_phrases']}")
    print(f"english stopwords remaining: {result['unmatched_words']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(_cli(sys.argv[1:]))
