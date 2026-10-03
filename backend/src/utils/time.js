const {
  isToday: fnsIsToday,
  addMinutes: fnsAddMinutes,
  differenceInMinutes,
  parseISO,
  isValid,
} = require('date-fns');

/**
 * Check if a date string or Date object is today
 * @param {string|Date} date
 * @returns {boolean}
 */
function isToday(date) {
  if (!date) return false;
  const d = typeof date === 'string' ? parseISO(date) : date;
  return isValid(d) ? fnsIsToday(d) : false;
}

/**
 * Add minutes to a date
 * @param {string|Date} date
 * @param {number} minutes
 * @returns {Date}
 */
function addMinutes(date, minutes) {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return fnsAddMinutes(d, minutes);
}

/**
 * Checks if two time intervals overlap: (startA, endA) and (startB, endB)
 * @param {string|Date} startA
 * @param {string|Date} endA
 * @param {string|Date} startB
 * @param {string|Date} endB
 * @returns {boolean}
 */
function overlapCheck(startA, endA, startB, endB) {
  const sA = new Date(startA).getTime();
  const eA = new Date(endA).getTime();
  const sB = new Date(startB).getTime();
  const eB = new Date(endB).getTime();

  return sA < eB && eA > sB;
}

/**
 * Formats a duration in minutes to human-readable string (e.g. '2h 15m' or '45m')
 * @param {number} minutes
 * @returns {string}
 */
function formatDuration(minutes) {
  if (minutes == null || isNaN(minutes) || minutes < 0) return '0m';
  const hrs = Math.floor(minutes / 60);
  const mins = Math.floor(minutes % 60);
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

/**
 * Calculates difference in minutes between two dates (dateA - dateB)
 * @param {string|Date} dateA
 * @param {string|Date} dateB
 * @returns {number}
 */
function diffInMinutes(dateA, dateB) {
  const dA = typeof dateA === 'string' ? parseISO(dateA) : dateA;
  const dB = typeof dateB === 'string' ? parseISO(dateB) : dateB;
  return differenceInMinutes(dA, dB);
}

module.exports = {
  isToday,
  addMinutes,
  overlapCheck,
  formatDuration,
  diffInMinutes,
};
