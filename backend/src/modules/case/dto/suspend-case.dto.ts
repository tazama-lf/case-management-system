import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class RequestSuspendCaseDto {
    @ApiProperty({
        description: 'Reason for suspending the case',
        example: 'The case is being suspended due to lack of evidence.',
    })
    @IsString()
    @MinLength(4)
    @MaxLength(500)
    reason: string;
}