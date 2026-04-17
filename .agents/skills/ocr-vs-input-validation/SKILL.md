---
name: ocr-vs-input-validation
description: Compares OCR data with user input and flags discrepancies. Use after OCR processing.
---

# OCR vs Input Validation

## Objective
Detect mismatches between OCR and user input.

## Required inputs
```yaml
input:
  amount: number
  date: string
ocr:
  amount: number
  date: string
```

## Workflow
1. **Compare amount**.
2. **Compare date**.
3. **Identify differences**.
4. **Generate alert** if mismatch.

## Validation
- Both inputs must exist.

## Expected outputs
```yaml
comparison:
  match: true | false
  differences: []
```

## Constraints
- Do not block flow.
