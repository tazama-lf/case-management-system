import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JupyterService } from '../src/modules/jupyter/jupyter.service';

describe('JupyterService', () => {
  let service: JupyterService;
  let configService: ConfigService;

  const mockVoilaUrl = 'http://test-voila:8866';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JupyterService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn((key: string) => {
              if (key === 'VOILA_URL') return mockVoilaUrl;
              throw new Error(`Config key ${key} not found`);
            }),
          },
        },
      ],
    }).compile();

    service = module.get<JupyterService>(JupyterService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should initialize with VOILA_URL from config', () => {
      expect(configService.getOrThrow).toHaveBeenCalledWith('VOILA_URL');
    });

    it('should throw error if VOILA_URL is not provided in config', () => {
      const mockConfigServiceWithoutUrl = {
        getOrThrow: jest.fn(() => {
          throw new Error('VOILA_URL is not defined');
        }),
      };

      expect(() => {
        new JupyterService(mockConfigServiceWithoutUrl as any);
      }).toThrow('VOILA_URL is not defined');
    });
  });

  describe('getVisualizationUrl', () => {
    describe('Valid Notebook Names', () => {
      it('should return correct URL for transaction-history notebook', () => {
        const params = { entityId: 'entity123', tenantId: 'DEFAULT' };
        const result = service.getVisualizationUrl('transaction-history', params);

        expect(result).toBe(`${mockVoilaUrl}/voila/render/transaction-viz.ipynb?entityId=entity123&tenantId=DEFAULT`);
      });

      it('should return correct URL for alert-history notebook', () => {
        const params = { endToEndId: 'e2e123', dateRange: '30days' };
        const result = service.getVisualizationUrl('alert-history', params);

        expect(result).toBe(`${mockVoilaUrl}/voila/render/alert-history.ipynb?endToEndId=e2e123&dateRange=30days`);
      });

      it('should return correct URL for transaction-network notebook', () => {
        const params = { accountId: 'acc123', timeRange: '90d' };
        const result = service.getVisualizationUrl('transaction-network', params);

        expect(result).toBe(`${mockVoilaUrl}/voila/render/transaction-network.ipynb?accountId=acc123&timeRange=90d`);
      });

      it('should handle empty params object', () => {
        const result = service.getVisualizationUrl('transaction-history', {});

        expect(result).toBe(`${mockVoilaUrl}/voila/render/transaction-viz.ipynb?`);
      });

      it('should handle multiple parameters', () => {
        const params = {
          accountId: 'acc123',
          tenantId: 'DEFAULT',
          startDate: '2024-01-01',
          endDate: '2024-12-31',
        };
        const result = service.getVisualizationUrl('transaction-history', params);

        expect(result).toContain('accountId=acc123');
        expect(result).toContain('tenantId=DEFAULT');
        expect(result).toContain('startDate=2024-01-01');
        expect(result).toContain('endDate=2024-12-31');
      });

      it('should URL-encode special characters in parameters', () => {
        const params = { name: 'Test & Value', query: 'a=b' };
        const result = service.getVisualizationUrl('alert-history', params);

        expect(result).toContain('name=Test+%26+Value');
        expect(result).toContain('query=a%3Db');
      });
    });

    describe('Invalid Notebook Names', () => {
      it('should throw NotFoundException for empty notebook name', () => {
        expect(() => {
          service.getVisualizationUrl('', { param: 'value' });
        }).toThrow(NotFoundException);
        expect(() => {
          service.getVisualizationUrl('', { param: 'value' });
        }).toThrow('Invalid notebook name');
      });

      it('should throw NotFoundException for notebook name with directory traversal (..)', () => {
        expect(() => {
          service.getVisualizationUrl('../etc/passwd', { param: 'value' });
        }).toThrow(NotFoundException);
        expect(() => {
          service.getVisualizationUrl('../etc/passwd', { param: 'value' });
        }).toThrow('Invalid notebook name');
      });

      it('should throw NotFoundException for notebook name with forward slash', () => {
        expect(() => {
          service.getVisualizationUrl('path/to/notebook', { param: 'value' });
        }).toThrow(NotFoundException);
        expect(() => {
          service.getVisualizationUrl('path/to/notebook', { param: 'value' });
        }).toThrow('Invalid notebook name');
      });

      it('should throw NotFoundException for notebook name with .. in the middle', () => {
        expect(() => {
          service.getVisualizationUrl('note..book', { param: 'value' });
        }).toThrow(NotFoundException);
        expect(() => {
          service.getVisualizationUrl('note..book', { param: 'value' });
        }).toThrow('Invalid notebook name');
      });

      it('should throw NotFoundException for null notebook name', () => {
        expect(() => {
          service.getVisualizationUrl(null as any, { param: 'value' });
        }).toThrow(NotFoundException);
      });

      it('should throw NotFoundException for undefined notebook name', () => {
        expect(() => {
          service.getVisualizationUrl(undefined as any, { param: 'value' });
        }).toThrow(NotFoundException);
      });
    });

    describe('Unknown Notebook Names', () => {
      it('should throw NotFoundException for unmapped notebook name', () => {
        expect(() => {
          service.getVisualizationUrl('unknown-notebook', { param: 'value' });
        }).toThrow(NotFoundException);
        expect(() => {
          service.getVisualizationUrl('unknown-notebook', { param: 'value' });
        }).toThrow("Notebook 'unknown-notebook' not configured");
      });

      it('should throw NotFoundException for case-sensitive mismatch', () => {
        expect(() => {
          service.getVisualizationUrl('Transaction-History', { param: 'value' });
        }).toThrow(NotFoundException);
        expect(() => {
          service.getVisualizationUrl('Transaction-History', { param: 'value' });
        }).toThrow("Notebook 'Transaction-History' not configured");
      });

      it('should throw NotFoundException for notebook with extra spaces', () => {
        expect(() => {
          service.getVisualizationUrl('transaction-history ', { param: 'value' });
        }).toThrow(NotFoundException);
      });

      it('should throw NotFoundException for similar but incorrect names', () => {
        expect(() => {
          service.getVisualizationUrl('transaction_history', { param: 'value' });
        }).toThrow(NotFoundException);
      });
    });

    describe('Parameter Handling', () => {
      it('should handle boolean parameters', () => {
        const params = { includeAlerts: 'true', detailed: 'false' };
        const result = service.getVisualizationUrl('transaction-history', params);

        expect(result).toContain('includeAlerts=true');
        expect(result).toContain('detailed=false');
      });

      it('should handle numeric string parameters', () => {
        const params = { limit: '100', page: '1' };
        const result = service.getVisualizationUrl('alert-history', params);

        expect(result).toContain('limit=100');
        expect(result).toContain('page=1');
      });

      it('should handle parameters with spaces', () => {
        const params = { accountName: 'John Doe' };
        const result = service.getVisualizationUrl('transaction-network', params);

        expect(result).toContain('accountName=John+Doe');
      });

      it('should handle single parameter', () => {
        const params = { id: '12345' };
        const result = service.getVisualizationUrl('transaction-history', params);

        expect(result).toBe(`${mockVoilaUrl}/voila/render/transaction-viz.ipynb?id=12345`);
      });

      it('should preserve parameter order', () => {
        const params = { a: '1', b: '2', c: '3' };
        const result = service.getVisualizationUrl('alert-history', params);

        const urlObj = new URL(result);
        const paramEntries = Array.from(urlObj.searchParams.entries());
        expect(paramEntries[0]).toEqual(['a', '1']);
        expect(paramEntries[1]).toEqual(['b', '2']);
        expect(paramEntries[2]).toEqual(['c', '3']);
      });
    });

    describe('URL Construction', () => {
      it('should construct URL with correct format', () => {
        const params = { test: 'value' };
        const result = service.getVisualizationUrl('transaction-history', params);

        expect(result).toMatch(/^http:\/\/test-voila:8866\/voila\/render\/transaction-viz\.ipynb\?/);
      });

      it('should include /voila/render/ path prefix', () => {
        const result = service.getVisualizationUrl('transaction-history', {});

        expect(result).toContain('/voila/render/');
      });

      it('should map to correct notebook filename', () => {
        const result1 = service.getVisualizationUrl('transaction-history', {});
        const result2 = service.getVisualizationUrl('alert-history', {});
        const result3 = service.getVisualizationUrl('transaction-network', {});

        expect(result1).toContain('transaction-viz.ipynb');
        expect(result2).toContain('alert-history.ipynb');
        expect(result3).toContain('transaction-network.ipynb');
      });

      it('should end with query string', () => {
        const params = { key: 'value' };
        const result = service.getVisualizationUrl('transaction-history', params);

        expect(result).toMatch(/\?.*$/);
      });

      it('should properly concatenate base URL and path', () => {
        const result = service.getVisualizationUrl('alert-history', { id: '123' });

        expect(result.split('/voila/render/').length).toBe(2);
        expect(result).not.toContain('//voila');
      });
    });

    describe('Edge Cases', () => {
      it('should handle empty string parameters', () => {
        const params = { empty: '' };
        const result = service.getVisualizationUrl('transaction-history', params);

        expect(result).toContain('empty=');
      });

      it('should handle parameters with special notebook names', () => {
        const params = { notebookType: 'transaction-history' };
        const result = service.getVisualizationUrl('transaction-history', params);

        expect(result).toContain('notebookType=transaction-history');
      });

      it('should handle all three notebook types consecutively', () => {
        const result1 = service.getVisualizationUrl('transaction-history', { id: '1' });
        const result2 = service.getVisualizationUrl('alert-history', { id: '2' });
        const result3 = service.getVisualizationUrl('transaction-network', { id: '3' });

        expect(result1).toContain('transaction-viz.ipynb?id=1');
        expect(result2).toContain('alert-history.ipynb?id=2');
        expect(result3).toContain('transaction-network.ipynb?id=3');
      });

      it('should handle parameters with equals signs', () => {
        const params = { filter: 'status=active' };
        const result = service.getVisualizationUrl('alert-history', params);

        expect(result).toContain('filter=status%3Dactive');
      });

      it('should handle parameters with ampersands', () => {
        const params = { query: 'a&b' };
        const result = service.getVisualizationUrl('transaction-network', params);

        expect(result).toContain('query=a%26b');
      });
    });
  });

  describe('Integration Tests', () => {
    it('should work end-to-end for typical use case', () => {
      const notebookName = 'transaction-history';
      const params = {
        entityId: 'acc_123456',
        tenantId: 'ACME_CORP',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      };

      const url = service.getVisualizationUrl(notebookName, params);

      expect(url).toBeDefined();
      expect(url).toContain(mockVoilaUrl);
      expect(url).toContain('transaction-viz.ipynb');
      expect(url).toContain('entityId=acc_123456');
      expect(url).toContain('tenantId=ACME_CORP');
    });

    it('should handle rapid successive calls', () => {
      const results: string[] = [];

      for (let i = 0; i < 10; i++) {
        results.push(service.getVisualizationUrl('transaction-history', { iteration: i.toString() }));
      }

      expect(results).toHaveLength(10);
      results.forEach((result, index) => {
        expect(result).toContain(`iteration=${index}`);
      });
    });

    it('should validate security for all notebook types', () => {
      const invalidNames = ['../hack', 'path/to/file', '..', 'test/../notebook'];

      invalidNames.forEach((invalidName) => {
        expect(() => {
          service.getVisualizationUrl(invalidName, { test: 'value' });
        }).toThrow(NotFoundException);
      });
    });
  });
});
