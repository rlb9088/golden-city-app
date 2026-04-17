const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;

function parsePositiveInt(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizePagination(limit, offset) {
  const parsedLimit = parsePositiveInt(limit);
  const parsedOffset = parsePositiveInt(offset);

  return {
    limit: Math.min(Math.max(parsedLimit ?? DEFAULT_LIMIT, 1), MAX_LIMIT),
    offset: Math.max(parsedOffset ?? 0, 0),
  };
}

function paginateItems(items, limit, offset) {
  const normalized = normalizePagination(limit, offset);
  const total = items.length;

  return {
    items: items.slice(normalized.offset, normalized.offset + normalized.limit),
    pagination: {
      limit: normalized.limit,
      offset: normalized.offset,
      total,
      hasMore: normalized.offset + normalized.limit < total,
    },
  };
}

module.exports = {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  normalizePagination,
  paginateItems,
};
