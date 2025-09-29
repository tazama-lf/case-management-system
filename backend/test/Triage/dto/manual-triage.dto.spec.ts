import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { ManualTriageDto } from '../../../src/triage/dto/manual-triage.dto';
import { CaseStatus, Priority, AlertType, PredictionOutcome } from '@prisma/client';

describe('ManualTriageDto', () => {
  // Helper function to create valid base data
  const createValidBaseData = () => ({
    priorityScore: 75,
    note: 'Test note',
    status: CaseStatus.STATUS_82_CLOSED_CONFIRMED,
  });

  it('should be defined', () => {
    expect(ManualTriageDto).toBeDefined();
  });

  it('should create an instance with all properties', () => {
    const dto = new ManualTriageDto();
    expect(dto).toBeInstanceOf(ManualTriageDto);
    expect(dto).toHaveProperty('priorityScore');
    expect(dto).toHaveProperty('note');
    expect(dto).toHaveProperty('status');
    expect(dto).toHaveProperty('confidence_per');
    expect(dto).toHaveProperty('priority');
    expect(dto).toHaveProperty('alertType');
    expect(dto).toHaveProperty('predictionOutcome');
  });

  it('should allow setting and getting all properties', () => {
    const dto = new ManualTriageDto();
    
    dto.priorityScore = 85;
    dto.note = 'Manual triage note';
    dto.status = CaseStatus.STATUS_82_CLOSED_CONFIRMED;
    dto.confidence_per = 90;
    dto.priority = Priority.URGENT;
    dto.alertType = AlertType.FRAUD;
    dto.predictionOutcome = PredictionOutcome.TRUE_POSITIVE;

    expect(dto.priorityScore).toBe(85);
    expect(dto.note).toBe('Manual triage note');
    expect(dto.status).toBe(CaseStatus.STATUS_82_CLOSED_CONFIRMED);
    expect(dto.confidence_per).toBe(90);
    expect(dto.priority).toBe(Priority.URGENT);
    expect(dto.alertType).toBe(AlertType.FRAUD);
    expect(dto.predictionOutcome).toBe(PredictionOutcome.TRUE_POSITIVE);
  });

  describe('validation tests', () => {
    it('should validate a complete valid DTO', async () => {
      const validData = {
        ...createValidBaseData(),
        confidence_per: 95,
        priority: Priority.URGENT,
        alertType: AlertType.FRAUD,
        predictionOutcome: PredictionOutcome.TRUE_POSITIVE,
      };

      const dto = plainToClass(ManualTriageDto, validData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
      expect(dto.priorityScore).toBe(75);
      expect(dto.note).toBe('Test note');
      expect(dto.status).toBe(CaseStatus.STATUS_82_CLOSED_CONFIRMED);
      expect(dto.confidence_per).toBe(95);
      expect(dto.priority).toBe(Priority.URGENT);
      expect(dto.alertType).toBe(AlertType.FRAUD);
      expect(dto.predictionOutcome).toBe(PredictionOutcome.TRUE_POSITIVE);
    });

    it('should validate with only required fields', async () => {
      const validData = createValidBaseData();

      const dto = plainToClass(ManualTriageDto, validData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
      expect(dto.priorityScore).toBe(75);
      expect(dto.note).toBe('Test note');
      expect(dto.status).toBe(CaseStatus.STATUS_82_CLOSED_CONFIRMED);
    });

    it('should handle undefined values for optional fields', async () => {
      const validData = createValidBaseData();

      const dto = plainToClass(ManualTriageDto, validData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
      expect(dto.confidence_per).toBeUndefined();
      expect(dto.priority).toBeUndefined();
      expect(dto.alertType).toBeUndefined();
      expect(dto.predictionOutcome).toBeUndefined();
    });
  });

  describe('priorityScore validation', () => {
    it('should accept valid number for priorityScore', async () => {
      const validData = {
        ...createValidBaseData(),
        priorityScore: 80,
      };

      const dto = plainToClass(ManualTriageDto, validData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
      expect(dto.priorityScore).toBe(80);
    });

    it('should reject non-number priorityScore', async () => {
      const invalidData = {
        ...createValidBaseData(),
        priorityScore: 'not-a-number',
      };

      const dto = plainToClass(ManualTriageDto, invalidData);
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      const priorityScoreError = errors.find(error => error.property === 'priorityScore');
      expect(priorityScoreError).toBeDefined();
      expect(priorityScoreError?.constraints).toHaveProperty('isNumber');
    });

    it('should reject missing priorityScore', async () => {
      const invalidData = {
        note: 'Test note',
        status: CaseStatus.STATUS_82_CLOSED_CONFIRMED,
      };

      const dto = plainToClass(ManualTriageDto, invalidData);
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      const priorityScoreError = errors.find(error => error.property === 'priorityScore');
      expect(priorityScoreError).toBeDefined();
      expect(priorityScoreError?.constraints).toHaveProperty('isNumber');
    });

    it('should accept decimal numbers for priorityScore', async () => {
      const validData = {
        ...createValidBaseData(),
        priorityScore: 75.5,
      };

      const dto = plainToClass(ManualTriageDto, validData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
      expect(dto.priorityScore).toBe(75.5);
    });
  });

  describe('note validation', () => {
    it('should accept valid string for note', async () => {
      const validData = {
        ...createValidBaseData(),
        note: 'This is a valid note',
      };

      const dto = plainToClass(ManualTriageDto, validData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
      expect(dto.note).toBe('This is a valid note');
    });

    it('should reject non-string note', async () => {
      const invalidData = {
        ...createValidBaseData(),
        note: 123,
      };

      const dto = plainToClass(ManualTriageDto, invalidData);
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      const noteError = errors.find(error => error.property === 'note');
      expect(noteError).toBeDefined();
      expect(noteError?.constraints).toHaveProperty('isString');
    });

    it('should reject missing note', async () => {
      const invalidData = {
        priorityScore: 75,
        status: CaseStatus.STATUS_82_CLOSED_CONFIRMED,
      };

      const dto = plainToClass(ManualTriageDto, invalidData);
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      const noteError = errors.find(error => error.property === 'note');
      expect(noteError).toBeDefined();
      expect(noteError?.constraints).toHaveProperty('isString');
    });

    it('should reject note exceeding maximum length', async () => {
      const longNote = 'A'.repeat(501); // 501 characters, exceeds 500 limit
      const invalidData = {
        ...createValidBaseData(),
        note: longNote,
      };

      const dto = plainToClass(ManualTriageDto, invalidData);
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      const noteError = errors.find(error => error.property === 'note');
      expect(noteError).toBeDefined();
      expect(noteError?.constraints).toHaveProperty('maxLength');
    });

    it('should accept note at maximum length', async () => {
      const maxLengthNote = 'A'.repeat(500); // Exactly 500 characters
      const validData = {
        ...createValidBaseData(),
        note: maxLengthNote,
      };

      const dto = plainToClass(ManualTriageDto, validData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
      expect(dto.note).toBe(maxLengthNote);
      expect(dto.note.length).toBe(500);
    });

    it('should accept empty string note', async () => {
      const validData = {
        ...createValidBaseData(),
        note: '',
      };

      const dto = plainToClass(ManualTriageDto, validData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
      expect(dto.note).toBe('');
    });
  });

  describe('status validation', () => {
    it('should accept valid CaseStatus enum values', async () => {
      const validStatuses = [
        CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
        CaseStatus.STATUS_82_CLOSED_CONFIRMED,
        CaseStatus.STATUS_81_CLOSED_REFUTED,
      ];

      for (const status of validStatuses) {
        const validData = {
          ...createValidBaseData(),
          status,
        };

        const dto = plainToClass(ManualTriageDto, validData);
        const errors = await validate(dto);

        expect(errors).toHaveLength(0);
        expect(dto.status).toBe(status);
      }
    });

    it('should reject invalid status value', async () => {
      const invalidData = {
        ...createValidBaseData(),
        status: 'INVALID_STATUS',
      };

      const dto = plainToClass(ManualTriageDto, invalidData);
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      const statusError = errors.find(error => error.property === 'status');
      expect(statusError).toBeDefined();
      expect(statusError?.constraints).toHaveProperty('isEnum');
    });

    it('should reject missing status', async () => {
      const invalidData = {
        priorityScore: 75,
        note: 'Test note',
      };

      const dto = plainToClass(ManualTriageDto, invalidData);
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      const statusError = errors.find(error => error.property === 'status');
      expect(statusError).toBeDefined();
      expect(statusError?.constraints).toHaveProperty('isEnum');
    });
  });

  describe('confidence_per validation (optional)', () => {
    it('should accept valid number for confidence_per', async () => {
      const validData = {
        ...createValidBaseData(),
        confidence_per: 85,
      };

      const dto = plainToClass(ManualTriageDto, validData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
      expect(dto.confidence_per).toBe(85);
    });

    it('should accept undefined confidence_per', async () => {
      const validData = createValidBaseData();

      const dto = plainToClass(ManualTriageDto, validData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
      expect(dto.confidence_per).toBeUndefined();
    });

    it('should reject non-number confidence_per', async () => {
      const invalidData = {
        ...createValidBaseData(),
        confidence_per: 'not-a-number',
      };

      const dto = plainToClass(ManualTriageDto, invalidData);
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      const confidenceError = errors.find(error => error.property === 'confidence_per');
      expect(confidenceError).toBeDefined();
      expect(confidenceError?.constraints).toHaveProperty('isNumber');
    });

    it('should accept decimal numbers for confidence_per', async () => {
      const validData = {
        ...createValidBaseData(),
        confidence_per: 85.5,
      };

      const dto = plainToClass(ManualTriageDto, validData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
      expect(dto.confidence_per).toBe(85.5);
    });
  });

  describe('priority validation (optional)', () => {
    it('should accept valid Priority enum values', async () => {
      const validPriorities = [
        Priority.NEW,
        Priority.URGENT,
        Priority.CRITICAL,
        Priority.BREACH,
      ];

      for (const priority of validPriorities) {
        const validData = {
          ...createValidBaseData(),
          priority,
        };

        const dto = plainToClass(ManualTriageDto, validData);
        const errors = await validate(dto);

        expect(errors).toHaveLength(0);
        expect(dto.priority).toBe(priority);
      }
    });

    it('should accept undefined priority', async () => {
      const validData = createValidBaseData();

      const dto = plainToClass(ManualTriageDto, validData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
      expect(dto.priority).toBeUndefined();
    });

    it('should reject invalid priority value', async () => {
      const invalidData = {
        ...createValidBaseData(),
        priority: 'INVALID_PRIORITY',
      };

      const dto = plainToClass(ManualTriageDto, invalidData);
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      const priorityError = errors.find(error => error.property === 'priority');
      expect(priorityError).toBeDefined();
      expect(priorityError?.constraints).toHaveProperty('isEnum');
    });
  });

  describe('alertType validation (optional)', () => {
    it('should accept valid AlertType enum values', async () => {
      const validAlertTypes = [
        AlertType.FRAUD,
        AlertType.AML,
        AlertType.FRAUD_AND_AML,
      ];

      for (const alertType of validAlertTypes) {
        const validData = {
          ...createValidBaseData(),
          alertType,
        };

        const dto = plainToClass(ManualTriageDto, validData);
        const errors = await validate(dto);

        expect(errors).toHaveLength(0);
        expect(dto.alertType).toBe(alertType);
      }
    });

    it('should accept undefined alertType', async () => {
      const validData = createValidBaseData();

      const dto = plainToClass(ManualTriageDto, validData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
      expect(dto.alertType).toBeUndefined();
    });

    it('should reject invalid alertType value', async () => {
      const invalidData = {
        ...createValidBaseData(),
        alertType: 'INVALID_ALERT_TYPE',
      };

      const dto = plainToClass(ManualTriageDto, invalidData);
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      const alertTypeError = errors.find(error => error.property === 'alertType');
      expect(alertTypeError).toBeDefined();
      expect(alertTypeError?.constraints).toHaveProperty('isEnum');
    });
  });

  describe('predictionOutcome validation (optional)', () => {
    it('should accept valid PredictionOutcome enum values', async () => {
      const validOutcomes = [
        PredictionOutcome.TRUE_POSITIVE,
        PredictionOutcome.FALSE_POSITIVE,
        PredictionOutcome.FALSE_NEGATIVE,
        PredictionOutcome.TRUE_NEGATIVE,
      ];

      for (const predictionOutcome of validOutcomes) {
        const validData = {
          ...createValidBaseData(),
          predictionOutcome,
        };

        const dto = plainToClass(ManualTriageDto, validData);
        const errors = await validate(dto);

        expect(errors).toHaveLength(0);
        expect(dto.predictionOutcome).toBe(predictionOutcome);
      }
    });

    it('should accept undefined predictionOutcome', async () => {
      const validData = createValidBaseData();

      const dto = plainToClass(ManualTriageDto, validData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
      expect(dto.predictionOutcome).toBeUndefined();
    });

    it('should reject invalid predictionOutcome value', async () => {
      const invalidData = {
        ...createValidBaseData(),
        predictionOutcome: 'INVALID_OUTCOME',
      };

      const dto = plainToClass(ManualTriageDto, invalidData);
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      const outcomeError = errors.find(error => error.property === 'predictionOutcome');
      expect(outcomeError).toBeDefined();
      expect(outcomeError?.constraints).toHaveProperty('isEnum');
    });
  });

  describe('edge cases and combinations', () => {
    it('should handle all fields with valid values', async () => {
      const validData = {
        priorityScore: 95,
        note: 'Comprehensive manual triage with all fields',
        status: CaseStatus.STATUS_82_CLOSED_CONFIRMED,
        confidence_per: 90,
        priority: Priority.CRITICAL,
        alertType: AlertType.FRAUD_AND_AML,
        predictionOutcome: PredictionOutcome.TRUE_POSITIVE,
      };

      const dto = plainToClass(ManualTriageDto, validData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
      expect(dto.priorityScore).toBe(95);
      expect(dto.note).toBe('Comprehensive manual triage with all fields');
      expect(dto.status).toBe(CaseStatus.STATUS_82_CLOSED_CONFIRMED);
      expect(dto.confidence_per).toBe(90);
      expect(dto.priority).toBe(Priority.CRITICAL);
      expect(dto.alertType).toBe(AlertType.FRAUD_AND_AML);
      expect(dto.predictionOutcome).toBe(PredictionOutcome.TRUE_POSITIVE);
    });

    it('should handle multiple validation errors', async () => {
      const invalidData = {
        priorityScore: 'not-a-number',
        note: 'A'.repeat(501), // Too long
        status: 'INVALID_STATUS',
        confidence_per: 'not-a-number',
        priority: 'INVALID_PRIORITY',
        alertType: 'INVALID_ALERT_TYPE',
        predictionOutcome: 'INVALID_OUTCOME',
      };

      const dto = plainToClass(ManualTriageDto, invalidData);
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(error => error.property === 'priorityScore')).toBe(true);
      expect(errors.some(error => error.property === 'note')).toBe(true);
      expect(errors.some(error => error.property === 'status')).toBe(true);
      expect(errors.some(error => error.property === 'confidence_per')).toBe(true);
      expect(errors.some(error => error.property === 'priority')).toBe(true);
      expect(errors.some(error => error.property === 'alertType')).toBe(true);
      expect(errors.some(error => error.property === 'predictionOutcome')).toBe(true);
    });

    it('should handle null values for optional fields', async () => {
      const validData = {
        ...createValidBaseData(),
        confidence_per: null,
        priority: null,
        alertType: null,
        predictionOutcome: null,
      };

      const dto = plainToClass(ManualTriageDto, validData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
      expect(dto.confidence_per).toBeNull();
      expect(dto.priority).toBeNull();
      expect(dto.alertType).toBeNull();
      expect(dto.predictionOutcome).toBeNull();
    });

    it('should support property enumeration and serialization', () => {
      const dto = new ManualTriageDto();
      dto.priorityScore = 80;
      dto.note = 'Test note';
      dto.status = CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT;

      const keys = Object.keys(dto);
      expect(keys).toContain('priorityScore');
      expect(keys).toContain('note');
      expect(keys).toContain('status');

      const serialized = JSON.stringify(dto);
      const parsed = JSON.parse(serialized);
      
      expect(parsed.priorityScore).toBe(80);
      expect(parsed.note).toBe('Test note');
      expect(parsed.status).toBe(CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT);
    });

    it('should support different instantiation patterns', () => {
      const dto1 = new ManualTriageDto();
      expect(dto1).toBeInstanceOf(ManualTriageDto);

      const dto2 = Object.create(ManualTriageDto.prototype);
      expect(dto2).toBeInstanceOf(ManualTriageDto);

      const dto3 = plainToClass(ManualTriageDto, createValidBaseData());
      expect(dto3).toBeInstanceOf(ManualTriageDto);
    });
  });
});
