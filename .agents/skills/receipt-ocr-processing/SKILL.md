---
name: receipt-ocr-processing
description: Extracts amount and date from receipt images using OCR. Use when processing uploaded receipts.
---

# Receipt OCR Processing

## Objective
Extract structured financial data from receipt images.

## Required inputs
```yaml
receipt:
  url: string
```

## Workflow
1. **Send image** to OCR service.
2. **Extract**:
   - `amount`
   - `date`
3. **Normalize values**.

## Validation
- Ensure `amount` detected.
- Ensure `date` detected.

## Expected outputs
```yaml
ocr:
  amount: number
  date: string
```

## Constraints
- Do not guess missing values.
