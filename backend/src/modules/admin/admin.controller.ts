import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { TazamaAuthGuard } from 'src/guards/tazama-auth.guard';
import { ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { RequireAdminRole } from 'src/decorators/auth.decorator';
import { RegisterReferenceIdDto } from './dto/RegisterReferenceId.dto';

@Controller('admin')
@UseGuards(TazamaAuthGuard)
@ApiBearerAuth('jwt')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('reference-id')
  @RequireAdminRole()
  @ApiBody({ description: 'EndToEndIdPathCreateInput', type: RegisterReferenceIdDto })
  async registerReferenceId(@Body() idData: RegisterReferenceIdDto) {
    const result = await this.adminService.registerReferenceId(idData);
    return result;
  }
}
