import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UnassignTaskDto {
    @ApiProperty({
        description: 'Optional reason for unassigning the task',
        example: 'Task reassigned to more suitable investigator',
        required: false,
        maxLength: 500
    })
    @IsOptional()
    @IsString()
    @MaxLength(500, { message: 'Reason must not exceed 500 characters' })
    reason: string;
}