# Work Queue Feature Implementation

## Overview

The Work Queue feature provides a comprehensive task management system integrated with Flowable BPM for the Tazama Case Management System. It allows users to view, filter, assign, and complete tasks across different work queues based on their roles and permissions.

## Architecture

### Backend Components

#### 1. Flowable BPM Integration
- **Location**: `backend/src/flowable/`
- **Purpose**: Integrates with Flowable workflow engine for task management
- **Key Files**:
  - `flowable.service.ts` - Core Flowable API integration
  - `flowable.module.ts` - Module configuration
  - `flowable.controller.ts` - REST endpoints for Flowable operations

#### 2. Task Controller Enhancement
- **Location**: `backend/src/task/task.controller.ts`
- **Key Endpoint**: `GET /api/v1/task/work-queues/{candidateGroup}`
- **Purpose**: Provides Flowable-integrated work queue data
- **Features**:
  - Candidate group filtering
  - Role-based access control
  - Audit logging
  - Error handling with proper HTTP status codes

#### 3. Task Service Enhancement
- **Location**: `backend/src/task/task.service.ts`
- **Purpose**: Business logic for task operations
- **Integration**: Bridges database models with Flowable BPM data

### Frontend Components

#### 1. Type Definitions
- **Location**: `frontend/src/features/workqueue/types/flowable.types.ts`
- **Purpose**: TypeScript interfaces for Flowable integration
- **Key Types**:
  - `FlowableTask` - Raw Flowable task data
  - `UnifiedWorkQueueTask` - Unified task interface for UI
  - `WorkQueueCandidateGroup` - Available work queues
  - `FlowableErrorResponse` - Error handling types

#### 2. Service Layer
- **Location**: `frontend/src/features/workqueue/services/flowableWorkQueueService.ts`
- **Purpose**: API client for work queue operations
- **Features**:
  - Task retrieval by candidate group
  - Task assignment and completion
  - Data transformation between Flowable and UI formats
  - Comprehensive error handling

#### 3. Error Handling System
- **Location**: `frontend/src/features/workqueue/utils/flowableErrorHandler.ts`
- **Purpose**: Centralized error handling for Flowable operations
- **Features**:
  - Flowable-specific error parsing
  - User-friendly error messages
  - Retry logic and recovery suggestions
  - Error categorization and logging

#### 4. UI Components

##### WorkQueueDashboard
- **Location**: `frontend/src/features/workqueue/pages/WorkQueueDashboard.tsx`
- **Purpose**: Main work queue interface
- **Features**:
  - Queue selection dropdown
  - Task filtering and search
  - Task statistics display
  - Error boundary integration

##### WorkQueueTable
- **Location**: `frontend/src/features/workqueue/components/WorkQueueTable.tsx`
- **Purpose**: Task list display with actions
- **Features**:
  - Sortable columns
  - Action buttons (Assign, View, Complete)
  - Status badges
  - Responsive design

##### WorkQueueErrorBoundary
- **Location**: `frontend/src/features/workqueue/components/WorkQueueErrorBoundary.tsx`
- **Purpose**: Error boundary for work queue components
- **Features**:
  - React error boundary implementation
  - Custom error fallback UI
  - Retry functionality
  - Error recovery mechanisms

## Work Queue Types

### Candidate Groups
The system supports the following work queues:

1. **Investigations** - For investigation tasks
2. **Triage** - For alert triage tasks
3. **Supervisors** - For supervisory review tasks
4. **Analysts** - For analyst tasks
5. **Compliance** - For compliance-related tasks
6. **Fraud Prevention** - For fraud prevention tasks

Each queue has specific access controls based on user roles.

## Task States and Workflow

### Task Status Mapping
- **UNASSIGNED** - Task available for assignment
- **ASSIGNED** - Task assigned to a user
- **IN_PROGRESS** - Task currently being worked on
- **COMPLETED** - Task finished
- **SUSPENDED** - Task temporarily suspended

### Priority Levels
- **LOW** (0-39) - Low priority tasks
- **MEDIUM** (40-59) - Standard priority
- **HIGH** (60-79) - High priority tasks
- **CRITICAL** (80+) - Critical tasks requiring immediate attention

## API Endpoints

### Work Queue Endpoints

#### Get Work Queue by Candidate Group
```http
GET /api/v1/task/work-queues/{candidateGroup}
```
**Purpose**: Retrieve tasks for a specific work queue
**Authentication**: Required (Bearer token)
**Authorization**: Role-based access control
**Response**: Array of `UnifiedWorkQueueTask` objects

#### Assign Task
```http
POST /api/v1/task/{taskId}/assign
Content-Type: application/json

{
  "assignee": "user-id"
}
```

#### Complete Task
```http
POST /api/v1/task/{taskId}/complete
Content-Type: application/json

{
  "variables": {
    "outcome": "completed",
    "comments": "Task completed successfully"
  }
}
```

## Error Handling

### Error Types
1. **FLOWABLE_ERROR** - Errors from Flowable BPM engine
2. **API_ERROR** - General API errors
3. **NETWORK_ERROR** - Network connectivity issues
4. **UNKNOWN_ERROR** - Unexpected errors

