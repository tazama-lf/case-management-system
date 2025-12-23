# Network Analysis - Quick Start Guide

## For Investigators (End Users)

### Accessing Network Analysis

1. Navigate to a case in the Cases Dashboard
2. Click on a task to open Task Details Modal
3. Select the **"Visualizations"** tab
4. Click on **"Network Analysis"** sub-tab

### Using the Feature

#### Transaction Network Tab
- View upstream (inbound) and downstream (outbound) transaction flows
- Red badges indicate flagged transactions
- Blue badges show active investigations
- Use the time slider to adjust the viewing period

#### Account Network Tab
- See all accounts linked to a counterparty
- Review transaction volumes and frequencies
- Identify flagged accounts at a glance
- Check last transaction dates

#### Counterparty Network Tab
- View all counterparties connected to a transaction
- Sort by transaction value, frequency, or status
- Review the risk analysis summary
- Identify patterns across multiple counterparties

### Time Range Controls

**Quick Select Buttons:**
- **Minutes:** Last 60 minutes
- **Hours:** Last 24 hours
- **Days:** Last 30 days
- **Weeks:** Last 90 days
- **Months:** Last 12 months

**Slider:**
- Drag the slider to fine-tune the time window
- Shows percentage of selected time range

---

## For Developers

### Adding Network Analysis to a New Context

```typescript
import NetworkAnalysisTab from '@/features/cases/components/view/visualizations/NetworkAnalysisTab';

// In your component
<NetworkAnalysisTab 
  caseId="CASE-123" 
  transactionId="TXN-456" 
/>
```

### Accessing Individual Sub-Tabs

```typescript
import {
  TransactionNetworkTab,
  AccountNetworkTab,
  CounterpartyNetworkTab
} from '@/features/cases/components/view/visualizations/network-analysis';

// Use individually
<TransactionNetworkTab caseId={caseId} transactionId={transactionId} />
```

### Using the Time Slider Component

```typescript
import { TimeSlider } from '@/features/cases/components/view/visualizations/network-analysis';
import type { TimeSliderConfig } from '@/features/cases/components/view/visualizations/network-analysis';

function MyComponent() {
  const [timeConfig, setTimeConfig] = useState<TimeSliderConfig>({
    range: 'days',
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    endDate: new Date(),
  });

  return <TimeSlider config={timeConfig} onChange={setTimeConfig} />;
}
```

### Working with Mock Data

```typescript
import {
  generateMockTransactionNetwork,
  generateMockAccountNetwork,
  generateMockCounterpartyNetwork
} from '@/features/cases/components/view/visualizations/network-analysis';

// Generate mock data
const transactionNetwork = generateMockTransactionNetwork('ACC-123');
const accountNetwork = generateMockAccountNetwork('CP-456');
const counterpartyNetwork = generateMockCounterpartyNetwork('TXN-789');
```

### Type Definitions

```typescript
import type {
  NetworkNode,
  NetworkEdge,
  NetworkData,
  TransactionFlow,
  AccountNetworkData,
  CounterpartyNetworkData,
  TimeRange,
  TimeSliderConfig
} from '@/features/cases/components/view/visualizations/network-analysis';
```

### Styling Customization

All components use Tailwind CSS classes. To customize:

1. **Colors:** Modify the `getStatusColor()` functions in each tab
2. **Layout:** Adjust grid classes (e.g., `sm:grid-cols-2`)
3. **Spacing:** Update `space-y-*` and `gap-*` values

### Adding New Features

#### 1. Add a New Alert Status

```typescript
// In types.ts
alertStatus?: 'flagged' | 'suspicious' | 'clean' | 'verified';

// In component
const getStatusColor = (status?: string) => {
  switch (status) {
    case 'verified':
      return 'text-blue-600 bg-blue-50 border-blue-200';
    // ... existing cases
  }
};
```

#### 2. Add Export Functionality

```typescript
const exportNetwork = () => {
  const data = JSON.stringify(networkData, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `network-${Date.now()}.json`;
  a.click();
};
```

#### 3. Add Filtering

```typescript
const [filter, setFilter] = useState('all');

const filteredEdges = networkData.edges.filter(edge => {
  if (filter === 'all') return true;
  return edge.alertStatus === filter;
});
```

### Performance Tips

1. **Use React.useMemo** for expensive calculations
2. **Debounce time slider** updates
3. **Virtualize large lists** with react-window
4. **Lazy load** network graphs only when tab is active

### Testing

```typescript
// Example test
import { render, screen } from '@testing-library/react';
import TransactionNetworkTab from './TransactionNetworkTab';

test('renders transaction network statistics', () => {
  render(<TransactionNetworkTab caseId="TEST-123" />);
  
  expect(screen.getByText(/Total Nodes/i)).toBeInTheDocument();
  expect(screen.getByText(/Connections/i)).toBeInTheDocument();
});
```

### Troubleshooting

**Issue:** Network visualization not showing
- Check that `caseId` or `transactionId` is provided
- Verify mock data generators are working
- Check browser console for errors

**Issue:** Time slider not updating visualization
- Ensure `onChange` handler is properly connected
- Check that components are using the `timeConfig` prop
- Verify state updates are triggering re-renders

**Issue:** Icons not displaying
- Ensure `@heroicons/react` is installed
- Check import paths are correct
- Verify Tailwind CSS is processing the classes

---

## Integration Checklist

### Before JupyterLab Integration

- [x] Components render correctly
- [x] Mock data displays properly
- [x] Time slider functions as expected
- [x] All tabs are accessible
- [x] No TypeScript errors
- [x] No linting errors

### For JupyterLab Integration

- [ ] Create API service layer
- [ ] Define endpoint contracts
- [ ] Replace mock data with API calls
- [ ] Add loading states
- [ ] Add error handling
- [ ] Implement data caching
- [ ] Add refresh functionality
- [ ] Write integration tests

### Post-Integration

- [ ] Performance testing with real data
- [ ] User acceptance testing
- [ ] Documentation updates
- [ ] Training materials
- [ ] Monitoring and analytics
- [ ] Feedback collection

---

## Support & Resources

- **Documentation:** See [README.md](./README.md) for detailed information
- **Type Definitions:** [types.ts](./types.ts)
- **Mock Data Examples:** [mockData.ts](./mockData.ts)
- **Component Source:** Check individual tab files

## Changelog

### Version 1.0.0 (2025-12-23)
- ✅ Initial implementation
- ✅ Three network analysis tabs
- ✅ Time range controls
- ✅ Mock data generators
- ✅ Comprehensive type definitions
- ✅ Ready for JupyterLab integration
