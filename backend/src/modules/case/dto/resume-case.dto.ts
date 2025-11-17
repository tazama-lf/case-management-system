import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class RequestResumeCaseDto {
    @ApiProperty({
        description: 'Reason for resuming the case',
        example: 'The case is being resumed after suspension.',
    })
    @IsString()
    reason: string;
}