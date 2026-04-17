---
name: cash-movement-recording
description: Records financial movements (payments, incomes, expenses, banks). Use when creating or processing any monetary transaction input in a financial system.
---

# Cash Movement Recording

## Objective
Register a financial movement in a structured, validated, and consistent format.

## Required inputs
```yaml
movement:
  type: payment | income | expense | bank
  user: optional
  agent: optional
  bank: required
  amount: required
  category: optional
  subcategory: optional
  receipt_url: optional
  timestamp: optional
```

## Workflow
1. **Identify** movement type.
2. **Validate** required fields:
   - `payment` → user, amount, bank
   - `income` → agent, amount, bank
   - `expense` → amount, category
   - `bank` → bank, balance
3. **Normalize**:
   - `amount` > 0
   - `timestamp` → ISO format
4. **Apply defaults**:
   - `timestamp` = now if missing
5. **Build** structured record.
6. **Return** DB-ready object.

## Validation
- `amount` must be numeric > 0
- `type` must be valid
- `required fields` must exist

## Expected outputs
```yaml
record:
  type: string
  data: object
```

## Constraints
- Never infer missing financial data.
- Do not mutate input silently.
