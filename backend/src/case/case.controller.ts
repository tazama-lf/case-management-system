import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CaseService } from './case.service';
import { CreateCaseDto } from './dto/create-case.dto';
import { UpdateCaseDto } from './dto/update-case.dto';
import { TazamaAuthGuard } from 'src/auth/tazama-auth.guard';
import { RequireCMSTestRole } from 'src/auth/auth.decorator';
import { AuthenticatedRequest } from 'src/auth/auth.types';

@Controller('api/v1/cases')
@UseGuards(TazamaAuthGuard)
export class CaseController {
  constructor(private readonly caseService: CaseService) {}

  @Post()
  @RequireCMSTestRole()
  async createCase(
    @Body() dto: CreateCaseDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user.token.clientId;
    return this.caseService.createCase(dto, userId);
  }

  @Get(':caseId')
  @RequireCMSTestRole()
  async getCase(@Param('caseId') caseId: string) {
    return this.caseService.retrieveCase(caseId);
  }

  @Post(':caseId')
  @RequireCMSTestRole()
  async updateCase(
    @Param('caseId') caseId: string,
    @Body() dto: UpdateCaseDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user.token.clientId;
    return this.caseService.updateCase(caseId, dto, userId);
  }
}
