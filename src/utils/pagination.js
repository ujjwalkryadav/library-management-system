function getPaginationParams(req, defaultLimit = 10, maxLimit = 100) {
  let page = parseInt(req.query.page, 10) || 1;
  let limit = parseInt(req.query.limit, 10) || defaultLimit;

  if (page < 1) page = 1;
  if (limit < 1) limit = defaultLimit;
  if (limit > maxLimit) limit = maxLimit;

  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

function buildPaginationMeta(totalItems, currentPage, limit, originalUrl = '') {
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));
  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;

  // Clean URL to append/update page param
  const urlObj = new URL(originalUrl || '/', 'http://localhost');
  
  function getPageUrl(p) {
    urlObj.searchParams.set('page', p);
    return `${urlObj.pathname}?${urlObj.searchParams.toString()}`;
  }

  // Calculate page range for pagination buttons (e.g. 1 2 3 4 5)
  const delta = 2;
  const range = [];
  for (let i = Math.max(2, currentPage - delta); i <= Math.min(totalPages - 1, currentPage + delta); i++) {
    range.push(i);
  }

  if (currentPage - delta > 2) {
    range.unshift('...');
  }
  if (currentPage + delta < totalPages - 1) {
    range.push('...');
  }

  range.unshift(1);
  if (totalPages > 1) {
    range.push(totalPages);
  }

  return {
    totalItems,
    currentPage,
    limit,
    totalPages,
    hasPrev,
    hasNext,
    prevUrl: hasPrev ? getPageUrl(currentPage - 1) : null,
    nextUrl: hasNext ? getPageUrl(currentPage + 1) : null,
    range,
    getPageUrl
  };
}

module.exports = {
  getPaginationParams,
  buildPaginationMeta
};
