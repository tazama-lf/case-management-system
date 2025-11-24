import { Injectable } from "@nestjs/common";
import { TaskService } from "../task/task.service";
import { CreateTaskDto } from "../task/dto/create-task.dto";

@Injectable()
export class SharedService {
    constructor() {}
}