const otCaseRepo = require('../repositories/otCase.repo');
const alertRepo = require('../repositories/alert.repo');
const emitter = require('../sockets/emitter');
const logger = require('../utils/logger');

/**
 * Runs every 60s: inspects active OT cases for completion time overruns
 */
async function checkOtOverruns() {
  try {
    const overrunCases = await otCaseRepo.findOverrunCases();
    for (const c of overrunCases) {
      const overrunMinutes = c.overrunMinutes || 1;
      const dedupeKey = `ALERT_OT_OVERRUN_${c.id}`;

      const alert = await alertRepo.createAlert({
        severity: 'high',
        title: `OT Overrun: ${c.roomName} (${c.caseNumber})`,
        message: `Procedure '${c.procedureName}' in ${c.roomName} has overrun its scheduled completion time by ${overrunMinutes} minute(s).`,
        relatedType: 'ot_case',
        relatedId: c.id,
        dedupeKey,
      });

      emitter.emitOtOverrun({
        caseId: c.id,
        roomId: c.roomId,
        overrunMinutes,
      });

      emitter.emitAlertCreated({
        alertId: alert.id,
        severity: 'high',
        title: alert.title,
        department: 'OT',
      });
    }
  } catch (err) {
    logger.error({ err: err.message }, 'Error in OT overrun status job');
  }
}

module.exports = {
  checkOtOverruns,
};
