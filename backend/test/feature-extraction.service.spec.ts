import { Test, TestingModule } from '@nestjs/testing';
import { FeatureExtractionService } from '../src/modules/feature-extraction/feature-extraction.service';
import { LoggerService } from '@tazama-lf/frms-coe-lib';

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
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeatureExtractionService,
        {
          provide: LoggerService,
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<FeatureExtractionService>(FeatureExtractionService);
    loggerService = module.get(LoggerService) as jest.Mocked<LoggerService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('extractFeatures', () => {
    it('should successfully extract features from valid alert', () => {
      const result = service.extractFeatures(mockAlert);

      expect(result).toBeDefined();
      expect(result.features).toBeDefined();
      expect(result.features.length).toBe(34);
      expect(result.features[0]).toBe(0.85);
      expect(result.features[1]).toBe(10);
      expect(result.features[2]).toBe(20);
      expect(result.features[3]).toBe(30);
      expect(loggerService.log).toHaveBeenCalledWith('Successfully extracted 34 features from rule sequence');
    });

    it('should handle empty typologyResult array and log warning', () => {
      const alertWithEmptyTypology: any = {
        report: {
          tadpResult: {
            typologyResult: [],
          },
        },
        transaction: {},
        networkMap: {},
      };

      const result = service.extractFeatures(alertWithEmptyTypology);

      expect(result.features.length).toBe(34);
      expect(result.features.every((f) => f === 0)).toBe(true);
      expect(loggerService.warn).toHaveBeenCalledWith('No typology results found in alert');
    });

    it('should handle alert with empty ruleResults', () => {
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

      const result = service.extractFeatures(alertWithEmptyRules);

      expect(result.features[0]).toBe(0.75);
      expect(result.features.slice(1).every((f) => f === 0)).toBe(true);
    });

    it('should handle rule not found in sequence and log warning', () => {
      const alertWithUnknownRule: any = {
        report: {
          tadpResult: {
            typologyResult: [
              {
                result: 0.5,
                ruleResults: [{ id: '999@1.0.0', indpdntVarbl: 50 }],
              },
            ],
          },
        },
        transaction: {},
        networkMap: {},
      };

      const result = service.extractFeatures(alertWithUnknownRule);

      expect(result.features[0]).toBe(0.5);
      expect(loggerService.warn).toHaveBeenCalledWith('Rule 999 not found in rule sequence');
    });

    it('should map multiple rules correctly', () => {
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
                  { id: '091@1.0.0', indpdntVarbl: 91 },
                ],
              },
            ],
          },
        },
        transaction: {},
        networkMap: {},
      };

      const result = service.extractFeatures(alertWithManyRules);

      expect(result.features[0]).toBe(0.9);
      expect(result.features[1]).toBe(1);
      expect(result.features[2]).toBe(2);
      expect(result.features[3]).toBe(3);
      expect(result.features[4]).toBe(4);
      expect(result.features[5]).toBe(6);
      expect(result.features[33]).toBe(91);
    });

    it('should extract rule ID without version from various formats', () => {
      const alertWithVersionedRules: any = {
        report: {
          tadpResult: {
            typologyResult: [
              {
                result: 0.8,
                ruleResults: [
                  { id: '001@1.0.0', indpdntVarbl: 100 },
                  { id: '002@2.5.1-beta', indpdntVarbl: 200 },
                  { id: '003', indpdntVarbl: 300 },
                ],
              },
            ],
          },
        },
        transaction: {},
        networkMap: {},
      };

      const result = service.extractFeatures(alertWithVersionedRules);

      expect(result.features[1]).toBe(100);
      expect(result.features[2]).toBe(200);
      expect(result.features[3]).toBe(300);
    });

    it.each([
      ['string', '15', 15],
      ['missing', undefined, 0],
      ['invalid string', 'invalid', 0],
    ])('should handle indpdntVarbl as %s', (_description, indpdntVarbl, expected) => {
      const alert: any = {
        report: {
          tadpResult: {
            typologyResult: [
              {
                result: 0.6,
                ruleResults: [{ id: '001@1.0.0', indpdntVarbl }],
              },
            ],
          },
        },
        transaction: {},
        networkMap: {},
      };

      const result = service.extractFeatures(alert);

      expect(result.features[1]).toBe(expected);
    });

    it('should log debug messages for each mapped rule', () => {
      service.extractFeatures(mockAlert);

      expect(loggerService.debug).toHaveBeenCalledWith('Mapped rule 001 (index 1) with value 10');
      expect(loggerService.debug).toHaveBeenCalledWith('Mapped rule 002 (index 2) with value 20');
      expect(loggerService.debug).toHaveBeenCalledWith('Mapped rule 003 (index 3) with value 30');
    });

    it('should throw error and log when alert is null', () => {
      const invalidAlert: any = null;

      expect(() => service.extractFeatures(invalidAlert)).toThrow();
      expect(loggerService.error).toHaveBeenCalled();
    });

    it('should handle multiple typology results (use first)', () => {
      const alertWithMultipleTypologies: any = {
        report: {
          tadpResult: {
            typologyResult: [
              {
                result: 0.7,
                ruleResults: [{ id: '001@1.0.0', indpdntVarbl: 70 }],
              },
              {
                result: 0.3,
                ruleResults: [{ id: '001@1.0.0', indpdntVarbl: 30 }],
              },
            ],
          },
        },
        transaction: {},
        networkMap: {},
      };

      const result = service.extractFeatures(alertWithMultipleTypologies);

      expect(result.features[0]).toBe(0.7);
      expect(result.features[1]).toBe(70);
    });

    it.each([
      ['zero', 0, 0],
      ['negative', -0.5, -10],
      ['floating point', 0.123456, 1.5],
      ['large', 999999.99, 1000000],
    ])('should handle %s values', (_description, resultValue, indpdntVarbl) => {
      const alert: any = {
        report: {
          tadpResult: {
            typologyResult: [
              {
                result: resultValue,
                ruleResults: [{ id: '001@1.0.0', indpdntVarbl }],
              },
            ],
          },
        },
        transaction: {},
        networkMap: {},
      };

      const result = service.extractFeatures(alert);

      expect(result.features[0]).toBe(resultValue);
      expect(result.features[1]).toBe(indpdntVarbl);
    });

    it('should maintain consistent feature array length', () => {
      const alerts = [
        mockAlert,
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

      alerts.forEach((alert) => {
        const result = service.extractFeatures(alert);
        expect(result.features.length).toBe(34);
      });
    });

    it('should handle duplicate rule IDs (use last value)', () => {
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

      const result = service.extractFeatures(alertWithDuplicates);

      expect(result.features[1]).toBe(30);
    });
  });
});
