import { config } from '../config';
import { schedulerService } from '../v1/services/scheduler-service';
import { logger as log } from '../logger';
import advisoryLock from 'advisory-lock';
import { createJob } from './create-job';

const SCHEDULER_NAME = 'EmailExpiringAnnouncements';
const mutex = advisoryLock(config.get('server:databaseUrl'))(
  `${SCHEDULER_NAME}-lock`,
);
const crontime = config.get('server:emailExpiringAnnouncementsCronTime');

export default createJob(
  crontime,
  async () => {
    log.info(`Starting scheduled job '${SCHEDULER_NAME}'.`);
    await schedulerService.sendAnnouncementExpiringEmails();
    log.info(`Completed scheduled job '${SCHEDULER_NAME}'.`);
  },
  mutex,
  {
    title: `Error in ${SCHEDULER_NAME}`,
    message: `Error in scheduled job: ${SCHEDULER_NAME}`,
  },
);
