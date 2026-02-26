import { Body, Controller, Post, UseGuards, Get } from '@nestjs/common';
import { AdminService } from './admin.service';
import { TazamaAuthGuard } from 'src/guards/tazama-auth.guard';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RequireAdminRole } from 'src/decorators/auth.decorator';
import { RegisterReferenceIdDto } from './dto/RegisterReferenceId.dto';
import { ReferenceIdDetailsDto } from './dto/GetReferenceIdsQueryDto';
import { Audit } from '../audit/decorators/audit-log.decorator';

@Controller('admin')
@UseGuards(TazamaAuthGuard)
@ApiBearerAuth('jwt')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('reference-id')
  @RequireAdminRole()
  @Audit()
  @ApiBody({ description: 'EndToEndIdPathCreateInput', type: RegisterReferenceIdDto })
  async registerReferenceId(@Body() idData: RegisterReferenceIdDto) {
    const result = await this.adminService.registerReferenceId(idData);
    return result;
  }

  @Get('referencesIds/all')
  @RequireAdminRole()
  @ApiOperation({
    summary: 'Get all reference_id',
    description: 'Retrieves all reference_ids',
  })
  @ApiResponse({
    status: 200,
    description: 'Cases retrieved successfully',
    type: ReferenceIdDetailsDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Requires admin role' })
  async getReferenceIds() {
    const result = await this.adminService.getReferenceIds();
    return result;
  }
}
