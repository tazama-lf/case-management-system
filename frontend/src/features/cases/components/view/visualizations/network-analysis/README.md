# Network Analysis Feature

## Overview

The Network Analysis feature provides investigators with powerful visualization tools to understand relationships between transactions, accounts, and counterparties. This helps uncover potential fraud networks and identify suspicious patterns.

## Architecture

### Component Structure

```
network-analysis/
├── NetworkAnalysisTab.tsx         # Main container with tab navigation
├── TransactionNetworkTab.tsx      # Transaction flow visualization
├── AccountNetworkTab.tsx          # Account network visualization
├── CounterpartyNetworkTab.tsx     # Counterparty network visualization
├── TimeSlider.tsx                 # Time range selector component
├── types.ts                       # TypeScript type definitions
├── mockData.ts                    # Mock data generators
└── index.ts                       # Export barrel
```

## Features

### 1. Transaction Network Tab

**Purpose:** Visualize upstream and downstream transaction flows around an account.

**Key Features:**
- ✅ Displays inbound and outbound transactions
- ✅ Shows transaction values, volumes, and timestamps
- ✅ Highlights flagged and suspicious transactions
- ✅ Indicates accounts under active or previous investigations
- ✅ Network statistics (nodes, connections, flagged items)

**User Story:**
> As an investigator, I want to see upstream and downstream transaction flows around an account, so that I can trace the movement of funds and detect suspicious behavior.

### 2. Account Network Tab

**Purpose:** Show all accounts associated with a counterparty.

**Key Features:**
- ✅ Displays linked accounts for a counterparty
- ✅ Shows transaction volumes and frequencies
- ✅ Indicates alert status for each account
- ✅ Shows last transaction dates
- ✅ Provides summary statistics

**User Story:**
> As an investigator, I want to see all accounts associated with a counterparty, so that I can build a complete picture of the counterparty's financial activity and detect fraudulent behavior.

### 3. Counterparty Network Tab

**Purpose:** Visualize all counterparties linked to a transaction.

**Key Features:**
- ✅ Displays counterparty network nodes
- ✅ Shows transaction values, frequency, and timestamps
- ✅ Indicates alert statuses (flagged, suspicious, clean)
- ✅ Provides risk analysis summary
- ✅ Interactive table with sorting capabilities

**User Story:**
> As an investigator, I want to visualize all counterparties linked to a transaction, so that I can identify networks of fraudulent activity.

### 4. Time Range Controls

**Purpose:** Enable time-based navigation and filtering.

**Key Features:**
- ✅ Slider for adjusting time windows
- ✅ Quick select buttons (Minutes, Hours, Days, Weeks, Months)
- ✅ Dynamic date range display
- ✅ Real-time updates to visualizations

## Data Flow

### Current Implementation (Mock Data)

```
Component → mockData.ts → Mock Network Data → Visualization
```

### Future Implementation (JupyterLab Integration)

```
Component → API Service → JupyterLab Backend → Real Network Data → Visualization
```

## Mock Data Structure

### Network Nodes
```typescript
interface NetworkNode {
  id: string;
  label: string;
  type: 'account' | 'counterparty' | 'transaction';
  value?: number;
  flagged?: boolean;
  investigationStatus?: 'active' | 'previous' | 'none';
  metadata?: Record<string, unknown>;
}
```

### Network Edges
```typescript
interface NetworkEdge {
  id: string;
  source: string;
  target: string;
  value: number;
  volume?: number;
  timestamp: string;
  alertStatus?: 'flagged' | 'suspicious' | 'clean';
  transactionType?: 'inbound' | 'outbound';
}
```

## UI/UX Highlights

### Visual Indicators

- 🔴 **Red badges/icons:** Flagged items requiring immediate attention
- 🟡 **Yellow badges/icons:** Suspicious activity
- 🟢 **Green badges/icons:** Clean/verified items
- 🔵 **Blue badges:** Active investigations
- 🟣 **Purple badges:** Previous investigations

### Accessibility

- ✅ Keyboard navigation support
- ✅ ARIA labels for screen readers
- ✅ Semantic HTML structure
- ✅ Color-blind friendly indicators (icons + colors)

## Integration Points

### Current Location

