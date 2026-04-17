---
name: financial-validation-rules
description: Validates financial records and detects inconsistencies. Use before or after recording transactions.
---

# Financial Validation Rules

## Objective
Ensure financial data correctness.

## Required inputs
```yaml
record:
  type: string
  amount: number
  bank: string
  timestamp: string
```

## Workflow
1. **Validate** amount > 0.
2. **Validate** required fields.
3. **Validate** timestamp format.
4. **Detect anomalies**:
   - Negative values.
   - Missing references.
5. **Return** validation result.

## Validation
- Strict schema enforcement.

## Expected outputs
```yaml
validation:
  valid: true | false
  issues: []
```

## Constraints
- Never auto-correct data.
