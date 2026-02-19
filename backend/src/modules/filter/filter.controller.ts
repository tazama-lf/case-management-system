import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { TazamaAuthGuard } from 'src/guards/tazama-auth.guard';
import { createFilterDto } from './dto/create-filter.dto';
import { FilterService } from './filter.service';
import { AuthenticatedRequest } from 'src/utils/types/auth.types';
import { RequireInvestigatorOrSupervisorRole, RequireInvestigatorOrSupervisorRoleOrComplianceRole } from 'src/decorators/auth.decorator';

@Controller('api/v1/filter')
@UseGuards(TazamaAuthGuard)
export class FilterController {
  constructor(private readonly filterService: FilterService) {}

  @Post('create')
  @RequireInvestigatorOrSupervisorRoleOrComplianceRole()
  async createFilter(@Body() createFilterDto: createFilterDto, @Req() req: AuthenticatedRequest) {
    const userId = req.user.token.clientId;
    return await this.filterService.createFilter(createFilterDto, userId);
  }

  @Get('user/:userId/filterType/:filterType')
  @RequireInvestigatorOrSupervisorRoleOrComplianceRole()
  async getFiltersByUser(@Param('userId') userId: string, @Param('filterType') filterType: string) {
    return await this.filterService.getFiltersByUserAndType(userId, filterType);
  }
}
