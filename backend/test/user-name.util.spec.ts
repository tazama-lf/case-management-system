import { replaceUserIdsWithNames } from '../src/utils/user-name.util';

describe('replaceUserIdsWithNames', () => {
  const knownId = '8958bbd1-655f-4129-9293-87f85c74c273';
  const unknownId = '11111111-2222-3333-4444-555555555555';
  let prisma: any;

  beforeEach(() => {
    prisma = {
      cms_usernames: {
        findMany: jest.fn().mockResolvedValue([{ user_id: knownId, name: 'Sandy Smith' }]),
      },
    };
  });

  it('replaces known user IDs with the user name', async () => {
    const rows = [{ id: 1, action_performed: `Assigned task 12 to user ${knownId}` }];

    const result = await replaceUserIdsWithNames(prisma, rows);

    expect(result).toEqual([{ id: 1, action_performed: 'Assigned task 12 to user Sandy Smith' }]);
    expect(prisma.cms_usernames.findMany).toHaveBeenCalledWith({
      where: { user_id: { in: [knownId] } },
      select: { user_id: true, name: true },
    });
  });

  it('leaves unknown user IDs unchanged', async () => {
    const rows = [{ action_performed: `Revoked access for ${unknownId}` }];

    const result = await replaceUserIdsWithNames(prisma, rows);

    expect(result).toEqual(rows);
  });

  it('matches IDs regardless of case', async () => {
    const rows = [{ action_performed: `Task 5 reassigned to investigator ${knownId.toUpperCase()}` }];

    const result = await replaceUserIdsWithNames(prisma, rows);

    expect(result[0].action_performed).toBe('Task 5 reassigned to investigator Sandy Smith');
  });

  it('skips the lookup when no row contains a user ID', async () => {
    const rows = [{ action_performed: 'Assigned task 12 to investigator Sandy Smith' }];

    const result = await replaceUserIdsWithNames(prisma, rows);

    expect(result).toBe(rows);
    expect(prisma.cms_usernames.findMany).not.toHaveBeenCalled();
  });
});
