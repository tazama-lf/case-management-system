import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiParam, ApiResponse } from '@nestjs/swagger';
import { RequireInvestigatorOrSupervisorRole, RequireInvestigatorOrSupervisorRoleOrComplianceRole } from 'src/decorators/auth.decorator';
import { AuthenticatedRequest, AuthenticatedUser } from 'src/utils/types/auth.types';
import { TazamaAuthGuard } from 'src/guards/tazama-auth.guard';
import { User } from 'src/decorators/user.decorator';
import { UserGroupDetails } from '../../utils/types/UserList';
import { UserService } from './user.service';

@Controller('/v1/user')
@UseGuards(TazamaAuthGuard)
@ApiBearerAuth('jwt')
export class UserController {
    constructor(private readonly userService: UserService) { }

    @Get('list-by-role/:role')
    @RequireInvestigatorOrSupervisorRoleOrComplianceRole()
    @ApiParam({ name: 'role', required: true, description: 'Role to filter users by', example: 'CMS_SUPERVISOR' })
    @ApiResponse({ status: 200, description: 'List of users with the specified role' })
    async getUsers(@Param('role') role: string, @Req() req: AuthenticatedRequest, @User() user: AuthenticatedUser) {
        const users: UserGroupDetails[] = await this.userService.getUsersByRole(
            req.headers.authorization!.replace('Bearer ', ''),
            role,
            user.token.tenantName,
        );
        return users;
    }
}
