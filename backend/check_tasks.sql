SELECT task_id, name, status, "candidateGroup", assigned_user_id, created_at 
FROM "Task" 
WHERE status IN ('STATUS_01_UNASSIGNED', 'STATUS_10_ASSIGNED', 'STATUS_20_IN_PROGRESS')
ORDER BY created_at DESC 
LIMIT 10;
