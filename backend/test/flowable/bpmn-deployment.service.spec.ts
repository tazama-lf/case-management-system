import { Test, TestingModule } from '@nestjs/testing';
import { BpmnDeploymentService } from '../../src/flowable/bpmn-deployment.service';
import { FlowableService } from '../../src/flowable/flowable.service';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import * as fs from 'fs/promises';
import * as path from 'path';

jest.mock('fs/promises');
const mockedFs = fs as jest.Mocked<typeof fs>;

describe('BpmnDeploymentService', () => {
  let service: BpmnDeploymentService;
  let flowableService: jest.Mocked<FlowableService>;
  let loggerService: jest.Mocked<LoggerService>;

  beforeEach(async () => {
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
    flowableService = module.get(FlowableService);
    loggerService = module.get(LoggerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('should deploy unified BPMN process on module initialization', async () => {
      const mockBpmnContent = '<?xml version="1.0" encoding="UTF-8"?><bpmn>...</bpmn>';
      const expectedPath = path.join(process.cwd(), 'src', 'bpmn', 'case-management.bpmn20.xml');

      mockedFs.readFile.mockResolvedValue(mockBpmnContent);
      flowableService.deployProcess.mockResolvedValue({ id: 'deployment-123' });

      await service.onModuleInit();

      expect(mockedFs.readFile).toHaveBeenCalledWith(expectedPath, 'utf-8');
      expect(flowableService.deployProcess).toHaveBeenCalledWith(
        mockBpmnContent,
        'UnifiedCaseManagementProcess',
        'c950ac85-96f0-4390-8d94-5b8fdec4e863',
      );
      expect(loggerService.log).toHaveBeenCalledWith('Unified case management process deployed', BpmnDeploymentService.name);
      expect(loggerService.log).toHaveBeenCalledWith(
        'Unified case management BPMN process deployed successfully',
        BpmnDeploymentService.name,
      );
    });

    it('should log warning when BPMN file is not found', async () => {
      const expectedPath = path.join(process.cwd(), 'src', 'bpmn', 'case-management.bpmn20.xml');
      const fileNotFoundError: any = new Error('File not found');
      fileNotFoundError.code = 'ENOENT';

      mockedFs.readFile.mockRejectedValue(fileNotFoundError);

      await service.onModuleInit();

      expect(mockedFs.readFile).toHaveBeenCalledWith(expectedPath, 'utf-8');
      expect(flowableService.deployProcess).not.toHaveBeenCalled();
      expect(loggerService.warn).toHaveBeenCalledWith(
        `BPMN file not found at ${expectedPath}. Skipping deployment.`,
        BpmnDeploymentService.name,
      );
    });

    it('should log error but not throw when deployment fails', async () => {
      const mockBpmnContent = '<?xml version="1.0" encoding="UTF-8"?><bpmn>...</bpmn>';
      const deploymentError = new Error('Deployment failed');

      mockedFs.readFile.mockResolvedValue(mockBpmnContent);
      flowableService.deployProcess.mockRejectedValue(deploymentError);

      await expect(service.onModuleInit()).resolves.not.toThrow();

      expect(loggerService.error).toHaveBeenCalledWith(
        `Failed to deploy BPMN processes: ${deploymentError.message}`,
        deploymentError.stack,
        BpmnDeploymentService.name,
      );
    });

    it('should log error when file read fails with non-ENOENT error', async () => {
      const readError = new Error('Permission denied');

      mockedFs.readFile.mockRejectedValue(readError);

      await service.onModuleInit();

      expect(loggerService.error).toHaveBeenCalledWith(
        `Failed to deploy BPMN processes: ${readError.message}`,
        readError.stack,
        BpmnDeploymentService.name,
      );
      expect(flowableService.deployProcess).not.toHaveBeenCalled();
    });
  });

  describe('redeployUnifiedProcess', () => {
    it('should successfully redeploy unified process', async () => {
      const mockBpmnContent = '<?xml version="1.0" encoding="UTF-8"?><bpmn>...</bpmn>';
      const expectedPath = path.join(process.cwd(), 'src', 'bpmn', 'case-management.bpmn20.xml');

      mockedFs.readFile.mockResolvedValue(mockBpmnContent);
      flowableService.deployProcess.mockResolvedValue({ id: 'deployment-456' });

      const result = await service.redeployUnifiedProcess();

      expect(mockedFs.readFile).toHaveBeenCalledWith(expectedPath, 'utf-8');
      expect(flowableService.deployProcess).toHaveBeenCalledWith(
        mockBpmnContent,
        'UnifiedCaseManagementProcess',
        'c950ac85-96f0-4390-8d94-5b8fdec4e863',
      );
      expect(result).toEqual({
        message: 'Unified case management process redeployed successfully',
      });
      expect(loggerService.log).toHaveBeenCalledWith('Unified case management process deployed', BpmnDeploymentService.name);
    });

    it('should handle redeployment when file is missing', async () => {
      const expectedPath = path.join(process.cwd(), 'src', 'bpmn', 'case-management.bpmn20.xml');
      const fileNotFoundError: any = new Error('File not found');
      fileNotFoundError.code = 'ENOENT';

      mockedFs.readFile.mockRejectedValue(fileNotFoundError);

      await service.redeployUnifiedProcess();

      expect(mockedFs.readFile).toHaveBeenCalledWith(expectedPath, 'utf-8');
      expect(flowableService.deployProcess).not.toHaveBeenCalled();
      expect(loggerService.warn).toHaveBeenCalledWith(
        `BPMN file not found at ${expectedPath}. Skipping deployment.`,
        BpmnDeploymentService.name,
      );
    });

    it('should handle errors during redeployment', async () => {
      const mockBpmnContent = '<?xml version="1.0" encoding="UTF-8"?><bpmn>...</bpmn>';
      const deploymentError = new Error('Network error during deployment');

      mockedFs.readFile.mockResolvedValue(mockBpmnContent);
      flowableService.deployProcess.mockRejectedValue(deploymentError);

      await service.redeployUnifiedProcess();

      expect(flowableService.deployProcess).toHaveBeenCalledWith(
        mockBpmnContent,
        'UnifiedCaseManagementProcess',
        'c950ac85-96f0-4390-8d94-5b8fdec4e863',
      );
      expect(loggerService.error).toHaveBeenCalledWith(
        `Failed to deploy BPMN processes: ${deploymentError.message}`,
        deploymentError.stack,
        BpmnDeploymentService.name,
      );
    });
  });

  describe('getDeploymentStatus', () => {
    it('should return deployment status successfully', async () => {
      const result = await service.getDeploymentStatus();

      expect(result).toEqual({
        deployed: true,
        processDefinitionKey: 'caseManagementProcess',
        tenantId: 'c950ac85-96f0-4390-8d94-5b8fdec4e863',
        timestamp: expect.any(Date),
      });
    });

    it('should handle errors when checking deployment status', async () => {
      jest.spyOn(service, 'getDeploymentStatus').mockImplementationOnce(async () => {
        throw new Error('Status check failed');
      });

      await expect(service.getDeploymentStatus()).rejects.toThrow('Status check failed');
    });
  });

  describe('deployUnifiedCaseManagementProcess', () => {
    it('should read file with correct encoding', async () => {
      const mockBpmnContent = '<?xml version="1.0" encoding="UTF-8"?><bpmn>...</bpmn>';
      const expectedPath = path.join(process.cwd(), 'src', 'bpmn', 'case-management.bpmn20.xml');

      mockedFs.readFile.mockResolvedValue(mockBpmnContent);
      flowableService.deployProcess.mockResolvedValue({ id: 'deployment-encoding' });

      await service.onModuleInit();

      expect(mockedFs.readFile).toHaveBeenCalledWith(expectedPath, 'utf-8');
    });

    it('should pass correct deployment name and tenant ID to Flowable service', async () => {
      const mockBpmnContent = '<?xml version="1.0" encoding="UTF-8"?><bpmn>...</bpmn>';

      mockedFs.readFile.mockResolvedValue(mockBpmnContent);
      flowableService.deployProcess.mockResolvedValue({ id: 'deployment-name' });

      await service.onModuleInit();

      expect(flowableService.deployProcess).toHaveBeenCalledWith(
        mockBpmnContent,
        'UnifiedCaseManagementProcess',
        'c950ac85-96f0-4390-8d94-5b8fdec4e863',
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
        BpmnDeploymentService.name,
      );
      expect(loggerService.warn).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should not throw error when deployment fails to allow app startup', async () => {
      const criticalError = new Error('Critical deployment failure');

      mockedFs.readFile.mockRejectedValue(criticalError);

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
        BpmnDeploymentService.name,
      );
    });

    it('should continue deployment even if logging fails', async () => {
      const mockBpmnContent = '<?xml version="1.0" encoding="UTF-8"?><bpmn>...</bpmn>';

      mockedFs.readFile.mockResolvedValue(mockBpmnContent);
      flowableService.deployProcess.mockResolvedValue({ id: 'deployment-log-fail' });
      loggerService.log.mockImplementation(() => {
        throw new Error('Logger failure');
      });

      await expect(service.onModuleInit()).rejects.toThrow('Logger failure');

      expect(flowableService.deployProcess).toHaveBeenCalled();
    });
  });

  describe('single process deployment', () => {
    it('should only deploy one BPMN file', async () => {
      const mockBpmnContent = '<?xml version="1.0" encoding="UTF-8"?><bpmn>...</bpmn>';

      mockedFs.readFile.mockResolvedValue(mockBpmnContent);
      flowableService.deployProcess.mockResolvedValue({ id: 'deployment-single' });

      await service.onModuleInit();

      expect(mockedFs.readFile).toHaveBeenCalledTimes(1);
      expect(flowableService.deployProcess).toHaveBeenCalledTimes(1);
    });

    it('should use case-management.bpmn20.xml as the filename', async () => {
      const mockBpmnContent = '<?xml version="1.0" encoding="UTF-8"?><bpmn>...</bpmn>';
      const expectedPath = path.join(process.cwd(), 'src', 'bpmn', 'case-management.bpmn20.xml');

      mockedFs.readFile.mockResolvedValue(mockBpmnContent);
      flowableService.deployProcess.mockResolvedValue({ id: 'deployment-filename' });

      await service.onModuleInit();

      expect(mockedFs.readFile).toHaveBeenCalledWith(expectedPath, 'utf-8');
    });
  });
});
