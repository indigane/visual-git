
/**
 * @typedef {CustomEvent<RateLimitEventDetail>} RateLimitEvent
 * @property {RateLimitEventDetail} detail
 * @typedef {Object} RateLimitEventDetail
 * @property {number} usedCount - The amount of requests used of the current rate limit quota.
 * @property {number} totalCount - The total amount of requests available in the current rate limit quota.
 */
