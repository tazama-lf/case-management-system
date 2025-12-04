import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { Priority } from '@prisma/client';

@Injectable()
export class AlertPriorityService implements OnModuleInit {
    private readonly logger = new Logger(AlertPriorityService.name);
    private urgencyThresholds: number[];
    private defaultSlaHours: number;

    constructor(
        private readonly prisma: PrismaService,
        private readonly configService: ConfigService,
    ) {
        // Load configuration values
        this.urgencyThresholds = [
            parseFloat(this.configService.get<string>('PRIORITY_FIRST_HALF', '0.33')),
            parseFloat(this.configService.get<string>('PRIORITY_SECOND_HALF', '0.66')),
            parseFloat(this.configService.get<string>('PRIORITY_THIRD_HALF', '1.0')),
        ];
        this.defaultSlaHours = parseInt(this.configService.get<string>('DEFAULT_SLA_HOURS', '72'), 10);
    }

    onModuleInit() {
        this.logger.log('Alert priority service initialized. Recalculation will run via configurable scheduled task.');
    }

    async runRecalculation() {
        this.logger.log('Starting alert priority recalculation job...');
        const alerts = await this.prisma.alert.findMany();
        if (!alerts.length) {
            this.logger.log('No alerts to process.');
            return;
        }
        for (const alert of alerts) {
            try {
                const slaHours = this.defaultSlaHours;
                const createdAt = new Date(alert.created_at);
                const now = new Date();
                const elapsedHours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
                const slaProgress = elapsedHours / slaHours;
                // Determine priority based on priority_score thresholds
                const priorityScore = slaProgress;
                let priority: Priority = Priority.NEW;
                if (priorityScore >= this.urgencyThresholds[2]) {
                    priority = Priority.BREACH;
                } else if (priorityScore >= this.urgencyThresholds[1]) {
                    priority = Priority.CRITICAL;
                } else if (priorityScore >= this.urgencyThresholds[0]) {
                    priority = Priority.URGENT;
                } else {
                    priority = Priority.NEW;
                }
                // Update alert priority and priority_score
                await this.prisma.alert.update({
                    where: { alert_id: alert.alert_id },
                    data: {
                        priority: priority,
                        priority_score: priorityScore,
                    },
                });
                // Update associated case priority if it exists
                if (alert.case_id) {
                    await this.prisma.case.update({
                        where: { case_id: alert.case_id },
                        data: {
                            priority: priority,
                        },
                    });
                }
                this.logger.debug(`Alert ${alert.alert_id}: priority_score=${priorityScore} priority=${priority}`);
            } catch (err) {
                this.logger.error(`Failed to process alert ${alert.alert_id}: ${err}`, (err as Error).stack);
            }
        }
        this.logger.log('Alert priority recalculation job complete.');
    }
}
