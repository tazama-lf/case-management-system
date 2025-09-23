# Flowable BPM Integration Setup Guide

## Overview

This guide explains how to connect the Tazama Case Management System to a Flowable BPM instance for real work queue management. The system includes a fallback mechanism that provides mock data when Flowable is not accessible.

## Quick Start

### 1. Environment Configuration

Add these environment variables to your backend `.env` file:

```bash
# Flowable BPM Configuration
FLOWABLE_URL=http://10.10.80.30:8081/flowable-rest
FLOWABLE_USERNAME=rest-admin
FLOWABLE_PASSWORD=test
```

### 2. Start the Application

```bash
# Start backend
cd backend
npm run start:dev

# Start frontend (in another terminal)
cd frontend
npm run dev
```

### 3. Access Work Queues

Navigate to http://localhost:5173/work-queue in your browser to see the work queue interface.

## Connection Status

### When Flowable is Available
- ✅ Real tasks are fetched from the Flowable BPM engine
- ✅ Task assignments and completions are processed by Flowable
- ✅ Process instances are created and managed by Flowable

### When Flowable is Unavailable
- ⚠️ Mock tasks are generated automatically
- ⚠️ Task operations (assign/complete) are simulated
- ⚠️ Console logs indicate fallback mode is active

## Testing the Connection

### Health Check
```bash
# Test Flowable connectivity (requires valid auth token)
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:3000/api/v1/task/flowable/health
```

### Direct Flowable API Test
```bash
# Test direct connection to Flowable
curl -u "rest-admin:test" \
     "http://10.10.80.30:8081/flowable-rest/service/management/engine"
```

## Work Queue Endpoints

### Get Tasks by Candidate Group
```http
GET /api/v1/task/work-queues/{candidateGroup}
Authorization: Bearer {token}
```

**Available Candidate Groups:**
- `Investigations` - Investigation team tasks
- `Triage` - Alert triage tasks  
- `Supervisors` - Supervisor review tasks
- `Analysts` - Analyst tasks
- `Compliance` - Compliance team tasks
- `Fraud Prevention` - Fraud prevention tasks

**Example Response:**
```json
[
  {
    "id": "task-123",
    "name": "Investigate Suspicious Transaction",
    "description": "Review alert for potential fraud",
    "assignee": null,
    "candidateGroups": ["Investigations"],
    "processInstanceId": "proc-456",
    "createTime": "2025-09-22T10:00:00Z",
    "dueDate": "2025-09-23T10:00:00Z",
    "priority": 50,
    "suspended": false,
    "processVariables": {
      "caseId": "CASE-ABC123",
      "alertId": "ALERT-XYZ789"
    }
  }
]
```

## Setting Up Flowable BPM

### Option 1: Use Existing Flowable Instance

If you have access to a Flowable server (like `http://10.10.80.30:8081`):

1. Ensure the server is accessible from your network
2. Configure the correct credentials in your `.env` file
3. Test connectivity using the health check endpoint

### Option 2: Run Local Flowable Instance

```bash
# Using Docker
docker run -d \
  --name flowable \
  -p 8080:8080 \
  -e DATABASE_TYPE=h2 \
  flowable/flowable-rest:latest

# Update your .env file
FLOWABLE_URL=http://localhost:8080/flowable-rest
FLOWABLE_USERNAME=admin  
FLOWABLE_PASSWORD=test
```

### Option 3: Flowable Docker Compose

Create a `docker-compose.flowable.yml` file:

```yaml
version: '3.8'
services:
  flowable:
    image: flowable/flowable-rest:latest
    ports:
      - "8080:8080"
    environment:
      - DATABASE_TYPE=h2
      - FLOWABLE_ADMIN_PASSWORD=test
    volumes:
      - flowable_data:/opt/flowable/data

volumes:
  flowable_data:
```

Start with:
```bash
docker-compose -f docker-compose.flowable.yml up -d
```

## Process Definitions

To use work queues effectively, you'll need to deploy BPMN process definitions to Flowable. Here's a sample process:

