---
name: google-sheets-db-operations
description: Performs CRUD operations on Google Sheets database. Use for MVP persistence layer.
---

# Google Sheets DB Operations

## Objective
Persist and retrieve data using Google Sheets.

## Required inputs
```yaml
operation:
  type: create | read | update | delete
  table: string
  data: object
```

## Workflow
1. **Connect to API**.
2. **Execute operation**.
3. **Handle response**.
4. **Return result**.

## Validation
- Valid operation.
- Table exists.

## Expected outputs
```yaml
result:
  status: success | error
  data: object
```

## Constraints
- Ensure idempotency when possible.
