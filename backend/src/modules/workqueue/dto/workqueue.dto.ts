import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class CreateCandidateGroupDto {
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

export class GroupStatisticsDTO {
    @ApiProperty({
        description: 'Group identifier',
        example: 'team_alpha',
    })
    groupId: string;

    @ApiProperty({
        description: 'Number of tasks in this group',
        example: 25,
    })
    taskCount: number;
}

export class TaskResponseDTO {
    @ApiProperty({
        description: 'Task unique identifier',
        example: '12345-abcd-6789-efgh',
    })
    id: string;

    @ApiProperty({
        description: 'Task name',
        example: 'Review case documents',
    })
    name: string;

    @ApiProperty({
        description: 'User assigned to the task',
        example: 'john.doe@example.com',
        required: false,
    })
    assignee?: string;

    @ApiProperty({
        description: 'Task creation timestamp',
        example: '2024-12-03T10:30:00Z',
        format: 'date-time',
    })
    created: string;

    @ApiProperty({
        description: 'Task priority level',
        example: 5,
        minimum: 0,
        maximum: 10,
    })
    priority: number;

    @ApiProperty({
        description: 'Task variables and metadata',
        example: {
            caseId: 'case-123',
            taskType: 'investigation',
            dueDate: '2024-12-10T17:00:00Z',
        },
        required: false,
    })
    variables?: Record<string, any>;
}

export class WorkQueueStatisticsDTO {
    @ApiProperty({
        description: 'Total number of tasks across all groups',
        example: 150,
    })
    totalTasks: number;

    @ApiProperty({
        description: 'Number of assigned tasks',
        example: 120,
    })
    assignedTasks: number;

    @ApiProperty({
        description: 'Number of unassigned tasks',
        example: 30,
    })
    unassignedTasks: number;

    @ApiProperty({
        description: 'Task breakdown by group',
        type: [GroupStatisticsDTO],
    })
    groups: GroupStatisticsDTO[];
}
