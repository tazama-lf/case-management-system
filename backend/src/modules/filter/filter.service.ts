import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createFilterDto } from './dto/create-filter.dto';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { Outcome } from '../../utils/types/outcome';
import { FilterRepository } from '../repository/filter.repository';
import { filters } from '@prisma/client-cms';

@Injectable()
export class FilterService {
  constructor(
    private readonly logger: LoggerService,
    private readonly filterRepository: FilterRepository,
  ) {}

  async createFilter(createFilterDto: createFilterDto, userId: string): Promise<filters> {
    this.logger.log(`Adding user filter : ${userId}`, FilterService.name);
    try {
      if (!createFilterDto.filterType && !createFilterDto.userFilters && !createFilterDto.user_id) {
        throw new BadRequestException('user_id, filterType and userFilters must be provided');
      }

      const getExistingfilters = await this.filterRepository.getFiltersByUserAndType(userId, createFilterDto.filterType);
      const filterAlreadyExists = getExistingfilters?.some(
        (f) => JSON.stringify(f.user_filters) === JSON.stringify(createFilterDto.userFilters),
      );

      if (filterAlreadyExists) {
        throw new ConflictException('Filter with same criteria already exists');
      }

      const filter = await this.filterRepository.createFilter(userId, createFilterDto);

      return filter;
    } catch (error) {
      this.logger.error('Error adding filter', error, FilterService.name);

      // Re-throw the error so the controller can handle it properly
      throw error;
    }
  }

  async getFiltersByUserAndType(userId: string, filterType: string): Promise<filters[] | null> {
    this.logger.log('Retrieving comment', FilterService.name);
    try {
      const filter = await this.filterRepository.getFiltersByUserAndType(userId, filterType);

      if (!filter) {
        throw new NotFoundException('Filter not found');
      }

      return filter;
    } catch (error) {
      this.logger.error('Error retrieving filter', error, FilterService.name);
      throw error;
    }
  }
}
