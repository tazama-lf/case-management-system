import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReassignTaskDto {
  @ApiProperty({
    description: 'UUID of the user to reassign the task to',
    example: '0e6d70a0-7e4c-41c4-bdd1-50336ea6020f',
    format: 'uuid',
  })
  @IsString()
  @IsNotEmpty({ message: 'assignedUserId is required' })
  assignedUserId: string;
}