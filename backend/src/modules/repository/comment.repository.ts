import { Injectable } from "@nestjs/common";
import { PrismaService } from "prisma/prisma.service";
import { CreateCommentDto } from "../comment/dto/create-comment.dto";

@Injectable()
export class CommentRepository {
    constructor(private readonly prisma: PrismaService) { }

    async createComment(userId: string, createCommentDto: CreateCommentDto) {
        return await this.prisma.comment.create({
            data: {
                user_id: userId,
                case_id: createCommentDto.caseId,
                task_id: createCommentDto.taskId ?? null,
                note: createCommentDto.note,
            },
        });
    }

    async getCommentsByCommentId(commentId: string) {
        return await this.prisma.comment.findUnique({
            where: {
                comment_id: commentId,
            },
        });
    }

    async getCommentsByCaseId(caseId?: string) {
        return await this.prisma.comment.findMany({
            where: { case_id: caseId },
            orderBy: {
                created_at: 'desc',
            },
        });
    }

    async getCommentsByTaskId(taskId?: string) {
        return await this.prisma.comment.findMany({
            where: { task_id: taskId },
            orderBy: {
                created_at: 'desc',
            },
        });
    }

}