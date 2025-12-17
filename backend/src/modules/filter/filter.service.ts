import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditLogService } from 'src/modules/audit/auditLog.service';
import { createFilterDto } from './dto/create-filter.dto';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { Outcome } from '../../utils/types/outcome';
import { FilterRepository } from '../repository/filter.repository';

@Injectable()
export class FilterService {
    constructor(
        private readonly logger: LoggerService,
        private readonly auditLogService: AuditLogService,
        private readonly filterRepository: FilterRepository,
    ) { }

    async createFilter(createFilterDto: createFilterDto, userId: string) {
        this.logger.log(`Adding user filter : ${userId}`, FilterService.name);
        try {
            if (!createFilterDto.filterType && !createFilterDto.userFilters && !createFilterDto.user_id) {
                throw new BadRequestException('user_id, filterType and userFilters must be provided');
            }

            const getExistingfilters = await this.filterRepository.getFiltersByUserAndType(userId, createFilterDto.filterType);
            const filterAlreadyExists = getExistingfilters?.some((f) => {
                return JSON.stringify(f.user_filters) === JSON.stringify(createFilterDto.userFilters);
            });

            if (filterAlreadyExists) {
                throw new BadRequestException('Filter with same criteria already exists');
            }

            const filter = await this.filterRepository.createFilter(userId, createFilterDto);

            this.auditLogService.logAction({
                userId,
                operation: 'createFilter',
                entityName: FilterService.name,
                actionPerformed: `Saving user defined filter for ${createFilterDto.filterType}`,
                outcome: Outcome.SUCCESS,
                performedAt: new Date(),
            });

            return filter;
        } catch (error) {
            this.logger.error('Error adding filter', error, FilterService.name);
            this.auditLogService.logAction({
                userId,
                operation: 'createFilter',
                entityName: FilterService.name,
                actionPerformed: `Attempt user defined filter for ${createFilterDto.filterType}`,
                outcome: Outcome.FAILURE,
                performedAt: new Date(),
            });
        }
    }


    async deleteFilter(filter_Id: number, userId: string) {
        this.logger.log(`Deleting user filter with filter_Id: ${filter_Id}`, FilterService.name);
        try {
            if (!filter_Id) {
                throw new BadRequestException('filter Id must be provided');
            }

            const getExistingfilters = await this.filterRepository.getFiltersByfilterId(filter_Id);
            const filterAlreadyExists = getExistingfilters?.some((f) => {
                return JSON.stringify(f.filter_Id) === filter_Id.toString();
            });

            if (!filterAlreadyExists) {
                throw new BadRequestException('Filter Id does not exist');
            }

            const filter = await this.filterRepository.deleteFilter(filter_Id);

            this.auditLogService.logAction({
                userId,
                operation: 'deleteFilter',
                entityName: FilterService.name,
                actionPerformed: `Deleting user defined filter : filterId ${filter_Id}`,
                outcome: Outcome.SUCCESS,
                performedAt: new Date(),
            });

            return filter;
        } catch (error) {
            this.logger.error('Error deleting filter', error, FilterService.name);
            this.auditLogService.logAction({
                userId,
                operation: 'deleteFilter',
                entityName: FilterService.name,
                actionPerformed: `Attempt deleting user defined filter for ${filter_Id}`,
                outcome: Outcome.FAILURE,
                performedAt: new Date(),
            });
        }
    }

    async getFiltersByUserAndType(userId: string, filterType: string) {
        this.logger.log('Retrieving comment', FilterService.name);
        try {
            const filter = await this.filterRepository.getFiltersByUserAndType(userId, filterType);

            if (!filter) {
                throw new NotFoundException('Filter not found');
            }

            this.auditLogService.logAction({
                userId,
                operation: 'getFiltersByUserAndType',
                entityName: FilterService.name,
                actionPerformed: `Successfully retrieved  filter with ID: ${userId} and filterType: ${filterType}`,
                outcome: Outcome.SUCCESS,
                performedAt: new Date(),
            });

            return filter;
        } catch (error) {
            this.logger.error('Error retrieving filter', error, FilterService.name);
            this.auditLogService.logAction({
                userId,
                operation: 'getFiltersByUserAndType',
                entityName: FilterService.name,
                actionPerformed: `Error retrieving filter with ID: ${userId} and filterType: ${filterType}`,
                outcome: Outcome.FAILURE,
                performedAt: new Date(),
            });
            throw error;
        }
    }

}
