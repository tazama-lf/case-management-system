import { Body, Controller, Param, Req, Patch, Post, UseGuards } from '@nestjs/common';
import { TaskService } from './task.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TazamaAuthGuard } from 'src/auth/tazama-auth.guard';
import { RequireCMSTestRole } from 'src/auth/auth.decorator';

@Controller('api/v1/task')
@UseGuards(TazamaAuthGuard)
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @Post()
  @RequireCMSTestRole()
  async createTask(@Body() createTaskDto: CreateTaskDto) {
    const userId = 'c98db341-beb6-457c-98e0-406cc1c71662';
    return this.taskService.createTask(createTaskDto, userId);
  }

  @Patch(':taskId/reassign')
  @RequireCMSTestRole()
  async reassignTask(@Param('taskId') taskId: string, @Body('assignedUserId') assignedUserId: string) {
    const userId = 'c98db341-beb6-457c-98e0-406cc1c71662';
    return this.taskService.reassignTask(taskId, userId, assignedUserId);
  }

  @Patch(':taskId')
  @RequireCMSTestRole()
  async updateTask(@Param('taskId') taskId: string, @Body() dto: UpdateTaskDto, @Req() req) {
    const userId = req.user.user_id;
    return this.taskService.updateTask(taskId, dto, userId);
  }
}
