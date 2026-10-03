const { z } = require('zod');
const { BED_STATUS } = require('../config/constants');

const updateBedStatusSchema = z.object({
  body: z.object({
    status: z.enum([
      BED_STATUS.AVAILABLE,
      BED_STATUS.OCCUPIED,
      BED_STATUS.CLEANING,
      BED_STATUS.MAINTENANCE,
      BED_STATUS.RESERVED,
    ]),
  }),
});

module.exports = {
  updateBedStatusSchema,
};
