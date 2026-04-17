---
name: financial-system-testing
description: Tests financial system correctness including transactions and balances. Use when validating system integrity.
---

# Financial System Testing

## Objective
Ensure system correctness and consistency.

## Required inputs
```yaml
test_cases: []
```

## Workflow
1. **Validate transactions**.
2. **Recalculate balances**.
3. **Test edge cases**:
   - Zero values.
   - Duplicates.
4. **Compare** expected vs actual.

## Validation
- All tests executed.

## Expected outputs
```yaml
results:
  passed: []
  failed: []
```

## Constraints
- Must cover critical paths.
