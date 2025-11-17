import { NotFoundException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';

export class AlertDatabaseService {
  constructor(private readonly prisma: PrismaService) {}

  //   async createAlert(alertData: )

  async getAlertById(alertId: string) {
    const alert = await this.prisma.alert.findUnique({
      where: { alert_id: alertId },
    });

    if (!alert) {
      throw new NotFoundException(`Alert with ID ${alertId} not found`);
    }

    return alert;
  }
}
