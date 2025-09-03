#!/bin/bash

# Script to fix imports within features

echo "Fixing imports within features..."

cd /Users/mayhem/Projects/Tazama/case-management-system/frontend/src/features

echo "Fixing alerts feature imports..."
# Fix alerts internal imports
find alerts -name "*.tsx" -o -name "*.ts" | xargs sed -i '' 's|../../types/triage.types|../types/triage.types|g'
find alerts -name "*.tsx" -o -name "*.ts" | xargs sed -i '' 's|../../types/alertsdashboard.types|../types/alertsdashboard.types|g'
find alerts -name "*.tsx" -o -name "*.ts" | xargs sed -i '' 's|../../services/triageservice|../services/triageservice|g'
find alerts -name "*.tsx" -o -name "*.ts" | xargs sed -i '' 's|../../contexts/AuthContext|../auth/contexts/AuthContext|g'
find alerts -name "*.tsx" -o -name "*.ts" | xargs sed -i '' 's|../../hooks/useCase|../cases/hooks/useCase|g'
find alerts -name "*.tsx" -o -name "*.ts" | xargs sed -i '' 's|../../providers/NotificationProvider|../providers/NotificationProvider|g'
find alerts -name "*.tsx" -o -name "*.ts" | xargs sed -i '' 's|../../test/mocks/server|../test/mocks/server|g'

# Fix relative imports within alerts
find alerts -name "*.tsx" -o -name "*.ts" | xargs sed -i '' 's|../components/common/|../components/|g'

echo "Fixing auth feature imports..."
# Fix auth internal imports
find auth -name "*.tsx" -o -name "*.ts" | xargs sed -i '' 's|../../contexts/AuthContext|../contexts/AuthContext|g'
find auth -name "*.tsx" -o -name "*.ts" | xargs sed -i '' 's|../contexts/AuthContext|../contexts/AuthContext|g'

echo "Fixing shared feature imports..."
# Fix shared internal imports
find shared -name "*.tsx" -o -name "*.ts" | xargs sed -i '' 's|../../contexts/AuthContext|../auth/contexts/AuthContext|g'
find shared -name "*.tsx" -o -name "*.ts" | xargs sed -i '' 's|../config/roles.config|../config/roles.config|g'
find shared -name "*.tsx" -o -name "*.ts" | xargs sed -i '' 's|./authService.ts|../auth/services/authService|g'

echo "Fixing cases feature imports..."
# Fix cases internal imports
find cases -name "*.tsx" -o -name "*.ts" | xargs sed -i '' 's|../types/triage.types|../alerts/types/triage.types|g'
find cases -name "*.tsx" -o -name "*.ts" | xargs sed -i '' 's|./apiClient|../shared/services/apiClient|g'

echo "Feature imports fixed!"
