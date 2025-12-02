import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class RequestCandidateGroupDTO {
    @ApiProperty({
        description: 'Unique identifier for the candidate group',
        example: 'team_alpha',
    })
    @IsString()
    groupId: string;

    @ApiProperty({
        description: 'Name for the candidate group',
        example: 'Team Alpha',
    })
    @IsString()
    groupName: string;

    @ApiProperty({
        description: 'Type of candidate group',
        example: 'candidate',
        default: 'candidate',
    })
    @IsString()
    groupType: string;
}