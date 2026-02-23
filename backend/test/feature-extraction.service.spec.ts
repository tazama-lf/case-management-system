import { Test, TestingModule } from '@nestjs/testing';
import { FeatureExtractionService } from '../src/modules/feature-extraction/feature-extraction.service';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { IngestAlertDto } from '../src/modules/alert/dto/IngestAlert.dto';

describe('FeatureExtractionService', () => {
  let service: FeatureExtractionService;
  let loggerService: jest.Mocked<LoggerService>;

  const mockAlert: any = {
    report: {
      tadpResult: {
        typologyResult: [
          {
            result: 0.85,
            ruleResults: [
              { id: '001@1.0.0', indpdntVarbl: 10 },
              { id: '002@1.0.0', indpdntVarbl: 20 },
              { id: '003@2.0.0', indpdntVarbl: 30 },
            ],
          },
        ],
      },
    },
    transaction: {},
    networkMap: {},
    message: 'Test alert',
  };

  beforeEach(async () => {
    const mockLoggerService = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeatureExtractionService,
        {
          provide: LoggerService,
          useValue: mockLoggerService,
        },
      ],
    }).compile();

    service = module.get<FeatureExtractionService>(FeatureExtractionService);
    loggerService = module.get(LoggerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('extractFeatures', () => {
    it('should successfully extract features from valid alert', async () => {
      const result = await service.extractFeatures(mockAlert);

      expect(result).toBeDefined();
      expect(result.features).toBeDefined();
      expect(result.features.length).toBe(34); // RULE_SEQUENCE length
      expect(result.features[0]).toBe(0.85); // typologyResult.result
      expect(result.features[1]).toBe(10); // rule 001
      expect(result.features[2]).toBe(20); // rule 002
      expect(result.features[3]).toBe(30); // rule 003
      expect(loggerService.log).toHaveBeenCalledWith(
        'Successfully extracted 34 features from rule sequence',
      );
    });

    it('should handle alert with no typology results', async () => {
      const alertWithoutTypology: any = {
        report: {},
        transaction: {},
        networkMap: {},
      };

      const result = await service.extractFeatures(alertWithoutTypology);

      expect(result.features).toBeDefined();
      expect(result.features.length).toBe(34);
      expect(result.features.every((f) => f === 0)).toBe(true);
      expect(loggerService.warn).toHaveBeenCalledWith('No typology results found in alert');
    });

    it('should handle alert with empty ruleResults', async () => {
      const alertWithEmptyRules: any = {
        report: {
          tadpResult: {
            typologyResult: [
              {
                result: 0.75,
                ruleResults: [],
              },
            ],
          },
        },
        transaction: {},
        networkMap: {},
      };

      const result = await service.extractFeatures(alertWithEmptyRules);

      expect(result.features[0]).toBe(0.75);
      expect(result.features.slice(1).every((f) => f === 0)).toBe(true);
    });

    it('should handle rule not found in sequence', async () => {
      const alertWithUnknownRule: any = {
        report: {
          tadpResult: {
            typologyResult: [
              {
                result: 0.5,
                ruleResults: [
                  { id: '999@1.0.0', indpdntVarbl: 50 },
                ],
              },
            ],
          },
        },
        transaction: {},
        networkMap: {},
      };

      const result = await service.extractFeatures(alertWithUnknownRule);

      expect(result.features[0]).toBe(0.5);
      expect(loggerService.warn).toHaveBeenCalledWith('Rule 999 not found in rule sequence');
    });

    it('should map all rules in sequence correctly', async () => {
      const alertWithManyRules: any = {
        report: {
          tadpResult: {
            typologyResult: [
              {
                result: 0.9,
                ruleResults: [
                  { id: '001@1.0.0', indpdntVarbl: 1 },
                  { id: '002@1.0.0', indpdntVarbl: 2 },
                  { id: '003@1.0.0', indpdntVarbl: 3 },
                  { id: '004@1.0.0', indpdntVarbl: 4 },
                  { id: '006@1.0.0', indpdntVarbl: 6 },
                  { id: '007@1.0.0', indpdntVarbl: 7 },
                  { id: '008@1.0.0', indpdntVarbl: 8 },
                  { id: '010@1.0.0', indpdntVarbl: 10 },
                  { id: '091@1.0.0', indpdntVarbl: 91 },
                ],
              },
            ],
          },
        },
        transaction: {},
        networkMap: {},
      };

      const result = await service.extractFeatures(alertWithManyRules);

      expect(result.features[0]).toBe(0.9);
      expect(result.features[1]).toBe(1); // 001
      expect(result.features[2]).toBe(2); // 002
      expect(result.features[3]).toBe(3); // 003
      expect(result.features[4]).toBe(4); // 004
      expect(result.features[5]).toBe(6); // 006
      expect(result.features[33]).toBe(91); // 091
    });

    it('should handle indpdntVarbl as string', async () => {
      const alertWithStringValues: any = {
        report: {
          tadpResult: {
            typologyResult: [
              {
                result: 0.6,
                ruleResults: [
                  { id: '001@1.0.0', indpdntVarbl: '15' },
                ],
              },
            ],
          },
        },
        transaction: {},
        networkMap: {},
      };

      const result = await service.extractFeatures(alertWithStringValues);

      expect(result.features[1]).toBe(15);
    });

    it('should handle missing indpdntVarbl', async () => {
      const alertWithMissingValue: any = {
        report: {
          tadpResult: {
            typologyResult: [
              {
                result: 0.4,
                ruleResults: [
                  { id: '001@1.0.0' },
                ],
              },
            ],
          },
        },
        transaction: {},
        networkMap: {},
      };

      const result = await service.extractFeatures(alertWithMissingValue);

      expect(result.features[1]).toBe(0);
    });

    it('should handle invalid indpdntVarbl', async () => {
      const alertWithInvalidValue: any = {
        report: {
          tadpResult: {
            typologyResult: [
              {
                result: 0.3,
                ruleResults: [
                  { id: '001@1.0.0', indpdntVarbl: 'invalid' },
                ],
              },
            ],
          },
        },
        transaction: {},
        networkMap: {},
      };

      const result = await service.extractFeatures(alertWithInvalidValue);

      expect(result.features[1]).toBe(0);
    });

    it('should extract rule ID without version', async () => {
      const alertWithVersionedRules: any = {
        report: {
          tadpResult: {
            typologyResult: [
              {
                result: 0.8,
                ruleResults: [
                  { id: '001@1.0.0', indpdntVarbl: 100 },
                  { id: '002@2.5.1', indpdntVarbl: 200 },
                  { id: '003@3.0.0-beta', indpdntVarbl: 300 },
                ],
              },
            ],
          },
        },
        transaction: {},
        networkMap: {},
      };

      const result = await service.extractFeatures(alertWithVersionedRules);

      expect(result.features[1]).toBe(100);
      expect(result.features[2]).toBe(200);
      expect(result.features[3]).toBe(300);
    });

    it('should log debug messages for each mapped rule', async () => {
      const result = await service.extractFeatures(mockAlert);

      expect(loggerService.debug).toHaveBeenCalledWith('Mapped rule 001 (index 1) with value 10');
      expect(loggerService.debug).toHaveBeenCalledWith('Mapped rule 002 (index 2) with value 20');
      expect(loggerService.debug).toHaveBeenCalledWith('Mapped rule 003 (index 3) with value 30');
    });

    it('should handle error during extraction', async () => {
      const invalidAlert: any = null;

      await expect(service.extractFeatures(invalidAlert)).rejects.toThrow(
        'Feature extraction failed',
      );
      expect(loggerService.error).toHaveBeenCalled();
    });

    it('should handle error with missing report', async () => {
      const alertWithoutReport: any = {
        transaction: {},
        networkMap: {},
      };

      const result = await service.extractFeatures(alertWithoutReport);

      expect(result.features.every((f) => f === 0)).toBe(true);
    });

    it('should handle null tadpResult', async () => {
      const alertWithNullTadp: any = {
        report: {
          tadpResult: null,
        },
        transaction: {},
        networkMap: {},
      };

      const result = await service.extractFeatures(alertWithNullTadp);

      expect(result.features.every((f) => f === 0)).toBe(true);
    });

    it('should handle empty typologyResult array', async () => {
      const alertWithEmptyTypology: any = {
        report: {
          tadpResult: {
            typologyResult: [],
          },
        },
        transaction: {},
        networkMap: {},
      };

      const result = await service.extractFeatures(alertWithEmptyTypology);

      expect(result.features.every((f) => f === 0)).toBe(true);
    });

    it('should handle multiple typology results (use first)', async () => {
      const alertWithMultipleTypologies: any = {
        report: {
          tadpResult: {
            typologyResult: [
              {
                result: 0.7,
                ruleResults: [
                  { id: '001@1.0.0', indpdntVarbl: 70 },
                ],
              },
              {
                result: 0.3,
                ruleResults: [
                  { id: '001@1.0.0', indpdntVarbl: 30 },
                ],
              },
            ],
          },
        },
        transaction: {},
        networkMap: {},
      };

      const result = await service.extractFeatures(alertWithMultipleTypologies);

      expect(result.features[0]).toBe(0.7);
      expect(result.features[1]).toBe(70);
    });

    it('should handle zero values correctly', async () => {
      const alertWithZeros: any = {
        report: {
          tadpResult: {
            typologyResult: [
              {
                result: 0,
                ruleResults: [
                  { id: '001@1.0.0', indpdntVarbl: 0 },
                ],
              },
            ],
          },
        },
        transaction: {},
        networkMap: {},
      };

      const result = await service.extractFeatures(alertWithZeros);

      expect(result.features[0]).toBe(0);
      expect(result.features[1]).toBe(0);
    });

    it('should handle negative values', async () => {
      const alertWithNegatives: any = {
        report: {
          tadpResult: {
            typologyResult: [
              {
                result: -0.5,
                ruleResults: [
                  { id: '001@1.0.0', indpdntVarbl: -10 },
                ],
              },
            ],
          },
        },
        transaction: {},
        networkMap: {},
      };

      const result = await service.extractFeatures(alertWithNegatives);

      expect(result.features[0]).toBe(-0.5);
      expect(result.features[1]).toBe(-10);
    });

    it('should handle floating point values', async () => {
      const alertWithFloats: any = {
        report: {
          tadpResult: {
            typologyResult: [
              {
                result: 0.123456,
                ruleResults: [
                  { id: '001@1.0.0', indpdntVarbl: 1.5 },
                ],
              },
            ],
          },
        },
        transaction: {},
        networkMap: {},
      };

      const result = await service.extractFeatures(alertWithFloats);

      expect(result.features[0]).toBe(0.123456);
      expect(result.features[1]).toBe(1.5);
    });

    it('should handle very large values', async () => {
      const alertWithLargeValues: any = {
        report: {
          tadpResult: {
            typologyResult: [
              {
                result: 999999.99,
                ruleResults: [
                  { id: '001@1.0.0', indpdntVarbl: 1000000 },
                ],
              },
            ],
          },
        },
        transaction: {},
        networkMap: {},
      };

      const result = await service.extractFeatures(alertWithLargeValues);

      expect(result.features[0]).toBe(999999.99);
      expect(result.features[1]).toBe(1000000);
    });

    it('should handle rule IDs without @ symbol', async () => {
      const alertWithSimpleIds: any = {
        report: {
          tadpResult: {
            typologyResult: [
              {
                result: 0.5,
                ruleResults: [
                  { id: '001', indpdntVarbl: 50 },
                ],
              },
            ],
          },
        },
        transaction: {},
        networkMap: {},
      };

      const result = await service.extractFeatures(alertWithSimpleIds);

      expect(result.features[1]).toBe(50);
    });

    it('should maintain feature array length consistency', async () => {
      const alerts = [
        mockAlert,
        { report: {}, transaction: {}, networkMap: {} },
        {
          report: {
            tadpResult: {
              typologyResult: [{ result: 0.1, ruleResults: [{ id: '091@1.0', indpdntVarbl: 91 }] }],
            },
          },
          transaction: {},
          networkMap: {},
        },
      ];

      for (const alert of alerts) {
        const result = await service.extractFeatures(alert);
        expect(result.features.length).toBe(34);
      }
    });

    it('should handle duplicate rule IDs (use last value)', async () => {
      const alertWithDuplicates: any = {
        report: {
          tadpResult: {
            typologyResult: [
              {
                result: 0.6,
                ruleResults: [
                  { id: '001@1.0.0', indpdntVarbl: 10 },
                  { id: '001@2.0.0', indpdntVarbl: 20 },
                  { id: '001@3.0.0', indpdntVarbl: 30 },
                ],
              },
            ],
          },
        },
        transaction: {},
        networkMap: {},
      };

      const result = await service.extractFeatures(alertWithDuplicates);

      expect(result.features[1]).toBe(30); // Last value wins
    });
  });

  describe('extractRuleId (private method behavior)', () => {
    it('should extract rule IDs correctly through public method', async () => {
      const alertWithVariousFormats: any = {
        report: {
          tadpResult: {
            typologyResult: [
              {
                result: 0.5,
                ruleResults: [
                  { id: '001@1.0.0', indpdntVarbl: 1 },
                  { id: '002@2.5.1-beta', indpdntVarbl: 2 },
                  { id: '003@v3.0.0', indpdntVarbl: 3 },
                  { id: '004', indpdntVarbl: 4 },
                ],
              },
            ],
          },
        },
        transaction: {},
        networkMap: {},
      };

      const result = await service.extractFeatures(alertWithVariousFormats);

      expect(result.features[1]).toBe(1);
      expect(result.features[2]).toBe(2);
      expect(result.features[3]).toBe(3);
      expect(result.features[4]).toBe(4);
    });
  });
});