The Network Analysis tab is accessible from:
```
Task Details Modal → Visualizations Tab → Network Analysis
```

### Props Interface

```typescript
interface NetworkAnalysisTabProps {
  caseId?: string;         // The case being investigated
  transactionId?: string;  // Specific transaction to analyze
}
```

## JupyterLab Integration Plan

### Phase 1: API Service Layer (To Be Implemented)

Create service files to handle JupyterLab communication:

```typescript
// networkAnalysisService.ts
export const fetchTransactionNetwork = async (
  caseId: string,
  timeConfig: TimeSliderConfig
): Promise<NetworkData> => {
  // Call JupyterLab API endpoint
  const response = await apiClient.post('/jupyter/network/transaction', {
    caseId,
    startDate: timeConfig.startDate,
    endDate: timeConfig.endDate,
  });
  return response.data;
};
```

### Phase 2: Replace Mock Data

Update components to use real API calls:

```typescript
// Before (Mock)
const networkData = React.useMemo(
  () => generateMockTransactionNetwork(caseId),
  [caseId]
);

// After (Real)
const { data: networkData, isLoading } = useQuery({
  queryKey: ['transaction-network', caseId, timeConfig],
  queryFn: () => fetchTransactionNetwork(caseId!, timeConfig),
  enabled: !!caseId,
});
```

### Phase 3: Embed Visualizations

Options for embedding JupyterLab visualizations:

1. **iframe Approach:**
   ```tsx
   <iframe
     src={jupyterLabUrl}
     className="w-full h-96 border-0"
     title="Network Visualization"
   />
   ```

2. **Image/SVG Export:**
   ```tsx
   <img
     src={networkVisualizationUrl}
     alt="Network graph"
     className="w-full h-auto"
   />
   ```

3. **Data-Driven React Component:**
   - Fetch raw data from JupyterLab
   - Render using React libraries (D3.js, Recharts, etc.)

## Testing

### Current Status
- ✅ Components render without errors
- ✅ TypeScript types are properly defined
- ✅ Mock data generators work correctly
- ⏳ Unit tests (to be added)
- ⏳ Integration tests (to be added)

### Recommended Tests

```typescript
// TransactionNetworkTab.test.tsx
describe('TransactionNetworkTab', () => {
  it('renders network statistics correctly');
  it('highlights flagged transactions');
  it('displays investigation badges');
  it('updates when time range changes');
  it('shows JupyterLab integration notice');
});
```

## Performance Considerations

### Optimizations Implemented

- ✅ `React.useMemo` for expensive computations
- ✅ Component-level code splitting (already lazy-loaded in parent)
- ✅ Efficient data structures

### Future Optimizations

- Virtualization for large node/edge lists
- Debounced time slider updates
- Progressive loading for large networks
- Graph data caching

## Browser Compatibility

- ✅ Chrome/Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14+

## Known Limitations

1. **No Real Data:** Currently using mock data generators
2. **No Graph Library:** Placeholder for actual network visualization
3. **No Export:** Cannot export network graphs yet
4. **Static Time Ranges:** Predefined ranges only (customizable in future)

## Next Steps

### Immediate (Backend Team)
1. Create JupyterLab API endpoints for network data
2. Define API contracts and response formats
3. Implement authentication/authorization

### Short-term (Frontend Team)
1. Integrate real API calls
2. Add graph visualization library (e.g., D3.js, Cytoscape.js)
3. Implement export functionality (PNG, PDF, CSV)
4. Add unit and integration tests

### Long-term
1. Real-time network updates via WebSocket
2. Advanced filtering and search
3. Custom time range picker
4. Network comparison tools
5. ML-powered anomaly highlighting

## Screenshots

### Transaction Network
Shows inbound/outbound flows with alert indicators and investigation status badges.

### Account Network
Table view of linked accounts with volume, frequency, and status metrics.

### Counterparty Network
Comprehensive table with risk analysis and summary statistics.

## Support

For questions or issues:
- Frontend Lead: [Contact]
- Backend Lead: [Contact]
- Documentation: [Link to wiki/confluence]

---

**Last Updated:** December 23, 2025  
**Version:** 1.0.0  
**Status:** ✅ Ready for JupyterLab Integration
