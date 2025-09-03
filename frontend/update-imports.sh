#!/bin/bash

# Script to update import paths for the new feature-based structure

echo "Updating import paths for feature-based structure..."

# Navigate to frontend directory
cd /Users/mayhem/Projects/Tazama/case-management-system/frontend/src

echo "Updating imports in App.tsx..."
# Fix App.tsx imports
sed -i '' 's|./contexts/AuthContext|./features/auth/contexts/AuthContext|g' App.tsx
sed -i '' 's|./components/accessibility/AccessibilityComponents|./features/shared/components/ui/AccessibilityComponents|g' App.tsx

echo "Updating imports in components/index.ts..."
# Fix components/index.ts
sed -i '' 's|./layout/|./features/shared/components/layout/|g' components/index.ts
sed -i '' 's|./common/AlertsTable|./features/alerts/components/AlertsTable|g' components/index.ts
sed -i '' 's|./common/AlertsDetailModal|./features/alerts/components/AlertsDetailModal|g' components/index.ts
sed -i '' 's|./common/AlertsSearchAndFilters|./features/alerts/components/AlertsSearchAndFilters|g' components/index.ts
sed -i '' 's|../types/alertsdashboard.types|../features/alerts/types/alertsdashboard.types|g' components/index.ts

echo "Updating context imports..."
# Fix NavigationContext
sed -i '' 's|../types/navigation.types|../features/shared/types/navigation.types|g' contexts/NavigationContext.ts

echo "Updating router imports..."
# Fix router/index.tsx
sed -i '' 's|../components/layout/LayoutWithProvider|../features/shared/components/layout/LayoutWithProvider|g' router/index.tsx
sed -i '' 's|../components/auth/ProtectedRoute|../features/auth/components/ProtectedRoute|g' router/index.tsx
sed -i '' 's|../pages/Login|../features/auth/pages/Login|g' router/index.tsx
sed -i '' 's|../pages/AlertsDashboard|../features/alerts/pages/AlertsDashboard|g' router/index.tsx
sed -i '' 's|../pages/CasesDashboard|../features/cases/pages/CasesDashboard|g' router/index.tsx
sed -i '' 's|../pages/SupervisorDashboard|../features/dashboard/pages/SupervisorDashboard|g' router/index.tsx
sed -i '' 's|../pages/AdminDashboard|../features/dashboard/pages/AdminDashboard|g' router/index.tsx

echo "Updating services/index.ts..."
# Fix services/index.ts
sed -i '' 's|./apiClient|../features/shared/services/apiClient|g' services/index.ts
sed -i '' 's|./authService|../features/auth/services/authService|g' services/index.ts
sed -i '' 's|./triageservice|../features/alerts/services/triageservice|g' services/index.ts
sed -i '' 's|./caseService|../features/cases/services/caseService|g' services/index.ts

echo "Updating types/index.ts..."
# Fix types/index.ts
sed -i '' 's|./triage.types|../features/alerts/types/triage.types|g' types/index.ts
sed -i '' 's|./alertsdashboard.types|../features/alerts/types/alertsdashboard.types|g' types/index.ts
sed -i '' 's|../utils/alertTransformers|../features/alerts/utils/alertTransformers|g' types/index.ts

echo "Updating test imports..."
# Fix test files
sed -i '' 's|../../types/triage.types|../../features/alerts/types/triage.types|g' test/mocks/server.ts
sed -i '' 's|../services/triageservice|../features/alerts/services/triageservice|g' test/triageServiceTest.ts
sed -i '' 's|../types/triage.types|../features/alerts/types/triage.types|g' test/triageServiceTest.ts

echo "Import path updates completed!"
