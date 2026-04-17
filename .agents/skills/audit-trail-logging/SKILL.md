---
name: audit-trail-logging
description: Logs all actions and changes for traceability. Use on every create, update, or delete operation.
---

# Audit Trail Logging

## Objective
Maintain immutable logs of all system actions.

## Required inputs
```yaml
event:
  action: create | update | delete
  entity: string
  user: string
  timestamp: string
  changes: object
```

## Workflow
1. **Capture metadata**.
2. **Capture before/after state** (if update).
3. **Create immutable log entry**.
4. **Store log**.

## Validation
- `user` required.
- `timestamp` required.

## Expected outputs
```yaml
log:
  status: stored
```

## Constraints
- Logs must be immutable.
- Never overwrite logs.
