import { Test, TestingModule } from '@nestjs/testing';
import { FlowableService } from '../../src/flowable/flowable.service';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { HttpException, HttpStatus } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('FlowableService', () => {
    let service: FlowableService;
    let loggerService: LoggerService;
    let mockAxiosInstance: jest.Mocked<AxiosInstance>;

    beforeEach(async () => {
        mockAxiosInstance = {
            post: jest.fn(),
            get: jest.fn(),
            put: jest.fn(),
            delete: jest.fn(),
            request: jest.fn(),
            head: jest.fn(),
            options: jest.fn(),
            patch: jest.fn(),
            postForm: jest.fn(),
            putForm: jest.fn(),
            patchForm: jest.fn(),
            getUri: jest.fn(),
            defaults: {} as any,
            interceptors: {
                request: { use: jest.fn(), eject: jest.fn(), clear: jest.fn() },
                response: { use: jest.fn(), eject: jest.fn(), clear: jest.fn() }
            }
        } as unknown as jest.Mocked<AxiosInstance>;

        mockedAxios.create.mockReturnValue(mockAxiosInstance);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                FlowableService,
                {
                    provide: ConfigService,
                    useValue: {
                        get: jest.fn((key: string, defaultValue?: string) => {
                            const config: Record<string, string> = {
                                FLOWABLE_URL: 'http://localhost:8080/flowable-rest',
                                FLOWABLE_USERNAME: 'rest-admin',
                                FLOWABLE_PASSWORD: 'test',
                            };
                            return config[key] || defaultValue;
                        }),
                    },
                },
                {
                    provide: LoggerService,
                    useValue: {
                        log: jest.fn(),
                        error: jest.fn(),
                        warn: jest.fn(),
                    },
                },
            ],
        }).compile();

        service = module.get<FlowableService>(FlowableService);
        loggerService = module.get<LoggerService>(LoggerService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('constructor', () => {
        it('should create axios instance with correct configuration', () => {
            expect(mockedAxios.create).toHaveBeenCalledWith({
                baseURL: 'http://localhost:8080/flowable-rest',
                auth: {
                    username: 'rest-admin',
                    password: 'test',
                },
                headers: {
                    'Content-Type': 'application/json',
                },
            });
        });
    });

    describe('deployProcess', () => {
        it('should successfully deploy a BPMN process', async () => {
            const bpmnXml = '<bpmn>...</bpmn>';
            const deploymentName = 'test-process';
            const mockResponse = { data: { id: 'deployment-123', name: deploymentName } };

            mockAxiosInstance.post.mockResolvedValue(mockResponse);

            const result = await service.deployProcess(bpmnXml, deploymentName);

            expect(result).toEqual(mockResponse.data);
            expect(mockAxiosInstance.post).toHaveBeenCalledWith(
                '/service/repository/deployments',
                expect.any(FormData),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'Content-Type': 'multipart/form-data',
                    }),
                })
            );
            expect(loggerService.log).toHaveBeenCalledWith(
                `Process deployed successfully: ${mockResponse.data.id}`,
                FlowableService.name
            );
        });

        it('should handle deployment errors', async () => {
            const bpmnXml = '<bpmn>...</bpmn>';
            const deploymentName = 'test-process';
            const error = new Error('Deployment failed');

            mockAxiosInstance.post.mockRejectedValue(error);

            await expect(service.deployProcess(bpmnXml, deploymentName)).rejects.toThrow(
                new HttpException('Failed to deploy process', HttpStatus.INTERNAL_SERVER_ERROR)
            );

            expect(loggerService.error).toHaveBeenCalledWith(
                `Failed to deploy process: ${error.message}`,
                error.stack,
                FlowableService.name
            );
        });
    });

    describe('startProcessInstance', () => {
        it('should start a process instance successfully', async () => {
            const processDefinitionKey = 'caseCreationProcess';
            const variables = { caseId: 'case-123', priority: 'HIGH' };
            const businessKey = 'case-123';
            const mockResponse = { data: { id: 'process-instance-123' } };

            mockAxiosInstance.post.mockResolvedValue(mockResponse);

            const result = await service.startProcessInstance(processDefinitionKey, variables, businessKey);

            expect(result).toEqual(mockResponse.data);
            expect(mockAxiosInstance.post).toHaveBeenCalledWith(
                '/service/runtime/process-instances',
                {
                    processDefinitionKey,
                    variables: [
                        { name: 'caseId', value: 'case-123', type: 'string' },
                        { name: 'priority', value: 'HIGH', type: 'string' },
                    ],
                    businessKey,
                }
            );
            expect(loggerService.log).toHaveBeenCalledWith(
                `Process instance started: ${mockResponse.data.id}`,
                FlowableService.name
            );
        });

        it('should handle errors when starting process instance', async () => {
            const processDefinitionKey = 'invalidProcess';
            const variables = {};
            const error = new Error('Process not found');

            mockAxiosInstance.post.mockRejectedValue(error);

            await expect(service.startProcessInstance(processDefinitionKey, variables)).rejects.toThrow(
                new HttpException('Failed to start process instance', HttpStatus.INTERNAL_SERVER_ERROR)
            );

            expect(loggerService.error).toHaveBeenCalledWith(
                `Failed to start process instance: ${error.message}`,
                error.stack,
                FlowableService.name
            );
        });
    });

    describe('getProcessInstance', () => {
        it('should retrieve a process instance successfully', async () => {
            const processInstanceId = 'process-123';
            const mockResponse = { data: { id: processInstanceId, state: 'active' } };

            mockAxiosInstance.get.mockResolvedValue(mockResponse);

            const result = await service.getProcessInstance(processInstanceId);

            expect(result).toEqual(mockResponse.data);
            expect(mockAxiosInstance.get).toHaveBeenCalledWith(
                `/service/runtime/process-instances/${processInstanceId}`
            );
        });

        it('should return null when process instance is not found', async () => {
            const processInstanceId = 'non-existent';
            const error = { response: { status: 404 } };

            mockAxiosInstance.get.mockRejectedValue(error);

            const result = await service.getProcessInstance(processInstanceId);

            expect(result).toBeNull();
        });

        it('should throw error for non-404 errors', async () => {
            const processInstanceId = 'process-123';
            const error = new Error('Server error');

            mockAxiosInstance.get.mockRejectedValue(error);

            await expect(service.getProcessInstance(processInstanceId)).rejects.toThrow(
                new HttpException('Failed to get process instance', HttpStatus.INTERNAL_SERVER_ERROR)
            );
        });
    });

    describe('getProcessTasks', () => {
        it('should retrieve process tasks successfully', async () => {
            const processInstanceId = 'process-123';
            const mockResponse = {
                data: {
                    data: [
                        { id: 'task-1', name: 'Review' },
                        { id: 'task-2', name: 'Approve' },
                    ],
                },
            };

            mockAxiosInstance.get.mockResolvedValue(mockResponse);

            const result = await service.getProcessTasks(processInstanceId);

            expect(result).toEqual(mockResponse.data.data);
            expect(mockAxiosInstance.get).toHaveBeenCalledWith('/service/runtime/tasks', {
                params: { processInstanceId },
            });
        });

        it('should handle errors when retrieving tasks', async () => {
            const processInstanceId = 'process-123';
            const error = new Error('Failed to get tasks');

            mockAxiosInstance.get.mockRejectedValue(error);

            await expect(service.getProcessTasks(processInstanceId)).rejects.toThrow(
                new HttpException('Failed to get process tasks', HttpStatus.INTERNAL_SERVER_ERROR)
            );

            expect(loggerService.error).toHaveBeenCalledWith(
                `Failed to get process tasks: ${error.message}`,
                error.stack,
                FlowableService.name
            );
        });
    });

    describe('completeTask', () => {
        it('should complete a task successfully without variables', async () => {
            const taskId = 'task-123';
            const mockResponse = { data: { success: true } };

            mockAxiosInstance.post.mockResolvedValue(mockResponse);

            const result = await service.completeTask(taskId);

            expect(result).toEqual(mockResponse.data);
            expect(mockAxiosInstance.post).toHaveBeenCalledWith(
                `/service/runtime/tasks/${taskId}`,
                {
                    action: 'complete',
                    variables: [],
                }
            );
            expect(loggerService.log).toHaveBeenCalledWith(`Task completed: ${taskId}`, FlowableService.name);
        });

        it('should complete a task with variables', async () => {
            const taskId = 'task-123';
            const variables = { approved: true, comments: 'Looks good' };
            const mockResponse = { data: { success: true } };

            mockAxiosInstance.post.mockResolvedValue(mockResponse);

            const result = await service.completeTask(taskId, variables);

            expect(result).toEqual(mockResponse.data);
            expect(mockAxiosInstance.post).toHaveBeenCalledWith(
                `/service/runtime/tasks/${taskId}`,
                {
                    action: 'complete',
                    variables: [
                        { name: 'approved', value: true, type: 'boolean' },
                        { name: 'comments', value: 'Looks good', type: 'string' },
                    ],
                }
            );
        });

        it('should handle errors when completing task', async () => {
            const taskId = 'task-123';
            const error = new Error('Task not found');

            mockAxiosInstance.post.mockRejectedValue(error);

            await expect(service.completeTask(taskId)).rejects.toThrow(
                new HttpException('Failed to complete task', HttpStatus.INTERNAL_SERVER_ERROR)
            );

            expect(loggerService.error).toHaveBeenCalledWith(
                `Failed to complete task: ${error.message}`,
                error.stack,
                FlowableService.name
            );
        });
    });

    describe('claimTask', () => {
        it('should claim a task successfully', async () => {
            const taskId = 'task-123';
            const userId = 'user-456';
            const mockResponse = { data: { success: true } };

            mockAxiosInstance.post.mockResolvedValue(mockResponse);

            const result = await service.claimTask(taskId, userId);

            expect(result).toEqual(mockResponse.data);
            expect(mockAxiosInstance.post).toHaveBeenCalledWith(
                `/service/runtime/tasks/${taskId}`,
                {
                    action: 'claim',
                    assignee: userId,
                }
            );
            expect(loggerService.log).toHaveBeenCalledWith(
                `Task ${taskId} claimed by user ${userId}`,
                FlowableService.name
            );
        });

        it('should handle errors when claiming task', async () => {
            const taskId = 'task-123';
            const userId = 'user-456';
            const error = new Error('Task already claimed');

            mockAxiosInstance.post.mockRejectedValue(error);

            await expect(service.claimTask(taskId, userId)).rejects.toThrow(
                new HttpException('Failed to claim task', HttpStatus.INTERNAL_SERVER_ERROR)
            );

            expect(loggerService.error).toHaveBeenCalledWith(
                `Failed to claim task: ${error.message}`,
                error.stack,
                FlowableService.name
            );
        });
    });

    describe('getCandidateGroupTasks', () => {
        it('should retrieve candidate group tasks successfully', async () => {
            const candidateGroup = 'Investigations';
            const mockResponse = {
                data: {
                    data: [
                        { id: 'task-1', candidateGroup: 'Investigations' },
                        { id: 'task-2', candidateGroup: 'Investigations' },
                    ],
                },
            };

            mockAxiosInstance.get.mockResolvedValue(mockResponse);

            const result = await service.getCandidateGroupTasks(candidateGroup);

            expect(result).toEqual(mockResponse.data.data);
            expect(mockAxiosInstance.get).toHaveBeenCalledWith('/service/runtime/tasks', {
                params: { candidateGroup },
            });
        });

        it('should handle errors when retrieving candidate tasks', async () => {
            const candidateGroup = 'InvalidGroup';
            const error = new Error('Group not found');

            mockAxiosInstance.get.mockRejectedValue(error);

            await expect(service.getCandidateGroupTasks(candidateGroup)).rejects.toThrow(
                new HttpException('Failed to get candidate tasks', HttpStatus.INTERNAL_SERVER_ERROR)
            );
        });
    });

    describe('getUserTasks', () => {
        it('should retrieve user tasks successfully', async () => {
            const assignee = 'user-123';
            const mockResponse = {
                data: {
                    data: [
                        { id: 'task-1', assignee: 'user-123' },
                        { id: 'task-2', assignee: 'user-123' },
                    ],
                },
            };

            mockAxiosInstance.get.mockResolvedValue(mockResponse);

            const result = await service.getUserTasks(assignee);

            expect(result).toEqual(mockResponse.data.data);
            expect(mockAxiosInstance.get).toHaveBeenCalledWith('/service/runtime/tasks', {
                params: { assignee },
            });
        });

        it('should handle errors when retrieving user tasks', async () => {
            const assignee = 'user-123';
            const error = new Error('User not found');

            mockAxiosInstance.get.mockRejectedValue(error);

            await expect(service.getUserTasks(assignee)).rejects.toThrow(
                new HttpException('Failed to get user tasks', HttpStatus.INTERNAL_SERVER_ERROR)
            );
        });
    });

    describe('formatVariables', () => {
        it('should format different variable types correctly', async () => {
            const variables = {
                stringVar: 'test',
                intVar: 42,
                floatVar: 3.14,
                boolVar: true,
                dateVar: new Date('2024-01-01'),
                objectVar: { key: 'value' },
                nullVar: null,
            };

            // Mock the post method to capture the call
            mockAxiosInstance.post.mockResolvedValue({ data: { id: 'process-123' } });

            // Call the method that uses formatVariables internally
            await service.startProcessInstance('test', variables);

            // Verify the post was called with correctly formatted variables
            expect(mockAxiosInstance.post).toHaveBeenCalledWith(
                '/service/runtime/process-instances',
                expect.objectContaining({
                    processDefinitionKey: 'test',
                    businessKey: undefined,
                    variables: expect.arrayContaining([
                        { name: 'stringVar', value: 'test', type: 'string' },
                        { name: 'intVar', value: 42, type: 'integer' },
                        { name: 'floatVar', value: 3.14, type: 'double' },
                        { name: 'boolVar', value: true, type: 'boolean' },
                        { name: 'dateVar', value: expect.any(Date), type: 'date' },
                        { name: 'objectVar', value: { key: 'value' }, type: 'json' },
                        { name: 'nullVar', value: null, type: 'json' },
                    ]),
                })
            );
        });
    });
});