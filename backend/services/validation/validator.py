import os
import re
import yaml
from datetime import datetime

# Path to rules.yaml config
RULES_FILE = os.path.join(os.path.dirname(__file__), "rules.yaml")

def load_rules():
    """Loads rules from the local rules.yaml file."""
    if not os.path.exists(RULES_FILE):
        # Fallback default rules if yaml config doesn't exist
        return {
            "area_limits": {"min_area": 0.01, "max_area": 50.0},
            "survey_number_patterns": {"default": "^[0-9A-Za-z\\s\\-/]+$"}
        }
    with open(RULES_FILE, "r") as f:
        return yaml.safe_load(f)

def validate_record(record: dict, existing_records: list = None) -> tuple:
    """
    Checks the confidence-annotated record against business rules in rules.yaml.
    Returns:
        (annotated_record, issues_list)
    """
    rules = load_rules()
    issues = []
    annotated_record = json_deep_copy(record)
    
    if existing_records is None:
        existing_records = []
        
    # --- 1. Area Validation ---
    area_data = annotated_record.get("area", {})
    area_val = area_data.get("value")
    if area_val is not None:
        limits = rules.get("area_limits", {})
        min_area = limits.get("min_area", 0.01)
        max_area = limits.get("max_area", 50.0)
        
        if area_val <= 0:
            msg = f"Area must be a positive number. Found: {area_val}."
            issues.append({"field": "area", "message": msg})
            downgrade_field(annotated_record, "area")
        elif area_val < min_area:
            msg = f"Area size {area_val} is below the min limit of {min_area}."
            issues.append({"field": "area", "message": msg})
            downgrade_field(annotated_record, "area")
        elif area_val > max_area:
            msg = f"Plausible maximum size exceeded. Area {area_val} exceeds limit of {max_area}."
            issues.append({"field": "area", "message": msg})
            downgrade_field(annotated_record, "area")

    # --- 2. Survey Number Validation ---
    survey_data = annotated_record.get("survey_number", {})
    survey_val = survey_data.get("value")
    village_data = annotated_record.get("village", {})
    village_val = village_data.get("value")
    
    if survey_val:
        patterns = rules.get("survey_number_patterns", {})
        # Check if there is a village-specific pattern, otherwise fallback to default
        pattern_str = patterns.get(village_val) if village_val in patterns else patterns.get("default")
        
        if pattern_str:
            try:
                if not re.match(pattern_str, str(survey_val)):
                    msg = f"Survey number '{survey_val}' does not match pattern requirements for village '{village_val}'."
                    issues.append({"field": "survey_number", "message": msg})
                    downgrade_field(annotated_record, "survey_number")
            except re.error as err:
                print(f"[Validator Warning] Regex compile error: {err}")

    # --- 3. Date Fields Validation (if present in the record) ---
    # Look for any fields with 'date' in their name
    for key, field_data in annotated_record.items():
        if "date" in key.lower() and isinstance(field_data, dict):
            date_val = field_data.get("value")
            if date_val:
                try:
                    # Attempt parsing standard formats (YYYY-MM-DD)
                    parsed_date = datetime.strptime(str(date_val).strip(), "%Y-%m-%d")
                    if parsed_date > datetime.now():
                        msg = f"Date field '{key}' value '{date_val}' is in the future."
                        issues.append({"field": key, "message": msg})
                        downgrade_field(annotated_record, key)
                except ValueError:
                    msg = f"Date field '{key}' has an invalid format: '{date_val}' (Expected YYYY-MM-DD)."
                    issues.append({"field": key, "message": msg})
                    downgrade_field(annotated_record, key)

    # --- 4. Duplicate Record Detection ---
    # Flag if another record has the same survey_number + village but different owner_name
    if survey_val and village_val:
        owner_data = annotated_record.get("owner_name", {})
        owner_val = owner_data.get("value")
        
        for r in existing_records:
            r_survey = r.get("survey_number", {}).get("value")
            r_village = r.get("village", {}).get("value")
            r_owner = r.get("owner_name", {}).get("value")
            
            if (str(r_survey).strip().lower() == str(survey_val).strip().lower() and 
                str(r_village).strip().lower() == str(village_val).strip().lower() and 
                str(r_owner).strip().lower() != str(owner_val).strip().lower()):
                
                msg = f"Duplicate parcel detected! Survey number '{survey_val}' in village '{village_val}' is already registered under owner '{r_owner}'."
                issues.append({"field": "survey_number", "message": msg})
                downgrade_field(annotated_record, "survey_number")
                break

    return annotated_record, issues

def downgrade_field(record: dict, field_name: str):
    """Downgrades the confidence score of a field to force a 'needs_correction' review status."""
    if field_name in record and isinstance(record[field_name], dict):
        record[field_name]["confidence"] = 0.50  # Below 0.6 threshold

def json_deep_copy(data):
    """Quick deep copy helper using json serialization."""
    import json
    return json.loads(json.dumps(data))