### Sample BPMN Process (Alert Investigation)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
             targetNamespace="http://tazama.io/processes">
  
  <process id="alertInvestigation" name="Alert Investigation Process">
    
    <startEvent id="start" />
    
    <userTask id="triageTask" name="Triage Alert">
      <candidateGroups>Triage</candidateGroups>
    </userTask>
    
    <userTask id="investigateTask" name="Investigate Alert">
      <candidateGroups>Investigations</candidateGroups>
    </userTask>
    
    <userTask id="supervisorReview" name="Supervisor Review">
      <candidateGroups>Supervisors</candidateGroups>
    </userTask>
    
    <endEvent id="end" />
    
    <!-- Sequence flows -->
    <sequenceFlow id="flow1" sourceRef="start" targetRef="triageTask" />
    <sequenceFlow id="flow2" sourceRef="triageTask" targetRef="investigateTask" />
    <sequenceFlow id="flow3" sourceRef="investigateTask" targetRef="supervisorReview" />
    <sequenceFlow id="flow4" sourceRef="supervisorReview" targetRef="end" />
    
  </process>
</definitions>
```

### Deploy Process Definition

```bash
# Upload to Flowable
curl -X POST \
  -u "rest-admin:test" \
  -F "deployment=@alert-investigation.bpmn20.xml" \
  "http://10.10.80.30:8081/flowable-rest/service/repository/deployments"
```

## Troubleshooting

### Common Issues

#### 1. Connection Timeout
**Symptoms:** Tasks don't load, health check fails
**Solution:**
- Verify Flowable server is running
- Check network connectivity
- Confirm URL and credentials in `.env`
- Check firewall settings

#### 2. Authentication Errors
**Symptoms:** 401 Unauthorized responses
**Solution:**
- Verify `FLOWABLE_USERNAME` and `FLOWABLE_PASSWORD`
- Check if credentials are correct in Flowable
- Ensure user has appropriate permissions

#### 3. No Tasks Returned
**Symptoms:** Empty task lists
**Solution:**
- Deploy process definitions with candidate groups
- Start process instances to create tasks
- Verify candidate group names match your configuration

#### 4. CORS Issues (Frontend)
**Symptoms:** Browser blocks requests
**Solution:**
- Configure CORS in Flowable
- Use proxy configuration in frontend
- Ensure proper headers are set

### Debug Mode

Enable detailed logging by setting:

```bash
LOG_LEVEL=debug
```

This will show:
- Flowable API requests and responses
- Fallback mechanism activation
- Mock data generation
- Error details

### Monitoring

Monitor these aspects:
- Flowable connectivity status
- Task processing times
- Error rates
- Fallback usage frequency

## Production Considerations

### Security
- Use strong passwords for Flowable
- Configure HTTPS for production
- Implement proper authentication
- Set up network security (VPN, firewall)

### Performance
- Monitor Flowable server resources
- Configure connection pooling
- Set appropriate timeouts
- Implement caching for frequently accessed data

### High Availability
- Set up Flowable clustering
- Configure database replication
- Implement health checks
- Set up monitoring and alerting

## Example Frontend Usage

Once connected, your frontend will automatically detect the connection status:

```typescript
// The service automatically handles fallback
const tasks = await flowableWorkQueueService.getWorkQueueByGroup('Investigations');

// Will return either:
// - Real tasks from Flowable (when connected)
// - Mock tasks (when Flowable unavailable)
```

## API Examples

### Get Tasks for Investigations Queue
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     "http://localhost:3000/api/v1/task/work-queues/Investigations"
```

### Assign Task
```bash
curl -X POST \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"assignee": "user-123"}' \
     "http://localhost:3000/api/v1/task/task-456/assign"
```

### Complete Task
```bash
curl -X POST \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"variables": {"outcome": "approved"}}' \
     "http://localhost:3000/api/v1/task/task-456/complete"
```

## Next Steps

1. **Set up your Flowable instance** using one of the options above
2. **Deploy process definitions** that create tasks with candidate groups
3. **Start process instances** to generate tasks
4. **Test the work queue interface** in the frontend
5. **Monitor the connection** using health checks

For additional help, check the logs in both the backend application and Flowable server.