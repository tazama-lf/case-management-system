import { IsString, IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UnassignTaskDto {
    @ApiProperty({
        description: 'Reason for unassigning the task (minimum 10 characters)',
        example: 'Reassigning due to workload constraints and priority conflicts',
        minLength: 10,
        required: true,
    })
    @IsString()
    @IsNotEmpty({ message: 'Reason for unassigning task is required' })
    @MinLength(10, { message: 'Reason must be at least 10 characters long' })
    reason: string;
}