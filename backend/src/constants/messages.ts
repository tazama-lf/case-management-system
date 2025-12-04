export const ErrorMessages = {
    CANNOT_UPDATE_ALERT_WHEN_TRIAGE_TYPE_NOT_MANUAL: (alertId: string) => `Cannot update alert ${alertId} when triageType is not MANUAL`,
    
    // Triage Service Error Messages
    ALERT_CASE_ID_MISSING: 'Alert case_id is missing.',
    TRIAGE_ALREADY_COMPLETE: 'Triage Already Complete',
    CASE_ALREADY_CLOSED: (caseId: string, alertId: string) => `Case ${caseId} linked with alert ${alertId} is already closed`,
    ALERT_NOT_FOUND: (alertId: string) => `Alert ${alertId} not found`,
    ALERT_NOT_ACCESSIBLE: (alertId: string) => `Alert ${alertId} is not accessible for this tenant`,
    ALERT_NOT_FOUND_FOR_TENANT: (alertId: string, tenantId: string) => `Alert with ID ${alertId} was not found for tenant ${tenantId}.`,
    CASE_NOT_FOUND: (caseId: string) => `Case ${caseId} not found`,
    
    // Generic error messages
    UNABLE_TO_RETRIEVE_ALERT_DETAILS: 'Unable to retrieve alert details',
    TRIAGE_PROCESS_FAILED: 'Triage process failed',
    FAILED_TO_AUTO_CLOSE_CASE: 'Failed to auto close case',
    FAILED_TO_COMPLETE_TRIAGE: 'Failed to complete triage',
    FAILED_TO_UPDATE_ALERT_AND_TASK: 'Failed to update alert and triage task',
    AI_PREDICTION_FAILED: 'AI prediction failed',
};

export const AlertMessages = {
    AI_TRIAGE_FAILED: 'AI_TRIAGE_FAILED',
    CASE_AUTO_CLOSED: 'CASE_AUTO_CLOSED',
    CASE_AUTO_CLOSE_FAILED: 'CASE_AUTO_CLOSE_FAILED',
    INVESTIGATION_TASK_TRIGGERED: 'INVESTIGATION_TASK_TRIGGERED',
    INVESTIGATION_TASK_TRIGGER_FAILED: 'INVESTIGATION_TASK_TRIGGER_FAILED',
    TRIAGE_ALERT_UPDATED: 'TRIAGE_ALERT_UPDATED'
}

export const SuccessMessages = {
    ALERT_UPDATED_SUCCESSFULLY: 'Alert updated successfully',
}