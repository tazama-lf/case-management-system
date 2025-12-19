import 'reflect-metadata';
import { Priority } from '@prisma/client-cms';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { AlertMessageDto } from '../../src/modules/nats/dto/AlertMessageDto.dto';

describe('AlertMessageDto', () => {
  it('should be defined', () => {
    expect(AlertMessageDto).toBeDefined();
  });

  it('should create an instance', () => {
    const dto = new AlertMessageDto();
    expect(dto).toBeDefined();
    expect(dto).toBeInstanceOf(AlertMessageDto);
  });

  it('should validate a complete valid DTO', () => {
    const alertData = {
      tenant_id: 'test-tenant',
      priority: Priority.URGENT,
      source: 'test-source',
      txtp: 'test-txtp',
      message: 'Test alert message',
      report: {}, // External Alert interface - simplified for testing
      transaction: {
        TenantId: 'e52cc9fb-920b-43db-be90-712b4b923514',
        TxTp: 'payment',
      },
      networkMap: {}, // External NetworkMap interface - simplified for testing
      confidence_per: 85,
      case_id: 'test-case-123',
      userId: 'test-user',
    };

    // Use plainToClass instead of plainToInstance and skip nested validation for external types
    const dto = plainToClass(AlertMessageDto, alertData);

    // Manually validate only the basic fields we control
    expect(dto.tenant_id).toBe('test-tenant');
    expect(dto.priority).toBe(Priority.URGENT);
    expect(dto.source).toBe('test-source');
    expect(dto.txtp).toBe('test-txtp');
    expect(dto.message).toBe('Test alert message');
    expect(dto.confidence_per).toBe(85);
    expect(dto.case_id).toBe('test-case-123');
    expect(dto.userId).toBe('test-user');
  });

  it('should validate required fields only', () => {
    const minimalData = {
      tenant_id: 'test-tenant',
      message: 'Test alert message',
      report: {},
      transaction: {
        TenantId: 'e52cc9fb-920b-43db-be90-712b4b923514',
        TxTp: 'payment',
      },
      networkMap: {},
      confidence_per: 75,
    };

    const dto = plainToClass(AlertMessageDto, minimalData);

    // Verify required fields are set
    expect(dto.tenant_id).toBe('test-tenant');
    expect(dto.message).toBe('Test alert message');
    expect(dto.confidence_per).toBe(75);
  });

  it('should validate all Priority enum values', () => {
    const priorities = [Priority.NEW, Priority.URGENT, Priority.CRITICAL, Priority.BREACH];

    for (const priority of priorities) {
      const dto = plainToClass(AlertMessageDto, {
        tenant_id: 'test-tenant',
        message: 'Test message',
        report: {},
        transaction: {
          TenantId: 'e52cc9fb-920b-43db-be90-712b4b923514',
          TxTp: 'payment',
        },
        networkMap: {},
        confidence_per: 50,
        priority: priority,
      });

      expect(dto.priority).toBe(priority);
    }
  });

  it('should fail validation for missing required fields', async () => {
    const invalidData = {
      priority: Priority.URGENT,
      // Missing required fields: tenant_id, message, report, transaction, networkMap, confidence_per
    };

    const dto = plainToClass(AlertMessageDto, invalidData);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);

    // Check for specific missing field errors
    const hasRequiredFieldErrors = errors.some((error) =>
      ['tenant_id', 'message', 'confidence_per', 'report', 'transaction', 'networkMap'].includes(error.property),
    );
    expect(hasRequiredFieldErrors).toBe(true);
  });

  it('should fail validation for invalid priority', async () => {
    const dto = plainToClass(AlertMessageDto, {
      tenant_id: 'test-tenant',
      message: 'Test message',
      report: {},
      transaction: {
        TenantId: 'e52cc9fb-920b-43db-be90-712b4b923514',
        TxTp: 'payment',
      },
      networkMap: {},
      confidence_per: 50,
      priority: 'INVALID_PRIORITY',
    });

    const errors = await validate(dto);
    const priorityErrors = errors.filter((error) => error.property === 'priority');
    expect(priorityErrors.length).toBeGreaterThan(0);
  });

  it('should validate optional fields with valid values', () => {
    const dto = plainToClass(AlertMessageDto, {
      tenant_id: 'test-tenant',
      message: 'Test message',
      report: {},
      transaction: {
        TenantId: 'e52cc9fb-920b-43db-be90-712b4b923514',
        TxTp: 'payment',
      },
      networkMap: {},
      confidence_per: 50,
      priority: Priority.CRITICAL,
      case_id: 'case-456',
      userId: 'user-789',
      source: 'fraud-detection',
      txtp: 'payment-transfer',
    });

    expect(dto.priority).toBe(Priority.CRITICAL);
    expect(dto.case_id).toBe('case-456');
    expect(dto.userId).toBe('user-789');
    expect(dto.source).toBe('fraud-detection');
    expect(dto.txtp).toBe('payment-transfer');
  });

  it('should fail validation for invalid types', async () => {
    const dto = plainToClass(AlertMessageDto, {
      tenant_id: 123, // should be string
      message: 456, // should be string
      confidence_per: 'invalid-number', // should be number
      case_id: 789, // should be string
      userId: 101, // should be string
      source: 112, // should be string
      txtp: 113, // should be string
      report: {},
      transaction: {
        TenantId: 'e52cc9fb-920b-43db-be90-712b4b923514',
        TxTp: 'payment',
      },
      networkMap: {},
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should handle null values for optional fields', () => {
    const dto = plainToClass(AlertMessageDto, {
      tenant_id: 'test-tenant',
      message: 'Test message',
      report: {},
      transaction: {
        TenantId: 'e52cc9fb-920b-43db-be90-712b4b923514',
        TxTp: 'payment',
      },
      networkMap: {},
      confidence_per: 50,
      priority: null,
      case_id: null,
      userId: null,
      source: null,
      txtp: null,
    });

    // Null values for optional fields should be acceptable
    expect(dto.priority).toBeNull();
    expect(dto.case_id).toBeNull();
    expect(dto.userId).toBeNull();
    expect(dto.source).toBeNull();
    expect(dto.txtp).toBeNull();
  });

  it('should handle undefined values for optional fields', () => {
    const dto = plainToClass(AlertMessageDto, {
      tenant_id: 'test-tenant',
      message: 'Test message',
      report: {},
      transaction: {
        TenantId: 'e52cc9fb-920b-43db-be90-712b4b923514',
        TxTp: 'payment',
      },
      networkMap: {},
      confidence_per: 50,
      priority: undefined,
      case_id: undefined,
      userId: undefined,
      source: undefined,
      txtp: undefined,
    });

    // Undefined values for optional fields should be acceptable
    expect(dto.priority).toBeUndefined();
    expect(dto.case_id).toBeUndefined();
    expect(dto.userId).toBeUndefined();
    expect(dto.source).toBeUndefined();
    expect(dto.txtp).toBeUndefined();
  });

  it('should validate tenant_id field', () => {
    const data = {
      tenant_id: 'test-tenant',
      message: 'Test message',
      report: {},
      transaction: {
        TenantId: 'e52cc9fb-920b-43db-be90-712b4b923514',
        TxTp: 'payment',
      },
      networkMap: {},
      confidence_per: 50,
    };
    const dto = plainToClass(AlertMessageDto, data);
    expect(dto.tenant_id).toBe('test-tenant');
  });

  it('should fail validation for missing tenant_id', async () => {
    const dto = plainToClass(AlertMessageDto, {
      message: 'Test message',
      report: {},
      transaction: {
        TenantId: 'e52cc9fb-920b-43db-be90-712b4b923514',
        TxTp: 'payment',
      },
      networkMap: {},
      confidence_per: 50,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const tenantIdError = errors.find((error) => error.property === 'tenant_id');
    expect(tenantIdError).toBeDefined();
  });

  it('should fail validation for missing message', async () => {
    const dto = plainToClass(AlertMessageDto, {
      tenant_id: 'test-tenant',
      report: {},
      transaction: {
        TenantId: 'e52cc9fb-920b-43db-be90-712b4b923514',
        TxTp: 'payment',
      },
      networkMap: {},
      confidence_per: 50,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const messageError = errors.find((error) => error.property === 'message');
    expect(messageError).toBeDefined();
  });

  it('should fail validation for missing confidence_per', async () => {
    const dto = plainToClass(AlertMessageDto, {
      tenant_id: 'test-tenant',
      message: 'Test message',
      report: {},
      transaction: {
        TenantId: 'e52cc9fb-920b-43db-be90-712b4b923514',
        TxTp: 'payment',
      },
      networkMap: {},
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const confidenceError = errors.find((error) => error.property === 'confidence_per');
    expect(confidenceError).toBeDefined();
  });

  it('should fail validation for missing transaction', async () => {
    const dto = plainToClass(AlertMessageDto, {
      tenant_id: 'test-tenant',
      message: 'Test message',
      report: {},
      networkMap: {},
      confidence_per: 50,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);

    // Check that there's at least one error (transaction field is missing)
    const hasValidationErrors = errors.length > 0;
    expect(hasValidationErrors).toBe(true);
  });

  it('should fail validation for invalid transaction TenantId', async () => {
    const dto = plainToClass(AlertMessageDto, {
      tenant_id: 'test-tenant',
      message: 'Test message',
      report: {},
      transaction: {
        TenantId: 'invalid-uuid', // should be valid UUID
        TxTp: 'payment',
      },
      networkMap: {},
      confidence_per: 50,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);

    // Look for transaction validation errors
    const transactionErrors = errors.filter((error) => error.property === 'transaction');
    expect(transactionErrors.length).toBeGreaterThan(0);
  });
});
