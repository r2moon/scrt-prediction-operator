import {inject} from '@loopback/core';
import {CronJob, cronJob} from '@loopback/cron';
import {MainService} from '.';

@cronJob()
export class MainCronJobService extends CronJob {
  constructor(
    @inject('services.MainService')
    private mainService: MainService,
  ) {
    super({
      name: 'main-cronjob',
      onTick: async () => {
        try {
          await this.mainService.checkRound();
        } catch (err) {
          console.error(err);
        }
      },
      cronTime: '*/10 * * * * *',
      start: true,
    });
  }
}
