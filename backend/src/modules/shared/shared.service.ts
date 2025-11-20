import { Injectable } from "@nestjs/common";
import { TaskService } from "../task/task.service";
import { CreateTaskDto } from "../task/dto/create-task.dto";

@Injectable()
export class SharedService {
    constructor(
        private readonly taskService: TaskService
    ) {}

    async createTask(taskData: CreateTaskDto, userId: string): Promise<any> {
        return this.taskService.createTask(taskData, userId);
    }
}