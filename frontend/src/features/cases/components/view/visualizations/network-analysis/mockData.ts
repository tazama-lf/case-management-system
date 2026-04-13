// Mock data generators for network visualization
import type { NetworkNodeData, NetworkEdgeData } from './NetworkGraph';

/**
 * Mock data generators for network analysis
 * These will be replaced with actual JupyterLab API calls
 */

// Transaction Network Mock Data - matches screenshot 2
export const generateTransactionNetworkNodes = (_accountId?: string): NetworkNodeData[] => [
  {
    id: 'ACC-1234',
    label: 'John Smith',
    type: 'account',
    status: 'investigation',
    position: { x: 300, y: 200 },
    isCenter: true,
  },
  {
    id: 'ACC-2468',
    label: 'Retail Store',
    type: 'account',
    status: 'normal',
    position: { x: 350, y: 80 },
  },
  {
    id: 'ACC-7890',
    label: 'Tech Solutio...',
    type: 'account',
    status: 'normal',
    position: { x: 150, y: 120 },
  },
  {
    id: 'ACC-5678',
    label: 'ABC Corp',
    type: 'account',
    status: 'alert',
    position: { x: 450, y: 180 },
  },
  {
    id: 'ACC-3456',
    label: 'Global Tradi...',
    type: 'account',
    status: 'alert',
    position: { x: 180, y: 300 },
  },
  {
    id: 'ACC-9012',
    label: 'XYZ Ltd',
    type: 'account',
    status: 'normal',
    position: { x: 380, y: 320 },
  },
];

export const generateTransactionNetworkEdges = (): NetworkEdgeData[] => [
  { id: 'e1', source: 'ACC-7890', target: 'ACC-1234', type: 'inbound' },
  { id: 'e2', source: 'ACC-1234', target: 'ACC-2468', type: 'outbound' },
  { id: 'e3', source: 'ACC-1234', target: 'ACC-5678', type: 'outbound' },
  { id: 'e4', source: 'ACC-3456', target: 'ACC-1234', type: 'inbound' },
  { id: 'e5', source: 'ACC-1234', target: 'ACC-9012', type: 'outbound' },
];

// Account Network Mock Data - matches screenshot 1
export const generateAccountNetworkNodes = (_counterpartyId?: string): NetworkNodeData[] => [
  {
    id: 'CP-5678',
    label: 'Global Trading ...',
    sublabel: 'Business',
    type: 'counterparty',
    status: 'normal',
    position: { x: 300, y: 220 },
    isCenter: true,
  },
  {
    id: 'ACC-5555',
    label: 'Trading Subs...',
    sublabel: 'Subsidiary',
    type: 'account',
    status: 'alert',
    position: { x: 380, y: 80 },
  },
  {
    id: 'ACC-4444',
    label: 'Investment F...',
    sublabel: 'Related Entity',
    type: 'account',
    status: 'alert',
    position: { x: 140, y: 130 },
  },
  {
    id: 'ACC-1111',
    label: 'John Smith',
    sublabel: 'Primary Owner',
    type: 'account',
    status: 'alert',
    position: { x: 460, y: 200 },
  },
  {
    id: 'ACC-3333',
    label: 'Global Tradi...',
    sublabel: 'Corporate Acco...',
    type: 'account',
    status: 'investigation',
    position: { x: 160, y: 300 },
  },
  {
    id: 'ACC-2222',
    label: 'Jane Doe',
    sublabel: 'Co-Owner',
    type: 'account',
    status: 'normal',
    position: { x: 380, y: 330 },
  },
];

export const generateAccountNetworkEdges = (): NetworkEdgeData[] => [
  { id: 'e1', source: 'CP-5678', target: 'ACC-5555', type: 'outbound' },
  { id: 'e2', source: 'CP-5678', target: 'ACC-4444', type: 'outbound' },
  { id: 'e3', source: 'CP-5678', target: 'ACC-1111', type: 'outbound' },
  { id: 'e4', source: 'CP-5678', target: 'ACC-3333', type: 'outbound' },
  { id: 'e5', source: 'CP-5678', target: 'ACC-2222', type: 'outbound' },
];

// Counterparty Network Mock Data
export const generateCounterpartyNetworkNodes = (_transactionId?: string): NetworkNodeData[] => [
  {
    id: 'CP-1000',
    label: 'Main Corp',
    sublabel: 'Primary',
    type: 'counterparty',
    status: 'normal',
    position: { x: 300, y: 200 },
    isCenter: true,
  },
  {
    id: 'CP-2001',
    label: 'Vendor Inc.',
    sublabel: 'Supplier',
    type: 'counterparty',
    status: 'alert',
    position: { x: 450, y: 120 },
  },
  {
    id: 'CP-2002',
    label: 'Partner LLC',
    sublabel: 'Partner',
    type: 'counterparty',
    status: 'normal',
    position: { x: 150, y: 120 },
  },
  {
    id: 'CP-2003',
    label: 'Client Corp',
    sublabel: 'Customer',
    type: 'counterparty',
    status: 'investigation',
    position: { x: 450, y: 280 },
  },
  {
    id: 'CP-2004',
    label: 'Subsidiary Co',
    sublabel: 'Related',
    type: 'counterparty',
    status: 'normal',
    position: { x: 150, y: 280 },
  },
];

export const generateCounterpartyNetworkEdges = (): NetworkEdgeData[] => [
  { id: 'e1', source: 'CP-1000', target: 'CP-2001', type: 'outbound' },
  { id: 'e2', source: 'CP-2002', target: 'CP-1000', type: 'inbound' },
  { id: 'e3', source: 'CP-1000', target: 'CP-2003', type: 'outbound' },
  { id: 'e4', source: 'CP-2004', target: 'CP-1000', type: 'inbound' },
];

