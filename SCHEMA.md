# Land-Record Extraction Schema

This document defines the shared schema structure used by both the frontend and backend services to ensure consistency across extracted fields.

## JSON Schema Definition

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "LandRecord",
  "type": "object",
  "properties": {
    "owner_name": {
      "type": "string",
      "description": "Full name of the primary landowner/owner of record."
    },
    "survey_number": {
      "type": "string",
      "description": "The official survey number assigned to the parcel of land."
    },
    "khasra_or_khata_number": {
      "type": "string",
      "description": "The Khasra or Khata register number of the land holding."
    },
    "area": {
      "type": "number",
      "description": "The numeric area/size of the land parcel."
    },
    "area_unit": {
      "type": "string",
      "description": "The unit of measurement for area (e.g., Acres, Hectares, Guntha, Sq Feet)."
    },
    "village": {
      "type": "string",
      "description": "Village name where the land is situated."
    },
    "taluk": {
      "type": "string",
      "description": "Taluk/Tehsil sub-district name."
    },
    "district": {
      "type": "string",
      "description": "District name."
    },
    "land_classification": {
      "type": "string",
      "description": "Type of land use classification (e.g., Agricultural, Non-Agricultural, Residential, Wet Land)."
    },
    "khata_type": {
      "type": ["string", "null"],
      "enum": ["A", "B", null],
      "description": "Khata registry classification type (A Khata, B Khata, or null)."
    },
    "tenancy_status": {
      "type": "string",
      "description": "Tenancy classification (e.g., Owner-cultivated, Leased, Tenant-occupied)."
    },
    "liabilities": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Array of strings listing any mortgages, loans, charges, or legal disputes active on the property."
    },
    "tax_status": {
      "type": "string",
      "description": "Property tax payment status (e.g., Paid, Outstanding, Exempt)."
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
