# Land-Record Extraction Schema

This document defines the shared schema structure used by both the frontend and backend services to ensure consistency across extracted fields.

## Confidence Bands & Thresholds

Each field is extracted along with a confidence rating (float between `0.0` and `1.0`). Depending on this score, fields are classified into the following bands:

| Band | Threshold | Action |
| --- | --- | --- |
| **`auto_approved`** | `>= 0.9` | No human intervention required. Field is saved immediately. |
| **`needs_review`** | `0.6` to `0.89` | Flagged for quick verification by the operator. |
| **`needs_correction`** | `< 0.6` | High risk of error/illegible field. Requires manual correction. |

## JSON Schema Definition

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "LandRecord",
  "type": "object",
  "properties": {
    "owner_name": {
      "type": "object",
      "properties": {
        "value": { "type": "string" },
        "confidence": { "type": "number", "minimum": 0.0, "maximum": 1.0 }
      },
      "required": ["value", "confidence"]
    },
    "survey_number": {
      "type": "object",
      "properties": {
        "value": { "type": "string" },
        "confidence": { "type": "number", "minimum": 0.0, "maximum": 1.0 }
      },
      "required": ["value", "confidence"]
    },
    "khasra_or_khata_number": {
      "type": "object",
      "properties": {
        "value": { "type": "string" },
        "confidence": { "type": "number", "minimum": 0.0, "maximum": 1.0 }
      },
      "required": ["value", "confidence"]
    },
    "area": {
      "type": "object",
      "properties": {
        "value": { "type": "number" },
        "confidence": { "type": "number", "minimum": 0.0, "maximum": 1.0 }
      },
      "required": ["value", "confidence"]
    },
    "area_unit": {
      "type": "object",
      "properties": {
        "value": { "type": "string" },
        "confidence": { "type": "number", "minimum": 0.0, "maximum": 1.0 }
      },
      "required": ["value", "confidence"]
    },
    "village": {
      "type": "object",
      "properties": {
        "value": { "type": "string" },
        "confidence": { "type": "number", "minimum": 0.0, "maximum": 1.0 }
      },
      "required": ["value", "confidence"]
    },
    "taluk": {
      "type": "object",
      "properties": {
        "value": { "type": "string" },
        "confidence": { "type": "number", "minimum": 0.0, "maximum": 1.0 }
      },
      "required": ["value", "confidence"]
    },
    "district": {
      "type": "object",
      "properties": {
        "value": { "type": "string" },
        "confidence": { "type": "number", "minimum": 0.0, "maximum": 1.0 }
      },
      "required": ["value", "confidence"]
    },
    "land_classification": {
      "type": "object",
      "properties": {
        "value": { "type": "string" },
        "confidence": { "type": "number", "minimum": 0.0, "maximum": 1.0 }
      },
      "required": ["value", "confidence"]
    },
    "khata_type": {
      "type": "object",
      "properties": {
        "value": { "type": ["string", "null"], "enum": ["A", "B", null] },
        "confidence": { "type": "number", "minimum": 0.0, "maximum": 1.0 }
      },
      "required": ["value", "confidence"]
    },
    "tenancy_status": {
      "type": "object",
      "properties": {
        "value": { "type": "string" },
        "confidence": { "type": "number", "minimum": 0.0, "maximum": 1.0 }
      },
      "required": ["value", "confidence"]
    },
    "liabilities": {
      "type": "object",
      "properties": {
        "value": { "type": "array", "items": { "type": "string" } },
        "confidence": { "type": "number", "minimum": 0.0, "maximum": 1.0 }
      },
      "required": ["value", "confidence"]
    },
    "tax_status": {
      "type": "object",
      "properties": {
        "value": { "type": "string" },
        "confidence": { "type": "number", "minimum": 0.0, "maximum": 1.0 }
      },
      "required": ["value", "confidence"]
    }
  },
  "required": [
    "owner_name",
    "survey_number",
    "khasra_or_khata_number",
    "area",
    "area_unit",
    "village",
    "taluk",
    "district",
    "land_classification",
    "khata_type",
    "tenancy_status",
    "liabilities",
    "tax_status"
  ]
}
```
