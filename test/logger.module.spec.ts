import { Test, TestingModule } from '@nestjs/testing';
import { LoggerModule } from '../src/logger/logger.module';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { validateProcessorConfig } from '@tazama-lf/frms-coe-lib/lib/config';

jest.mock('@tazama-lf/frms-coe-lib/lib/config', () => ({
  validateProcessorConfig: jest.fn(() => ({ mock: 'config' })),
}));

jest.mock('@tazama-lf/frms-coe-lib', () => ({
  LoggerService: jest.fn().mockImplementation((config) => ({ config, log: jest.fn(), error: jest.fn() })),
}));

describe('LoggerModule', () => {
  let loggerService: LoggerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [LoggerModule],
    }).compile();
    loggerService = module.get<LoggerService>(LoggerService);
  });

  it('should provide LoggerService', () => {
    expect(loggerService).toBeDefined();
    expect((loggerService as any).config).toEqual({ mock: 'config' });
  });

  it('should call log and error methods', () => {
    loggerService.log('test log');
    loggerService.error('test error');
    expect(loggerService.log).toHaveBeenCalledWith('test log');
    expect(loggerService.error).toHaveBeenCalledWith('test error');
  });

  it('should use validateProcessorConfig in factory', () => {
    expect(validateProcessorConfig).toHaveBeenCalled();
  });
});
