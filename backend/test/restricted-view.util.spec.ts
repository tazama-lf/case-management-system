import {
  isInvestigateTask,
  redactAlertForRestrictedView,
  redactCaseForRestrictedView,
  redactTasksForRestrictedView,
} from '../src/modules/case-investigator/restricted-view.util';

describe('restricted-view.util', () => {
  describe('isInvestigateTask', () => {
    it.each(['Investigate Case', 'Investigate case', 'Investigate Fraud', 'Investigate AML'])('recognises "%s"', (name) => {
      expect(isInvestigateTask(name)).toBe(true);
    });

    it.each(['Complete New Case', 'Approve Case Closure', 'SAR/STR Filing', '', null, undefined])('does not treat %p as an investigate task', (name) => {
      expect(isInvestigateTask(name as string | null | undefined)).toBe(false);
    });
  });

  describe('redactTasksForRestrictedView', () => {
    it('blanks the notes of Investigate tasks only', () => {
      const tasks = [
        { task_id: 1, name: 'Investigate Case', investigationNotes: 'secret findings', status: 'STATUS_30_COMPLETED' },
        { task_id: 2, name: 'Complete New Case', investigationNotes: 'triage note', status: 'STATUS_30_COMPLETED' },
      ];

      const result = redactTasksForRestrictedView(tasks);

      expect(result[0]).toEqual({ task_id: 1, name: 'Investigate Case', investigationNotes: null, status: 'STATUS_30_COMPLETED' });
      expect(result[1]).toEqual(tasks[1]);
    });

    it('does not mutate the input', () => {
      const tasks = [{ name: 'Investigate Case', investigationNotes: 'secret' }];

      redactTasksForRestrictedView(tasks);

      expect(tasks[0].investigationNotes).toBe('secret');
    });
  });

  describe('redactAlertForRestrictedView', () => {
    it('blanks the visualization fields and keeps the summary fields', () => {
      const alert = { alert_id: 7, message: 'm', alert_type: 'FRAUD', transaction: { a: 1 }, alert_data: { b: 2 }, network_map: { c: 3 } };

      expect(redactAlertForRestrictedView(alert)).toEqual({
        alert_id: 7,
        message: 'm',
        alert_type: 'FRAUD',
        transaction: null,
        alert_data: null,
        network_map: null,
      });
    });

    it('only touches fields that are present (list rows select just the transaction)', () => {
      const alert = { alert_id: 7, transaction: { a: 1 } };

      const result = redactAlertForRestrictedView(alert);

      expect(result).toEqual({ alert_id: 7, transaction: null });
      expect('alert_data' in result).toBe(false);
    });

    it.each([null, undefined])('passes %p through', (value) => {
      expect(redactAlertForRestrictedView(value)).toBe(value);
    });
  });

  describe('redactCaseForRestrictedView', () => {
    it('redacts alert and tasks and stamps access_level RESTRICTED', () => {
      const caseData = {
        case_id: 843,
        status: 'STATUS_22_PENDING_FINAL_APPROVAL',
        alert: { alert_id: 1, transaction: { x: 1 } },
        tasks: [{ name: 'Investigate Case', investigationNotes: 'secret' }],
      };

      const result = redactCaseForRestrictedView(caseData);

      expect(result.access_level).toBe('RESTRICTED');
      expect(result.case_id).toBe(843);
      expect(result.alert).toEqual({ alert_id: 1, transaction: null });
      expect(result.tasks[0].investigationNotes).toBeNull();
    });

    it('copes with a case that has no tasks or alert', () => {
      const bare = { case_id: 1 };

      expect(redactCaseForRestrictedView(bare)).toMatchObject({ case_id: 1, access_level: 'RESTRICTED' });
    });
  });
});