### Error Recovery
- Automatic retry for network errors
- User-friendly error messages
- Detailed error logging for debugging
- Graceful degradation when services are unavailable

## Usage Examples

### Basic Work Queue Query
```typescript
import { flowableWorkQueueService } from '../services/flowableWorkQueueService';

// Get tasks for investigations queue
const tasks = await flowableWorkQueueService.getWorkQueueByGroup('Investigations');
```

### Error Handling in Components
```typescript
import { useWorkQueueErrorHandler } from '../components/WorkQueueErrorBoundary';

const MyComponent = () => {
  const { error, handleError, clearError } = useWorkQueueErrorHandler();
  
  const loadData = async () => {
    try {
      const data = await someAsyncOperation();
      // Handle success
    } catch (err) {
      handleError(err);
    }
  };
};
```

### Task Assignment
```typescript
// Assign task to user
await flowableWorkQueueService.assignTask('task-123', 'user-456');

// Complete task
await flowableWorkQueueService.completeTask('task-123', {
  outcome: 'approved',
  comments: 'Review completed'
});
```

## Configuration

### Environment Variables
```bash
# Flowable BPM Configuration
FLOWABLE_API_URL=http://localhost:8080/flowable-rest
FLOWABLE_USERNAME=admin
FLOWABLE_PASSWORD=test

# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/tazama_cms
```

### Role-based Access Control
Configure role mappings in `backend/src/auth/auth.types.ts`:
```typescript
export const RoleWorkQueueMapping = {
  investigator: ['Investigations', 'Triage'],
  supervisor: ['Supervisors', 'Investigations', 'Triage'],
  analyst: ['Analysts', 'Triage'],
  compliance: ['Compliance'],
  admin: ['*'] // Access to all queues
};
```

## Testing

### Unit Tests
```bash
# Backend tests
cd backend
npm run test

# Frontend tests
cd frontend
npm run test
```

### Integration Tests
```bash
# Run E2E tests
npm run test:e2e
```

### Manual Testing Checklist
- [ ] Queue selection changes task list
- [ ] Task filtering works correctly
- [ ] Task assignment functions
- [ ] Task completion updates status
- [ ] Error handling displays appropriate messages
- [ ] Retry functionality works for recoverable errors
- [ ] Role-based access control enforced

## Deployment

### Docker Configuration
The work queue feature is included in the main application Docker configuration:

```dockerfile
# Backend Dockerfile includes Flowable dependencies
FROM node:18-alpine
# ... build configuration

# Frontend Dockerfile includes work queue components
FROM nginx:alpine
# ... static file serving
```

### Production Considerations
1. **Flowable BPM Setup**: Ensure Flowable is properly configured and accessible
2. **Database Migrations**: Run Prisma migrations for task-related schema
3. **Environment Variables**: Configure all required environment variables
4. **Monitoring**: Set up monitoring for Flowable integration health
5. **Error Logging**: Configure centralized logging for error tracking

## Performance Optimization

### Caching Strategy
- Work queue data cached for 30 seconds
- Task counts cached for 60 seconds
- User assignments cached for 5 minutes

### Database Optimization
- Indexes on frequently queried columns
- Connection pooling for database connections
- Query optimization for large task datasets

### Frontend Optimization
- Component memoization for task lists
- Virtual scrolling for large datasets
- Debounced search and filtering
- Lazy loading of task details

## Troubleshooting

### Common Issues

#### 1. Flowable Connection Errors
**Symptoms**: "Failed to connect to Flowable BPM"
**Solutions**:
- Verify Flowable service is running
- Check network connectivity
- Validate authentication credentials

#### 2. Task Loading Failures
**Symptoms**: Empty task lists or loading errors
**Solutions**:
- Check candidate group permissions
- Verify database connectivity
- Review server logs for detailed errors

#### 3. Assignment Failures
**Symptoms**: "Failed to assign task" errors
**Solutions**:
- Verify user exists and is active
- Check task state (must be unassigned)
- Validate user permissions for the task

### Debug Mode
Enable debug logging:
```bash
DEBUG=flowable:*,workqueue:* npm start
```

### Health Checks
Monitor these endpoints:
- `/health` - Application health
- `/api/v1/flowable/health` - Flowable connectivity
- `/api/v1/task/work-queues/health` - Work queue service health

## Future Enhancements

### Planned Features
1. **Real-time Updates**: WebSocket integration for live task updates
2. **Advanced Filtering**: Date ranges, custom field filters
3. **Bulk Operations**: Multi-task assignment and completion
4. **Task Templates**: Predefined task structures
5. **Reporting**: Task metrics and performance analytics
6. **Mobile Support**: Responsive design improvements
7. **Notifications**: Email/SMS notifications for task assignments
8. **Integration**: Additional BPM engine support

### Technical Debt
1. Implement comprehensive user picker for task assignment
2. Add task viewing modal with full details
3. Enhance error message localization
4. Improve offline support
5. Add comprehensive audit logging
6. Implement task delegation features

## Documentation References
- [Flowable BPM Documentation](https://www.flowable.org/docs/)
- [NestJS Documentation](https://docs.nestjs.com/)
- [React Error Boundaries](https://reactjs.org/docs/error-boundaries.html)
- [TypeScript Best Practices](https://typescript-eslint.io/docs/)