import { syncCaseAcl } from '../src/modules/task/utils/sync-case-acl';

describe('syncCaseAcl', () => {
  const params = { taskId: 5, previousAssigneeId: 'a', newAssigneeId: 'b', newStatus: 'STATUS_10_ASSIGNED' } as any;
  let acl: { syncTaskAssignment: jest.Mock };
  let logger: { warn: jest.Mock };

  const run = (delays: number[] = [0, 0, 0]) =>
    syncCaseAcl(acl as any, logger as any, 'Ctx', 1, 'tenant1', 'actor', params, delays);

  beforeEach(() => {
    acl = { syncTaskAssignment: jest.fn().mockResolvedValue(undefined) };
    logger = { warn: jest.fn() };
  });

  it('syncs once and does not warn when the first attempt works', async () => {
    await run();

    expect(acl.syncTaskAssignment).toHaveBeenCalledTimes(1);
    expect(acl.syncTaskAssignment).toHaveBeenCalledWith(1, 'tenant1', 'actor', params);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('retries the same transition after a failure and stops once it succeeds', async () => {
    acl.syncTaskAssignment.mockRejectedValueOnce(new Error('db blip')).mockRejectedValueOnce(new Error('db blip'));

    await run();

    expect(acl.syncTaskAssignment).toHaveBeenCalledTimes(3);
    acl.syncTaskAssignment.mock.calls.forEach((call) => expect(call).toEqual([1, 'tenant1', 'actor', params]));
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('gives up after the retries, warns once, and never throws', async () => {
    acl.syncTaskAssignment.mockRejectedValue(new Error('db down'));

    await expect(run()).resolves.toBeUndefined();

    expect(acl.syncTaskAssignment).toHaveBeenCalledTimes(4);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('after 4 attempts'), expect.any(String), 'Ctx');
  });

  it('copes with a non-Error rejection', async () => {
    acl.syncTaskAssignment.mockRejectedValue('boom');

    await run([]);

    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('boom'), undefined, 'Ctx');
  });
});
