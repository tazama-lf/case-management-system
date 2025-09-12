import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { SystemCaseCreationDto } from '../../../src/case/dto/system-case-creation.dto';
import { Priority, CaseType, AlertType } from '@prisma/client';

describe('SystemCaseCreationDto', () => {
    let dto: SystemCaseCreationDto;

    beforeEach(() => {
        dto = plainToClass(SystemCaseCreationDto, {
            tenantId: '123e4567-e89b-12d3-a456-426614174000',
            alertData: {
                typology: 'Money Laundering',
                riskScore: 75,
                indicators: { suspiciousPattern: true },
                ruleResults: { rule1: 'passed' }
            },
            transaction: {
                transactionId: 'txn-123',
                amount: 10000,
                currency: 'USD',
                debtor: { name: 'John Doe', account: '123456' },
                creditor: { name: 'Jane Smith', account: '789012' },
                timestamp: '2024-01-01T00:00:00Z',
                transactionType: 'pacs.008'
            }
        });
    });

    describe('Valid DTOs', () => {
        it('should validate a complete valid DTO', async () => {
            const errors = await validate(dto);
            expect(errors).toHaveLength(0);
        });

        it('should validate with all optional fields provided', async () => {
            dto.systemIdentifier = 'TADProc-001';
            dto.priority = Priority.URGENT;
            dto.caseType = CaseType.FRAUD;
            dto.alertType = AlertType.AML;
            dto.reportStatus = 'ALRT';
            dto.message = 'Suspicious transaction detected';
            dto.source = 'TAZAMA';
            dto.transactionType = 'pacs.008';
            dto.networkMap = { nodes: [], edges: [] };
            dto.confidencePercentage = 85;

            const errors = await validate(dto);
            expect(errors).toHaveLength(0);
        });

        it('should validate with minimal required fields', async () => {
            const minimalDto = plainToClass(SystemCaseCreationDto, {
                tenantId: '123e4567-e89b-12d3-a456-426614174000',
                alertData: {
                    typology: 'Fraud',
                    riskScore: 50,
                    indicators: {}
                },
                transaction: {
                    transactionId: 'txn-456',
                    amount: 5000,
                    currency: 'EUR',
                    debtor: { account: '111' },
                    creditor: { account: '222' },
                    timestamp: '2024-01-01T00:00:00Z'
                }
            });

            const errors = await validate(minimalDto);
            expect(errors).toHaveLength(0);
        });

        it('should default priority to NEW when not provided', () => {
            expect(dto.priority).toBe(Priority.NEW);
        });
    });

    describe('Invalid DTOs', () => {
        it('should fail validation with invalid UUID', async () => {
            dto.tenantId = 'not-a-uuid';
            const errors = await validate(dto);
            expect(errors).toHaveLength(1);
            expect(errors[0].property).toBe('tenantId');
        });

        it('should fail validation with missing tenantId', async () => {
            const invalidDto = plainToClass(SystemCaseCreationDto, {
                alertData: dto.alertData,
                transaction: dto.transaction
            });
            const errors = await validate(invalidDto);
            expect(errors.some(e => e.property === 'tenantId')).toBe(true);
        });

        it('should fail validation with invalid priority enum', async () => {
            // Type assertion to bypass TypeScript checking for testing
            (dto as unknown as { priority: string }).priority = 'INVALID_PRIORITY';
            const errors = await validate(dto);
            expect(errors.some(e => e.property === 'priority')).toBe(true);
        });

        it('should fail validation with invalid caseType enum', async () => {
            // Type assertion to bypass TypeScript checking for testing
            (dto as unknown as { caseType: string }).caseType = 'INVALID_TYPE';
            const errors = await validate(dto);
            expect(errors.some(e => e.property === 'caseType')).toBe(true);
        });

        it('should fail validation with invalid alertType enum', async () => {
            // Type assertion to bypass TypeScript checking for testing
            (dto as unknown as { alertType: string }).alertType = 'INVALID_ALERT';
            const errors = await validate(dto);
            expect(errors.some(e => e.property === 'alertType')).toBe(true);
        });

        it('should fail validation with confidence percentage below 0', async () => {
            dto.confidencePercentage = -1;
            const errors = await validate(dto);
            expect(errors.some(e => e.property === 'confidencePercentage')).toBe(true);
        });

        it('should fail validation with confidence percentage above 100', async () => {
            dto.confidencePercentage = 101;
            const errors = await validate(dto);
            expect(errors.some(e => e.property === 'confidencePercentage')).toBe(true);
        });
    });

    describe('AlertData validation', () => {
        it('should fail validation with missing typology', async () => {
            // Type assertion for testing invalid scenarios
            (dto.alertData as unknown as { typology: undefined }).typology = undefined;
            const errors = await validate(dto);
            expect(errors).not.toHaveLength(0);
        });

        it('should fail validation with empty typology', async () => {
            dto.alertData.typology = '';
            const errors = await validate(dto);
            expect(errors.some(e => e.property === 'alertData')).toBe(true);
        });

        it('should fail validation with invalid risk score below 0', async () => {
            dto.alertData.riskScore = -1;
            const errors = await validate(dto);
            expect(errors.some(e => e.property === 'alertData')).toBe(true);
        });

        it('should fail validation with invalid risk score above 100', async () => {
            dto.alertData.riskScore = 101;
            const errors = await validate(dto);
            expect(errors.some(e => e.property === 'alertData')).toBe(true);
        });

        it('should validate with valid risk score boundaries', async () => {
            dto.alertData.riskScore = 0;
            let errors = await validate(dto);
            expect(errors).toHaveLength(0);

            dto.alertData.riskScore = 100;
            errors = await validate(dto);
            expect(errors).toHaveLength(0);
        });

        it('should validate without optional ruleResults', async () => {
            delete dto.alertData.ruleResults;
            const errors = await validate(dto);
            expect(errors).toHaveLength(0);
        });
    });

    describe('TransactionData validation', () => {
        it('should fail validation with missing transactionId', async () => {
            // Type assertion for testing invalid scenarios
            (dto.transaction as unknown as { transactionId: undefined }).transactionId = undefined;
            const errors = await validate(dto);
            expect(errors).not.toHaveLength(0);
        });

        it('should fail validation with empty transactionId', async () => {
            dto.transaction.transactionId = '';
            const errors = await validate(dto);
            expect(errors.some(e => e.property === 'transaction')).toBe(true);
        });

        it('should fail validation with missing amount', async () => {
            // Type assertion for testing invalid scenarios
            (dto.transaction as unknown as { amount: undefined }).amount = undefined;
            const errors = await validate(dto);
            expect(errors).not.toHaveLength(0);
        });

        it('should fail validation with non-numeric amount', async () => {
            // Type assertion for testing invalid scenarios
            (dto.transaction as unknown as { amount: string }).amount = 'not-a-number';
            const errors = await validate(dto);
            expect(errors).not.toHaveLength(0);
        });

        it('should validate with negative amount', async () => {
            dto.transaction.amount = -500;
            const errors = await validate(dto);
            expect(errors).toHaveLength(0);
        });

        it('should validate without optional transactionType', async () => {
            delete dto.transaction.transactionType;
            const errors = await validate(dto);
            expect(errors).toHaveLength(0);
        });

        it('should fail validation with missing currency', async () => {
            // Type assertion for testing invalid scenarios
            (dto.transaction as unknown as { currency: undefined }).currency = undefined;
            const errors = await validate(dto);
            expect(errors).not.toHaveLength(0);
        });

        it('should fail validation with missing debtor', async () => {
            // Type assertion for testing invalid scenarios
            (dto.transaction as unknown as { debtor: undefined }).debtor = undefined;
            const errors = await validate(dto);
            expect(errors).not.toHaveLength(0);
        });

        it('should fail validation with missing creditor', async () => {
            // Type assertion for testing invalid scenarios
            (dto.transaction as unknown as { creditor: undefined }).creditor = undefined;
            const errors = await validate(dto);
            expect(errors).not.toHaveLength(0);
        });

        it('should fail validation with missing timestamp', async () => {
            // Type assertion for testing invalid scenarios
            (dto.transaction as unknown as { timestamp: undefined }).timestamp = undefined;
            const errors = await validate(dto);
            expect(errors).not.toHaveLength(0);
        });
    });

    describe('Type transformation', () => {
        it('should properly transform plain object to class instance', () => {
            const plain = {
                tenantId: '123e4567-e89b-12d3-a456-426614174000',
                priority: 'URGENT',
                alertData: {
                    typology: 'Test',
                    riskScore: 50,
                    indicators: {}
                },
                transaction: {
                    transactionId: 'txn-999',
                    amount: 1000,
                    currency: 'USD',
                    debtor: {},
                    creditor: {},
                    timestamp: '2024-01-01'
                }
            };

            const transformed = plainToClass(SystemCaseCreationDto, plain);
            expect(transformed).toBeInstanceOf(SystemCaseCreationDto);
            expect(transformed.tenantId).toBe(plain.tenantId);
            // When priority is explicitly set in plain object, it should use that value
            expect(transformed.priority).toBe(plain.priority);
        });

        it('should use default priority when not provided', () => {
            const plain = {
                tenantId: '123e4567-e89b-12d3-a456-426614174000',
                // priority not provided
                alertData: {
                    typology: 'Test',
                    riskScore: 50,
                    indicators: {}
                },
                transaction: {
                    transactionId: 'txn-999',
                    amount: 1000,
                    currency: 'USD',
                    debtor: {},
                    creditor: {},
                    timestamp: '2024-01-01'
                }
            };

            const transformed = plainToClass(SystemCaseCreationDto, plain);
            expect(transformed).toBeInstanceOf(SystemCaseCreationDto);
            // When priority is not provided, it should use the default NEW value
            expect(transformed.priority).toBe(Priority.NEW);
        });
    });

    describe('Edge cases', () => {
        it('should handle very large risk scores at boundary', async () => {
            dto.alertData.riskScore = 100;
            const errors = await validate(dto);
            expect(errors).toHaveLength(0);
        });

        it('should handle zero risk score', async () => {
            dto.alertData.riskScore = 0;
            const errors = await validate(dto);
            expect(errors).toHaveLength(0);
        });

        it('should handle complex nested objects in indicators', async () => {
            dto.alertData.indicators = {
                level1: {
                    level2: {
                        level3: {
                            deepValue: true,
                            array: [1, 2, 3],
                            object: { key: 'value' }
                        }
                    }
                }
            };
            const errors = await validate(dto);
            expect(errors).toHaveLength(0);
        });

        it('should handle complex networkMap structures', async () => {
            dto.networkMap = {
                nodes: [
                    { id: '1', label: 'Node 1', type: 'account' },
                    { id: '2', label: 'Node 2', type: 'transaction' }
                ],
                edges: [
                    { from: '1', to: '2', weight: 0.8 }
                ],
                metadata: {
                    version: '1.0',
                    timestamp: new Date().toISOString()
                }
            };
            const errors = await validate(dto);
            expect(errors).toHaveLength(0);
        });

        it('should validate all Priority enum values', async () => {
            const priorities = [Priority.NEW, Priority.URGENT, Priority.CRITICAL, Priority.BREACH];

            for (const priority of priorities) {
                dto.priority = priority;
                const errors = await validate(dto);
                expect(errors).toHaveLength(0);
            }
        });

        it('should validate all CaseType enum values', async () => {
            const caseTypes = [CaseType.FRAUD, CaseType.AML, CaseType.FRAUD_AND_AML];

            for (const caseType of caseTypes) {
                dto.caseType = caseType;
                const errors = await validate(dto);
                expect(errors).toHaveLength(0);
            }
        });

        it('should validate all AlertType enum values', async () => {
            const alertTypes = [AlertType.FRAUD, AlertType.AML, AlertType.FRAUD_AND_AML];

            for (const alertType of alertTypes) {
                dto.alertType = alertType;
                const errors = await validate(dto);
                expect(errors).toHaveLength(0);
            }
        });
    });
});