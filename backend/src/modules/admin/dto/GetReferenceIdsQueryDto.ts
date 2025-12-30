import { ApiProperty } from '@nestjs/swagger';

export class ReferenceIdDetailsDto {
    @ApiProperty({
        description: 'Reference ID primary key',
        example: 1,
    })
    id: Number;

    @ApiProperty({
        description: 'Transaction type',
        example: 'pacs.008.001.10',
    })
    txTp: string;

    @ApiProperty({
        description: 'System reference identifier',
        example: 'EndToEndId',
    })
    referenceIdName: string;

    @ApiProperty({
        description: 'Creation timestamp',
        example: '2024-01-15T10:00:00Z',
    })
    createdAt: Date;
}
