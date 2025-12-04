import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class RequestResumeCaseDto {
    @ApiProperty({
        description: 'Reason for resuming the case',
        example: 'The case is being resumed after suspension.',
    })
    @IsString()
    @MinLength(4)
    @MaxLength(500)
    reason: string;
}