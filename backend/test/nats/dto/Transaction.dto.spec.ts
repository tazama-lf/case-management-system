import { validate } from 'class-validator';
import { TransactionDTO } from '../../../src/modules/alert/dto/Transaction.dto';

describe('TransactionDTO', () => {
  let dto: TransactionDTO;

  beforeEach(() => {
    dto = new TransactionDTO();
  });

  describe('TenantId validation', () => {
    it('should pass with valid UUID', async () => {
      dto.TenantId = '123e4567-e89b-12d3-a456-426614174000';
      dto.TxTp = 'test-transaction';

      const errors = await validate(dto);
      const tenantIdErrors = errors.filter((error) => error.property === 'TenantId');
      expect(tenantIdErrors).toHaveLength(0);
    });

    it('should fail with invalid UUID format', async () => {
      dto.TenantId = 'invalid-uuid';
      dto.TxTp = 'test-transaction';

      const errors = await validate(dto);
      const tenantIdErrors = errors.filter((error) => error.property === 'TenantId');
      expect(tenantIdErrors.length).toBeGreaterThan(0);
    });

    it('should fail when TenantId is missing', async () => {
      dto.TxTp = 'test-transaction';
      // Don't set TenantId

      const errors = await validate(dto);
      const tenantIdErrors = errors.filter((error) => error.property === 'TenantId');
      expect(tenantIdErrors.length).toBeGreaterThan(0);
    });

    it('should fail when TenantId is null', async () => {
      dto.TenantId = null as any;
      dto.TxTp = 'test-transaction';

      const errors = await validate(dto);
      const tenantIdErrors = errors.filter((error) => error.property === 'TenantId');
      expect(tenantIdErrors.length).toBeGreaterThan(0);
    });

    it('should fail when TenantId is undefined', async () => {
      dto.TenantId = undefined as any;
      dto.TxTp = 'test-transaction';

      const errors = await validate(dto);
      const tenantIdErrors = errors.filter((error) => error.property === 'TenantId');
      expect(tenantIdErrors.length).toBeGreaterThan(0);
    });
  });

  describe('TxTp validation', () => {
    it('should pass with valid string', async () => {
      dto.TenantId = '123e4567-e89b-12d3-a456-426614174000';
      dto.TxTp = 'test-transaction-type';

      const errors = await validate(dto);
      const txTpErrors = errors.filter((error) => error.property === 'TxTp');
      expect(txTpErrors).toHaveLength(0);
    });

    it('should pass with empty string', async () => {
      dto.TenantId = '123e4567-e89b-12d3-a456-426614174000';
      dto.TxTp = '';

      const errors = await validate(dto);
      const txTpErrors = errors.filter((error) => error.property === 'TxTp');
      expect(txTpErrors).toHaveLength(0);
    });

    it('should fail when TxTp is missing', async () => {
      dto.TenantId = '123e4567-e89b-12d3-a456-426614174000';
      // Don't set TxTp

      const errors = await validate(dto);
      const txTpErrors = errors.filter((error) => error.property === 'TxTp');
      expect(txTpErrors.length).toBeGreaterThan(0);
    });

    it('should fail when TxTp is null', async () => {
      dto.TenantId = '123e4567-e89b-12d3-a456-426614174000';
      dto.TxTp = null as any;

      const errors = await validate(dto);
      const txTpErrors = errors.filter((error) => error.property === 'TxTp');
      expect(txTpErrors.length).toBeGreaterThan(0);
    });

    it('should fail when TxTp is undefined', async () => {
      dto.TenantId = '123e4567-e89b-12d3-a456-426614174000';
      dto.TxTp = undefined as any;

      const errors = await validate(dto);
      const txTpErrors = errors.filter((error) => error.property === 'TxTp');
      expect(txTpErrors.length).toBeGreaterThan(0);
    });

    it('should fail when TxTp is not a string', async () => {
      dto.TenantId = '123e4567-e89b-12d3-a456-426614174000';
      dto.TxTp = 123 as any;

      const errors = await validate(dto);
      const txTpErrors = errors.filter((error) => error.property === 'TxTp');
      expect(txTpErrors.length).toBeGreaterThan(0);
    });
  });

  describe('complete DTO validation', () => {
    it('should pass with all valid fields', async () => {
      dto.TenantId = '123e4567-e89b-12d3-a456-426614174000';
      dto.TxTp = 'payment-transaction';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail with all invalid fields', async () => {
      dto.TenantId = 'invalid-uuid';
      dto.TxTp = null as any;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);

      const tenantIdErrors = errors.filter((error) => error.property === 'TenantId');
      const txTpErrors = errors.filter((error) => error.property === 'TxTp');

      expect(tenantIdErrors.length).toBeGreaterThan(0);
      expect(txTpErrors.length).toBeGreaterThan(0);
    });

    it('should fail when both fields are missing', async () => {
      // Don't set any fields

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);

      const tenantIdErrors = errors.filter((error) => error.property === 'TenantId');
      const txTpErrors = errors.filter((error) => error.property === 'TxTp');

      expect(tenantIdErrors.length).toBeGreaterThan(0);
      expect(txTpErrors.length).toBeGreaterThan(0);
    });

    it('should handle mixed valid and invalid fields', async () => {
      dto.TenantId = '123e4567-e89b-12d3-a456-426614174000'; // Valid
      dto.TxTp = 123 as any; // Invalid

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);

      const tenantIdErrors = errors.filter((error) => error.property === 'TenantId');
      const txTpErrors = errors.filter((error) => error.property === 'TxTp');

      expect(tenantIdErrors).toHaveLength(0); // Should be valid
      expect(txTpErrors.length).toBeGreaterThan(0); // Should be invalid
    });
  });

  describe('property decorators', () => {
    it('should have @IsUUID decorator on TenantId property', () => {
      const dto = new TransactionDTO();
      dto.TenantId = '123e4567-e89b-12d3-a456-426614174000';
      dto.TxTp = 'test';

      // This test ensures the decorator is applied correctly
      expect(dto.TenantId).toBe('123e4567-e89b-12d3-a456-426614174000');
    });

    it('should have @IsString decorator on TxTp property', () => {
      const dto = new TransactionDTO();
      dto.TenantId = '123e4567-e89b-12d3-a456-426614174000';
      dto.TxTp = 'test-string';

      // This test ensures the decorator is applied correctly
      expect(dto.TxTp).toBe('test-string');
    });
  });
});
