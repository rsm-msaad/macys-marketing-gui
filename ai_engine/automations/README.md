# automations/

Deterministic workflow steps that require no LLM judgment. Each automation is pure Python: dict lookups, database queries, rule based scoring, timezone math, or template filling.

No SKILL.md files here. If a step needs LLM reasoning, it belongs in `skills/` instead.

## Contents

| Automation | Origin | What It Does |
| --- | --- | --- |
| `audience-segment-builder/` | M2 | RFM clustering on 50,000 customers, returns 3 segments |
| `dam-asset-finder/` | M2 | Filters and ranks DAM assets by relevance and quality |
| `localization-generator-v1/` | M2 | Generates 40 regional variants from templates and regional context dicts |
| `campaign-performance-analyzer/` | M2 | Last touch attribution and linear regression forecasting |
| `localization-generator/` | M3 | Region to language mapping, regional pricing, holiday overlays |
| `activation-scheduler/` | M3 | Timezone aware channel scheduling (email, social, display, signage) |
