import { Test, TestingModule } from '@nestjs/testing';
import { FeatureExtractionService } from '../../src/modules/feature-extraction/feature-extraction.service';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { AuditLogService } from '../../src/modules/audit/auditLog.service';
import { AlertMessageDto } from '../../src/nats/dto/AlertMessageDto.dto';

describe('FeatureExtractionService', () => {
  let service: FeatureExtractionService;
  let mockLogger: jest.Mocked<LoggerService>;
  let mockAuditLog: jest.Mocked<AuditLogService>;
  const ruleSequence = [
    '001',
    '002',
    '003',
    '004',
    '006',
    '007',
    '008',
    '010',
    '011',
    '016',
    '017',
    '018',
    '020',
    '021',
    '024',
    '025',
    '026',
    '027',
    '028',
    '030',
    '044',
    '045',
    '048',
    '054',
    '063',
    '074',
    '075',
    '076',
    '078',
    '083',
    '084',
    '090',
    '091',
  ];

  beforeEach(async () => {
    mockLogger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as any;

    mockAuditLog = {
      // Add mock methods as needed
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeatureExtractionService,
        { provide: LoggerService, useValue: mockLogger },
        { provide: AuditLogService, useValue: mockAuditLog },
      ],
    }).compile();

    service = module.get<FeatureExtractionService>(FeatureExtractionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // it('should return rule sequence', () => {
  //   const ruleSequence = service.getRuleSequence();
  //   expect(ruleSequence).toBeInstanceOf(Array);
  //   expect(ruleSequence.length).toBeGreaterThan(0);
  //   expect(ruleSequence).toContain('001');
  //   expect(ruleSequence).toContain('091');
  // });

  // it('should return feature names', () => {
  //   const featureNames = service.getFeatureNames();
  //   expect(featureNames).toBeInstanceOf(Array);
  //   expect(featureNames[0]).toBe('rule_001_indvar');
  //   expect(featureNames.length).toBe(service.getRuleSequence().length);
  // });

  describe('extractFeatures', () => {
    it('should extract features correctly with valid alert data', async () => {
      const mockAlert: AlertMessageDto = {
        tenant_id: 'test',
        message: 'test',
        report: {
          tadpResult: {
            typologyResult: [
              {
                ruleResults: [
                  { id: '001@1.0.0', indpdntVarbl: '5' },
                  { id: '003@1.0.0', indpdntVarbl: '10' },
                  { id: '091@1.0.0', indpdntVarbl: '2' },
                ],
              },
            ],
          },
        } as any,
        transaction: {} as any,
        networkMap: {} as any,
        confidence_per: 85,
      };

      const result = await service.extractFeatures(mockAlert);

      expect(result.features).toBeInstanceOf(Array);
      expect(result.features.length).toBe(ruleSequence.length);

      // Check specific rule mappings
      expect(result.features[ruleSequence.indexOf('001')]).toBe(5);
      expect(result.features[ruleSequence.indexOf('003')]).toBe(10);
      expect(result.features[ruleSequence.indexOf('091')]).toBe(2);

      // Check that unmapped rules have 0 values
      expect(result.features[ruleSequence.indexOf('002')]).toBe(0);
    });

    it('should handle missing typology results', async () => {
      const mockAlert: AlertMessageDto = {
        tenant_id: 'test',
        message: 'test',
        report: {} as any,
        transaction: {} as any,
        networkMap: {} as any,
        confidence_per: 85,
      };

      const result = await service.extractFeatures(mockAlert);

      expect(result.features).toBeInstanceOf(Array);
      expect(result.features.every((f) => f === 0)).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalledWith('No typology results found in alert');
    });

    it('should handle invalid indpdntVarbl values', async () => {
      const mockAlert: AlertMessageDto = {
        tenant_id: 'test',
        message: 'test',
        report: {
          tadpResult: {
            typologyResult: [
              {
                ruleResults: [
                  { id: '001@1.0.0', indpdntVarbl: 'invalid' },
                  { id: '003@1.0.0', indpdntVarbl: '' },
                  { id: '091@1.0.0', indpdntVarbl: '5' },
                ],
              },
            ],
          },
        } as any,
        transaction: {} as any,
        networkMap: {} as any,
        confidence_per: 85,
      };

      const result = await service.extractFeatures(mockAlert);

      expect(result.features[ruleSequence.indexOf('001')]).toBe(0); // invalid becomes 0
      expect(result.features[ruleSequence.indexOf('003')]).toBe(0); // empty becomes 0
      expect(result.features[ruleSequence.indexOf('091')]).toBe(5); // valid stays 5
    });
  });
});
