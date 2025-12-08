import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString, MaxLength, MinLength } from 'class-validator';

export class RequestSuspendCaseDto {
    @ApiProperty({
        description: 'Reason for suspending the case',
        example: 'The case is being suspended due to lack of evidence.',
    })
    @IsString()
    @MinLength(4)
    @MaxLength(500)
    reason: string;

    @ApiProperty({
        description: 'TaskIds for suspension',
        example: 'User selects if there are more than one tasks to be suspended.',
    })
    @IsArray()
    taskIds: string[];

}