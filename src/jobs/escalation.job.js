const alertRepo = require('../repositories/alert.repo');
const emitter = require('../sockets/emitter');
const logger = require('../utils/logger');
const { diffInMinutes } = require('../utils/time');

/**
 * Runs every 30s: checks open alerts and escalates priority if unacknowledged
 */
async function escalateAlerts() {
  try {
    const openAlerts = await alertRepo.findAlertsForEscalation();
    const now = new Date();

    for (const a of openAlerts) {
      const minutesOpen = diffInMinutes(now, a.createdAt);

      if (a.escalationLevel === 1 && minutesOpen >= 5) {
        await alertRepo.escalateAlert(a.id, 2);
        emitter.emitAlertEscalated({ alertId: a.id, newLevel: 2 });
        logger.info(
          { alertId: a.id, title: a.title },
          'Alert escalated to Level 2 (5+ min unacknowledged)'
        );
      } else if (a.escalationLevel === 2 && minutesOpen >= 10) {
        await alertRepo.escalateAlert(a.id, 3);
        emitter.emitAlertEscalated({ alertId: a.id, newLevel: 3 });
        logger.warn(
          { alertId: a.id, title: a.title },
          'Alert escalated to Level 3 (10+ min unacknowledged)'
        );
      }
    }
  } catch (err) {
    logger.error({ err: err.message }, 'Error in alert escalation job');
  }
}

module.exports = {
  escalateAlerts,
};
