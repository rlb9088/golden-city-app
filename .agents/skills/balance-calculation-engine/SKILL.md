---
name: balance-calculation-engine
description: Computes agent and global balances based on financial data. Use when calculating or recalculating balances.
---

# Balance Calculation Engine

## Objective
Compute accurate balances for agents and global system.

## Required inputs
```yaml
data:
  payments: []
  incomes: []
  expenses: []
  banks: []
```

## Workflow
1. **Calculate agent balance**:
   `sum(incomes) - sum(payments)`
2. **Calculate global balance**:
   `sum(agent balances) + sum(banks) - sum(expenses)`
3. **Ensure consistency**:
   No missing references.

## Validation
- All amounts numeric.
- No null values in calculations.

## Expected outputs
```yaml
balance:
  agents:
    - agent_id: value
  global: value
```

## Constraints
- Never mutate source data.
- Always recompute from source of truth.
