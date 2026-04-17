---
name: data-model-mapping
description: Maps input data into structured database schemas. Use before persisting data.
---

# Data Model Mapping

## Objective
Transform raw input into DB-ready format.

## Required inputs
```yaml
input:
  raw_data: object
  type: string
```

## Workflow
1. **Identify target table**.
2. **Map fields** to schema.
3. **Normalize formats**.
4. **Return structured object**.

## Validation
- Schema compliance required.

## Expected outputs
```yaml
mapped:
  table: string
  data: object
```

## Constraints
- No missing required fields.
