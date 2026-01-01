import { Injectable } from "@nestjs/common";
import { PrismaService } from "prisma/prisma.service";
import { createFilterDto } from "../filter/dto/create-filter.dto";

@Injectable()
export class FilterRepository {
    constructor(private readonly prisma: PrismaService) { }

    async createFilter(userId: string, createFilterDto: createFilterDto) {
        return await this.prisma.filters.create({
            data: {
                user_Id: userId,
                filter_type: createFilterDto.filterType,
                user_filters: createFilterDto.userFilters
            },
        });
    }

    async getFiltersByUserAndType(userId: string, filterType: string) {
        return await this.prisma.filters.findMany({
            where: {
                user_Id: userId,
                filter_type: filterType,
            },
            orderBy: {
                created_at: 'desc',
            },
        });
    }

}