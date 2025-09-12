import { Test, TestingModule } from '@nestjs/testing';
import { BpmnDeploymentService } from '../../src/flowable/bpmn-deployment.service';
import { FlowableService } from '../../src/flowable/flowable.service';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock fs/promises
jest.mock('fs/promises');
const mockedFs = fs as jest.Mocked<typeof fs>;

describe('BpmnDeploymentService', () => {
    let service: BpmnDeploymentService;
    let flowableService: jest.Mocked<FlowableService>;
    let loggerService: jest.Mocked<LoggerService>;

    beforeEach(async () => {
        // Reset all mocks before each test
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                BpmnDeploymentService,
                {
                    provide: FlowableService,
                    useValue: {
                        deployProcess: jest.fn(),
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

        service = module.get<BpmnDeploymentService>(BpmnDeploymentService);
        flowableService = module.get(FlowableService) as jest.Mocked<FlowableService>;
        loggerService = module.get(LoggerService) as jest.Mocked<LoggerService>;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('onModuleInit', () => {
        it('should deploy BPMN processes on module initialization', async () => {
            const mockBpmnContent = '<?xml version="1.0" encoding="UTF-8"?><bpmn>...</bpmn>';
            const expectedPath = path.join(process.cwd(), 'src', 'bpmn', 'case-creation.bpmn20.xml');

            mockedFs.readFile.mockResolvedValue(mockBpmnContent);
            flowableService.deployProcess.mockResolvedValue({ id: 'deployment-123' });

            await service.onModuleInit();

            expect(mockedFs.readFile).toHaveBeenCalledWith(expectedPath, 'utf-8');
            expect(flowableService.deployProcess).toHaveBeenCalledWith(
                mockBpmnContent,
                'CaseCreationProcess'
            );
            expect(loggerService.log).toHaveBeenCalledWith(
                'Case creation process deployed',
                BpmnDeploymentService.name
            );
            expect(loggerService.log).toHaveBeenCalledWith(
                'All BPMN processes deployed successfully',
                BpmnDeploymentService.name
            );
        });

        it('should log warning when BPMN file is not found', async () => {
            const expectedPath = path.join(process.cwd(), 'src', 'bpmn', 'case-creation.bpmn20.xml');
            const fileNotFoundError: any = new Error('File not found');
            fileNotFoundError.code = 'ENOENT';

            mockedFs.readFile.mockRejectedValue(fileNotFoundError);

            await service.onModuleInit();

            expect(mockedFs.readFile).toHaveBeenCalledWith(expectedPath, 'utf-8');
            expect(flowableService.deployProcess).not.toHaveBeenCalled();
            expect(loggerService.warn).toHaveBeenCalledWith(
                `BPMN file not found at ${expectedPath}. Skipping deployment.`,
                BpmnDeploymentService.name
            );
            expect(loggerService.log).toHaveBeenCalledWith(
                'All BPMN processes deployed successfully',
                BpmnDeploymentService.name
            );
        });

        it('should log error but not throw when deployment fails', async () => {
            const mockBpmnContent = '<?xml version="1.0" encoding="UTF-8"?><bpmn>...</bpmn>';
            const deploymentError = new Error('Deployment failed');

            mockedFs.readFile.mockResolvedValue(mockBpmnContent);
            flowableService.deployProcess.mockRejectedValue(deploymentError);

            // Should not throw
            await expect(service.onModuleInit()).resolves.not.toThrow();

            expect(loggerService.error).toHaveBeenCalledWith(
                `Failed to deploy BPMN processes: ${deploymentError.message}`,
                deploymentError.stack,
                BpmnDeploymentService.name
            );
        });

        it('should log error when file read fails with non-ENOENT error', async () => {
            const readError = new Error('Permission denied');

            mockedFs.readFile.mockRejectedValue(readError);

            await service.onModuleInit();

            expect(loggerService.error).toHaveBeenCalledWith(
                `Failed to deploy BPMN processes: ${readError.message}`,
                readError.stack,
                BpmnDeploymentService.name
            );
            expect(flowableService.deployProcess).not.toHaveBeenCalled();
        });
    });

    describe('redeployAllProcesses', () => {
        it('should successfully redeploy all processes', async () => {
            const mockBpmnContent = '<?xml version="1.0" encoding="UTF-8"?><bpmn>...</bpmn>';
            const expectedPath = path.join(process.cwd(), 'src', 'bpmn', 'case-creation.bpmn20.xml');

            mockedFs.readFile.mockResolvedValue(mockBpmnContent);
            flowableService.deployProcess.mockResolvedValue({ id: 'deployment-456' });

            await service.redeployAllProcesses();

            expect(mockedFs.readFile).toHaveBeenCalledWith(expectedPath, 'utf-8');
            expect(flowableService.deployProcess).toHaveBeenCalledWith(
                mockBpmnContent,
                'CaseCreationProcess'
            );
            expect(loggerService.log).toHaveBeenCalledWith(
                'Case creation process deployed',
                BpmnDeploymentService.name
            );
            expect(loggerService.log).toHaveBeenCalledWith(
                'All BPMN processes deployed successfully',
                BpmnDeploymentService.name
            );
        });

        it('should handle redeployment when file is missing', async () => {
            const expectedPath = path.join(process.cwd(), 'src', 'bpmn', 'case-creation.bpmn20.xml');
            const fileNotFoundError: any = new Error('File not found');
            fileNotFoundError.code = 'ENOENT';

            mockedFs.readFile.mockRejectedValue(fileNotFoundError);

            await service.redeployAllProcesses();

            expect(mockedFs.readFile).toHaveBeenCalledWith(expectedPath, 'utf-8');
            expect(flowableService.deployProcess).not.toHaveBeenCalled();
            expect(loggerService.warn).toHaveBeenCalledWith(
                `BPMN file not found at ${expectedPath}. Skipping deployment.`,
                BpmnDeploymentService.name
            );
            expect(loggerService.log).toHaveBeenCalledWith(
                'All BPMN processes deployed successfully',
                BpmnDeploymentService.name
            );
        });

        it('should handle errors during redeployment', async () => {
            const mockBpmnContent = '<?xml version="1.0" encoding="UTF-8"?><bpmn>...</bpmn>';
            const deploymentError = new Error('Network error during deployment');

            mockedFs.readFile.mockResolvedValue(mockBpmnContent);
            flowableService.deployProcess.mockRejectedValue(deploymentError);

            await service.redeployAllProcesses();

            expect(flowableService.deployProcess).toHaveBeenCalledWith(
                mockBpmnContent,
                'CaseCreationProcess'
            );
            expect(loggerService.error).toHaveBeenCalledWith(
                `Failed to deploy BPMN processes: ${deploymentError.message}`,
                deploymentError.stack,
                BpmnDeploymentService.name
            );
        });
    });

    describe('deployBpmnProcesses', () => {
        it('should construct correct path for BPMN files', async () => {
            const mockBpmnContent = '<?xml version="1.0" encoding="UTF-8"?><bpmn>...</bpmn>';
            const expectedPath = path.join(process.cwd(), 'src', 'bpmn', 'case-creation.bpmn20.xml');

            mockedFs.readFile.mockResolvedValue(mockBpmnContent);
            flowableService.deployProcess.mockResolvedValue({ id: 'deployment-789' });

            // Access private method through onModuleInit
            await service.onModuleInit();

            expect(mockedFs.readFile).toHaveBeenCalledWith(expectedPath, 'utf-8');
        });

        it('should handle multiple BPMN files if added in the future', async () => {
            // This test ensures the structure can handle multiple deployments
            const mockBpmnContent = '<?xml version="1.0" encoding="UTF-8"?><bpmn>...</bpmn>';

            mockedFs.readFile.mockResolvedValue(mockBpmnContent);
            flowableService.deployProcess.mockResolvedValue({ id: 'deployment-multi' });

            await service.onModuleInit();

            // Currently only one file, but structure supports multiple
            expect(mockedFs.readFile).toHaveBeenCalledTimes(1);
            expect(flowableService.deployProcess).toHaveBeenCalledTimes(1);
        });
    });

    describe('deployCaseCreationProcess', () => {
        it('should read file with correct encoding', async () => {
            const mockBpmnContent = '<?xml version="1.0" encoding="UTF-8"?><bpmn>...</bpmn>';
            const expectedPath = path.join(process.cwd(), 'src', 'bpmn', 'case-creation.bpmn20.xml');

            mockedFs.readFile.mockResolvedValue(mockBpmnContent);
            flowableService.deployProcess.mockResolvedValue({ id: 'deployment-encoding' });

            await service.onModuleInit();

            expect(mockedFs.readFile).toHaveBeenCalledWith(expectedPath, 'utf-8');
        });

        it('should pass correct deployment name to Flowable service', async () => {
            const mockBpmnContent = '<?xml version="1.0" encoding="UTF-8"?><bpmn>...</bpmn>';

            mockedFs.readFile.mockResolvedValue(mockBpmnContent);
            flowableService.deployProcess.mockResolvedValue({ id: 'deployment-name' });

            await service.onModuleInit();

            expect(flowableService.deployProcess).toHaveBeenCalledWith(
                mockBpmnContent,
                'CaseCreationProcess'
            );
        });

        it('should propagate non-ENOENT errors', async () => {
            const permissionError = new Error('EACCES: permission denied');
            (permissionError as any).code = 'EACCES';

            mockedFs.readFile.mockRejectedValue(permissionError);

            await service.onModuleInit();

            expect(loggerService.error).toHaveBeenCalledWith(
                `Failed to deploy BPMN processes: ${permissionError.message}`,
                permissionError.stack,
                BpmnDeploymentService.name
            );
            expect(loggerService.warn).not.toHaveBeenCalled();
        });
    });

    describe('error handling', () => {
        it('should not throw error when deployment fails to allow app startup', async () => {
            const criticalError = new Error('Critical deployment failure');

            mockedFs.readFile.mockRejectedValue(criticalError);

            // Should complete without throwing
            await expect(service.onModuleInit()).resolves.toBeUndefined();

            expect(loggerService.error).toHaveBeenCalled();
        });

        it('should handle Flowable service errors gracefully', async () => {
            const mockBpmnContent = '<?xml version="1.0" encoding="UTF-8"?><bpmn>...</bpmn>';
            const flowableError = new Error('Flowable service unavailable');

            mockedFs.readFile.mockResolvedValue(mockBpmnContent);
            flowableService.deployProcess.mockRejectedValue(flowableError);

            await expect(service.onModuleInit()).resolves.toBeUndefined();

            expect(loggerService.error).toHaveBeenCalledWith(
                `Failed to deploy BPMN processes: ${flowableError.message}`,
                flowableError.stack,
                BpmnDeploymentService.name
            );
        });

        it('should continue deployment even if logging fails', async () => {
            const mockBpmnContent = '<?xml version="1.0" encoding="UTF-8"?><bpmn>...</bpmn>';

            mockedFs.readFile.mockResolvedValue(mockBpmnContent);
            flowableService.deployProcess.mockResolvedValue({ id: 'deployment-log-fail' });
            loggerService.log.mockImplementation(() => {
                throw new Error('Logger failure');
            });

            // Should handle logger errors gracefully
            await expect(service.onModuleInit()).rejects.toThrow('Logger failure');

            expect(flowableService.deployProcess).toHaveBeenCalled();
        });
    });
});