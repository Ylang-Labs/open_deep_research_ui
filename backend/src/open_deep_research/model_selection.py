"""Model auto-selection utilities based on available provider API keys.

This module resolves effective model names for each role based on:
- User-configured model strings (env or LangGraph `configurable`)
- Available API keys (env or `configurable.apiKeys` when GET_API_KEYS_FROM_CONFIG=true)
- Preference order env overrides

Env vars (optional):
- AUTO_MODEL_SELECTION=true|false (default: true)
- PREFERRED_PROVIDER_ORDER=openai,anthropic,google
- PREFERRED_LLM_PROVIDER=openai|anthropic|google (used if order not set)
- STRICT_PROVIDER_MATCH=true|false (default: false)
"""

from __future__ import annotations

import logging
import os
from typing import Dict, List, Tuple

from langchain_core.runnables import RunnableConfig

from open_deep_research.configuration import Configuration


Provider = str  # "openai" | "anthropic" | "google"
Role = str  # "summarization_model" | "research_model" | "compression_model" | "final_report_model"


PROVIDER_KEYS: Dict[Provider, str] = {
    "openai": "OPENAI_API_KEY",
    "anthropic": "ANTHROPIC_API_KEY",
    "google": "GOOGLE_API_KEY",
}

# Default models per provider per role
DEFAULT_MODELS: Dict[Provider, Dict[Role, str]] = {
    "openai": {
        "summarization_model": "openai:gpt-4.1-mini",
        "research_model": "openai:gpt-4.1",
        "compression_model": "openai:gpt-4.1",
        "final_report_model": "openai:gpt-4.1",
    },
    "anthropic": {
        "summarization_model": "anthropic:claude-3-5-haiku",
        "research_model": "anthropic:claude-3-7-sonnet",
        "compression_model": "anthropic:claude-3-7-sonnet",
        "final_report_model": "anthropic:claude-3-7-sonnet",
    },
    "google": {
        "summarization_model": "google_genai:gemini-2.5-flash",
        "research_model": "google_genai:gemini-2.5-pro",
        "compression_model": "google_genai:gemini-2.5-pro",
        "final_report_model": "google_genai:gemini-2.5-pro",
    },
}


def _env_true(name: str, default: bool = False) -> bool:
    val = os.getenv(name)
    if val is None:
        return default
    return str(val).strip().lower() in {"1", "true", "yes", "y"}


def _read_api_keys_from_config(config: RunnableConfig) -> Dict[str, str | None]:
    keys = {k: os.getenv(k) for k in PROVIDER_KEYS.values()}

    # Optionally override from request config
    if _env_true("GET_API_KEYS_FROM_CONFIG"):
        api_keys = (config.get("configurable", {}) or {}).get("apiKeys", {}) or {}
        for provider, env_key in PROVIDER_KEYS.items():
            if api_keys.get(env_key):
                keys[env_key] = api_keys.get(env_key)
    return keys


def detect_available_providers(config: RunnableConfig) -> Tuple[Dict[Provider, bool], List[Provider]]:
    keys = _read_api_keys_from_config(config)
    availability = {provider: bool(keys.get(env_key)) for provider, env_key in PROVIDER_KEYS.items()}
    available_list = [p for p, ok in availability.items() if ok]
    return availability, available_list


def _provider_from_model(model: str | None) -> Provider | None:
    if not model:
        return None
    model_l = str(model).lower()
    if model_l.startswith("openai:"):
        return "openai"
    if model_l.startswith("anthropic:"):
        return "anthropic"
    if model_l.startswith("google"):
        return "google"
    return None


def _preference_order() -> List[Provider]:
    # Full order has priority
    order_str = os.getenv("PREFERRED_PROVIDER_ORDER")
    if order_str:
        order = [p.strip().lower() for p in order_str.split(",") if p.strip()]
        return [p for p in order if p in PROVIDER_KEYS]

    # Single preferred provider fallback
    preferred = os.getenv("PREFERRED_LLM_PROVIDER")
    base_order = ["openai", "anthropic", "google"]
    if preferred and preferred.lower() in PROVIDER_KEYS:
        p = preferred.lower()
        return [p] + [x for x in base_order if x != p]
    return base_order


def _get_user_models(configurable: Configuration) -> Dict[Role, str | None]:
    return {
        "summarization_model": configurable.summarization_model,
        "research_model": configurable.research_model,
        "compression_model": configurable.compression_model,
        "final_report_model": configurable.final_report_model,
    }


def resolve_models(config: RunnableConfig) -> Dict[Role, str]:
    """Resolve effective model names for each role.

    If AUTO_MODEL_SELECTION=false, returns user-configured values unchanged.
    Otherwise, prefer user model if its provider key is present; else fallback
    to the first available provider according to the preference order.
    Raises a ValueError if no providers are available (and no valid user model).
    """
    auto = os.getenv("AUTO_MODEL_SELECTION")
    auto_enabled = True if auto is None else _env_true("AUTO_MODEL_SELECTION")
    strict = _env_true("STRICT_PROVIDER_MATCH", default=False)

    configurable = Configuration.from_runnable_config(config)
    user_models = _get_user_models(configurable)
    availability, available_list = detect_available_providers(config)
    order = _preference_order()

    if not auto_enabled:
        # No auto selection: return as configured
        return {k: v for k, v in user_models.items() if v is not None}  # type: ignore[return-value]

    if not available_list:
        # Nothing to select from
        raise ValueError(
            "No LLM provider API keys available. Provide OPENAI_API_KEY, "
            "ANTHROPIC_API_KEY, or GOOGLE_API_KEY (via env or configurable.apiKeys), "
            "or disable AUTO_MODEL_SELECTION."
        )

    effective: Dict[Role, str] = {}

    for role, user_model in user_models.items():
        user_provider = _provider_from_model(user_model)
        if user_model and user_provider:
            if availability.get(user_provider):
                # User model is compatible with available provider
                effective[role] = user_model  # type: ignore[assignment]
                continue
            elif strict:
                raise ValueError(
                    f"STRICT_PROVIDER_MATCH is true and provider for {role} ('{user_provider}') "
                    f"is not available. Add {PROVIDER_KEYS[user_provider]} or change the model."
                )
            else:
                logging.warning(
                    f"Provider for configured {role} ('{user_provider}') not available. Falling back."
                )

        # Fallback: pick first available provider in preference order
        fallback_provider = next((p for p in order if availability.get(p)), None)
        if not fallback_provider:
            raise ValueError(
                f"No available providers for role {role}. Set one of the provider API keys or "
                f"disable AUTO_MODEL_SELECTION."
            )

        effective[role] = DEFAULT_MODELS[fallback_provider][role]

    logging.info(
        "Model auto-selection: available=%s, order=%s, effective=%s",
        available_list,
        order,
        effective,
    )
    return effective

