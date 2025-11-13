-- Update existing candidateGroup values to uppercase standardized format
-- This migration updates existing tasks to use the new naming convention

-- Update 'investigations' to 'INVESTIGATION'
UPDATE tasks 
SET "candidateGroup" = 'INVESTIGATION' 
WHERE "candidateGroup" = 'investigations';

-- Update 'Investigations' to 'INVESTIGATION' 
UPDATE tasks 
SET "candidateGroup" = 'INVESTIGATION' 
WHERE "candidateGroup" = 'Investigations';

-- Update 'investigator' to 'INVESTIGATOR'
UPDATE tasks 
SET "candidateGroup" = 'INVESTIGATOR' 
WHERE "candidateGroup" = 'investigator';

-- Update 'Investigator' to 'INVESTIGATOR'
UPDATE tasks 
SET "candidateGroup" = 'INVESTIGATOR' 
WHERE "candidateGroup" = 'Investigator';

-- Update 'investigators' to 'INVESTIGATOR'
UPDATE tasks 
SET "candidateGroup" = 'INVESTIGATOR' 
WHERE "candidateGroup" = 'investigators';

-- Update 'supervisors' to 'SUPERVISOR'
UPDATE tasks 
SET "candidateGroup" = 'SUPERVISOR' 
WHERE "candidateGroup" = 'supervisors';

-- Update 'Supervisors' to 'SUPERVISOR'
UPDATE tasks 
SET "candidateGroup" = 'SUPERVISOR' 
WHERE "candidateGroup" = 'Supervisors';

-- Update 'supervisor' to 'SUPERVISOR'
UPDATE tasks 
SET "candidateGroup" = 'SUPERVISOR' 
WHERE "candidateGroup" = 'supervisor';

-- Show the results
SELECT "candidateGroup", COUNT(*) as count 
FROM tasks 
GROUP BY "candidateGroup" 
ORDER BY "candidateGroup";
