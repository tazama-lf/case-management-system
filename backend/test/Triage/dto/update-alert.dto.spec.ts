import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { UpdateAlertDto } from 'src/modules/triage/dto/update-alert.dto';
import { Priority, AlertType, PredictionOutcome } from '@prisma/client-cms';

describe('UpdateAlertDto', () => {
  it('should be defined', () => {
    expect(UpdateAlertDto).toBeDefined();
  });

  it('should validate a valid DTO with all fields', async () => {
    const validData = {
      confidence_per: 85,
      priority: Priority.URGENT,
      note: 'Test note for the alert update',
      alertType: AlertType.FRAUD,
      predictionOutcome: PredictionOutcome.TRUE_POSITIVE,
    };

    const dto = plainToClass(UpdateAlertDto, validData);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.confidence_per).toBe(85);
    expect(dto.priority).toBe(Priority.URGENT);
    expect(dto.note).toBe('Test note for the alert update');
    expect(dto.alertType).toBe(AlertType.FRAUD);
    expect(dto.predictionOutcome).toBe(PredictionOutcome.TRUE_POSITIVE);
  });

  it('should validate a DTO with only confidence_per and note', async () => {
    const validData = {
      confidence_per: 75,
      note: 'Test note for confidence update',
    };

    const dto = plainToClass(UpdateAlertDto, validData);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.confidence_per).toBe(75);
    expect(dto.priority).toBeUndefined();
    expect(dto.note).toBe('Test note for confidence update');
  });

  it('should validate a DTO with only priority and note', async () => {
    const validData = {
      priority: Priority.CRITICAL,
      note: 'Test note for priority update',
    };

    const dto = plainToClass(UpdateAlertDto, validData);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.confidence_per).toBeUndefined();
    expect(dto.priority).toBe(Priority.CRITICAL);
    expect(dto.note).toBe('Test note for priority update');
  });

  it('should validate a DTO with only note', async () => {
    const validData = {
      note: 'Just a note without other fields',
    };

    const dto = plainToClass(UpdateAlertDto, validData);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.confidence_per).toBeUndefined();
    expect(dto.priority).toBeUndefined();
    expect(dto.note).toBe('Just a note without other fields');
  });

  it('should fail validation when note is missing', async () => {
    const invalidData = {
      confidence_per: 85,
      priority: Priority.URGENT,
    };

    const dto = plainToClass(UpdateAlertDto, invalidData);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const noteError = errors.find((error) => error.property === 'note');
    expect(noteError).toBeDefined();
    expect(noteError?.constraints).toHaveProperty('isString');
  });

  it('should validate note with empty string', async () => {
    const validData = {
      note: '',
    };

    const dto = plainToClass(UpdateAlertDto, validData);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.note).toBe('');
  });

  it('should validate note with only whitespace', async () => {
    const validData = {
      note: '   \t\n   ',
    };

    const dto = plainToClass(UpdateAlertDto, validData);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.note).toBe('   \t\n   ');
  });

  it('should fail validation when note exceeds maximum length', async () => {
    const invalidData = {
      note: 'A'.repeat(501), // Exceeds 500 character limit
    };

    const dto = plainToClass(UpdateAlertDto, invalidData);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const noteError = errors.find((error) => error.property === 'note');
    expect(noteError).toBeDefined();
    expect(noteError?.constraints).toHaveProperty('maxLength');
  });

  it('should validate note at maximum length', async () => {
    const validData = {
      note: 'A'.repeat(500), // Exactly 500 characters
    };

    const dto = plainToClass(UpdateAlertDto, validData);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.note.length).toBe(500);
  });

  it('should fail validation when confidence_per is not a number', async () => {
    const invalidData = {
      confidence_per: 'not a number',
    };

    const dto = plainToClass(UpdateAlertDto, invalidData);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const confidenceError = errors.find((error) => error.property === 'confidence_per');
    expect(confidenceError).toBeDefined();
    expect(confidenceError?.constraints).toHaveProperty('isNumber');
  });

  it('should fail validation when priority is not a valid enum value', async () => {
    const invalidData = {
      priority: 'INVALID_PRIORITY',
    };

    const dto = plainToClass(UpdateAlertDto, invalidData);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const priorityError = errors.find((error) => error.property === 'priority');
    expect(priorityError).toBeDefined();
    expect(priorityError?.constraints).toHaveProperty('isEnum');
  });

  it('should validate with different priority values', async () => {
    const priorities = [Priority.NEW, Priority.URGENT, Priority.CRITICAL, Priority.BREACH];

    for (const priority of priorities) {
      const validData = {
        confidence_per: 50,
        priority: priority,
        note: `Test with priority ${priority}`,
      };

      const dto = plainToClass(UpdateAlertDto, validData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
      expect(dto.priority).toBe(priority);
    }
  });

  it('should validate with different alertType values', async () => {
    const alertTypes = [AlertType.FRAUD, AlertType.AML, AlertType.FRAUD_AND_AML];

    for (const alertType of alertTypes) {
      const validData = {
        alertType: alertType,
        note: `Test with alert type ${alertType}`,
      };

      const dto = plainToClass(UpdateAlertDto, validData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
      expect(dto.alertType).toBe(alertType);
    }
  });

  it('should validate with different predictionOutcome values', async () => {
    const predictionOutcomes = [
      PredictionOutcome.FALSE_POSITIVE,
      PredictionOutcome.TRUE_POSITIVE,
      PredictionOutcome.FALSE_NEGATIVE,
      PredictionOutcome.TRUE_NEGATIVE,
    ];

    for (const outcome of predictionOutcomes) {
      const validData = {
        predictionOutcome: outcome,
        note: `Test with prediction outcome ${outcome}`,
      };

      const dto = plainToClass(UpdateAlertDto, validData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
      expect(dto.predictionOutcome).toBe(outcome);
    }
  });

  it('should fail validation when alertType is invalid', async () => {
    const invalidData = {
      alertType: 'INVALID_TYPE',
    };

    const dto = plainToClass(UpdateAlertDto, invalidData);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const alertError = errors.find((error) => error.property === 'alertType');
    expect(alertError).toBeDefined();
    expect(alertError?.constraints).toHaveProperty('isEnum');
  });

  it('should fail validation when predictionOutcome is invalid', async () => {
    const invalidData = {
      predictionOutcome: 'INVALID_OUTCOME',
    };

    const dto = plainToClass(UpdateAlertDto, invalidData);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const outcomeError = errors.find((error) => error.property === 'predictionOutcome');
    expect(outcomeError).toBeDefined();
    expect(outcomeError?.constraints).toHaveProperty('isEnum');
  });

  it('should handle edge case numeric values for confidence_per', async () => {
    const edgeCases = [0, 100, 50.5, 99.99];

    for (const confidence of edgeCases) {
      const validData = {
        confidence_per: confidence,
        note: 'Test note for edge case values',
      };

      const dto = plainToClass(UpdateAlertDto, validData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
      expect(dto.confidence_per).toBe(confidence);
    }
  });

  it('should validate confidence_per with decimal precision', async () => {
    const decimalValues = [0.1, 15.5, 99.99, 33.333333];

    for (const confidence of decimalValues) {
      const validData = {
        confidence_per: confidence,
        note: 'Test note for decimal values',
      };

      const dto = plainToClass(UpdateAlertDto, validData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
      expect(dto.confidence_per).toBe(confidence);
    }
  });

  it('should validate negative confidence_per values', async () => {
    const validData = {
      confidence_per: -50,
      note: 'Test note for negative values',
    };

    const dto = plainToClass(UpdateAlertDto, validData);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.confidence_per).toBe(-50);
  });

  it('should validate very large confidence_per values', async () => {
    const validData = {
      confidence_per: 999999.99,
      note: 'Test note for large values',
    };

    const dto = plainToClass(UpdateAlertDto, validData);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.confidence_per).toBe(999999.99);
  });

  it('should validate with note containing special characters', async () => {
    const specialNotes = [
      'Note with émojis 🚨💰',
      'Note with @#$%^&*()_+ symbols',
      'Note with\nnewlines\tand\ttabs',
      'Note with "quotes" and \'apostrophes\'',
      'Very long note that contains many words and should still be valid as long as it is not empty',
    ];

    for (const note of specialNotes) {
      const validData = {
        note: note,
      };

      const dto = plainToClass(UpdateAlertDto, validData);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
      expect(dto.note).toBe(note);
    }
  });

  it('should handle null values for optional fields', () => {
    const plainObject = {
      confidence_per: null,
      priority: null,
      note: null,
      alertType: null,
      predictionOutcome: null,
    };

    const dto = plainToClass(UpdateAlertDto, plainObject);

    expect(dto.confidence_per).toBeNull();
    expect(dto.priority).toBeNull();
    expect(dto.note).toBeNull();
    expect(dto.alertType).toBeNull();
    expect(dto.predictionOutcome).toBeNull();
  });

  it('should validate case sensitivity of enum values', async () => {
    const invalidData = {
      priority: 'urgent', // lowercase
      alertType: 'fraud', // lowercase
      predictionOutcome: 'true_positive', // lowercase
    };

    const dto = plainToClass(UpdateAlertDto, invalidData);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((error) => error.property === 'priority')).toBe(true);
    expect(errors.some((error) => error.property === 'alertType')).toBe(true);
    expect(errors.some((error) => error.property === 'predictionOutcome')).toBe(true);
  });

  it('should validate all fields together with maximum values', async () => {
    const validData = {
      confidence_per: 92.5,
      priority: Priority.BREACH,
      alertType: AlertType.FRAUD_AND_AML,
      predictionOutcome: PredictionOutcome.TRUE_POSITIVE,
      note: 'Complete DTO with all fields filled correctly',
    };

    const dto = plainToClass(UpdateAlertDto, validData);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.confidence_per).toBe(92.5);
    expect(dto.priority).toBe(Priority.BREACH);
    expect(dto.alertType).toBe(AlertType.FRAUD_AND_AML);
    expect(dto.predictionOutcome).toBe(PredictionOutcome.TRUE_POSITIVE);
    expect(dto.note).toBe('Complete DTO with all fields filled correctly');
  });

  it('should fail validation with multiple invalid fields', async () => {
    const invalidData = {
      confidence_per: 'not a number',
      priority: 'INVALID_PRIORITY',
      alertType: 'INVALID_TYPE',
      predictionOutcome: 'INVALID_OUTCOME',
      // note is missing completely, which should cause validation error
    };

    const dto = plainToClass(UpdateAlertDto, invalidData);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((error) => error.property === 'confidence_per')).toBe(true);
    expect(errors.some((error) => error.property === 'priority')).toBe(true);
    expect(errors.some((error) => error.property === 'alertType')).toBe(true);
    expect(errors.some((error) => error.property === 'predictionOutcome')).toBe(true);
    expect(errors.some((error) => error.property === 'note')).toBe(true);
  });
});
