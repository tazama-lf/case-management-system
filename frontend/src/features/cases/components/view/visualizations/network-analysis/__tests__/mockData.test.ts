import { describe, it, expect } from 'vitest';
import {
  generateTransactionNetworkNodes,
  generateTransactionNetworkEdges,
  generateAccountNetworkNodes,
  generateAccountNetworkEdges,
  generateCounterpartyNetworkNodes,
  generateCounterpartyNetworkEdges,
} from '../mockData';

describe('mockData', () => {
  describe('generateTransactionNetworkNodes', () => {
    it('should return an array of nodes', () => {
      const nodes = generateTransactionNetworkNodes();
      expect(Array.isArray(nodes)).toBe(true);
      expect(nodes.length).toBeGreaterThan(0);
    });

    it('should accept an optional accountId parameter', () => {
      const nodes = generateTransactionNetworkNodes('ACC-999');
      expect(Array.isArray(nodes)).toBe(true);
    });

    it('should have a center node', () => {
      const nodes = generateTransactionNetworkNodes();
      const center = nodes.find((n) => n.isCenter);
      expect(center).toBeDefined();
      expect(center?.type).toBe('account');
    });

    it('should have nodes with required properties', () => {
      const nodes = generateTransactionNetworkNodes();
      nodes.forEach((node) => {
        expect(node.id).toBeDefined();
        expect(node.label).toBeDefined();
        expect(node.type).toBeDefined();
        expect(node.status).toBeDefined();
        expect(node.position).toBeDefined();
        expect(node.position.x).toEqual(expect.any(Number));
        expect(node.position.y).toEqual(expect.any(Number));
      });
    });

    it('should have nodes with valid status values', () => {
      const nodes = generateTransactionNetworkNodes();
      const validStatuses = ['normal', 'alert', 'investigation'];
      nodes.forEach((node) => {
        expect(validStatuses).toContain(node.status);
      });
    });
  });

  describe('generateTransactionNetworkEdges', () => {
    it('should return an array of edges', () => {
      const edges = generateTransactionNetworkEdges();
      expect(Array.isArray(edges)).toBe(true);
      expect(edges.length).toBeGreaterThan(0);
    });

    it('should have edges with required properties', () => {
      const edges = generateTransactionNetworkEdges();
      edges.forEach((edge) => {
        expect(edge.id).toBeDefined();
        expect(edge.source).toBeDefined();
        expect(edge.target).toBeDefined();
        expect(edge.type).toBeDefined();
      });
    });

    it('should have edges with valid type values', () => {
      const edges = generateTransactionNetworkEdges();
      const validTypes = ['inbound', 'outbound'];
      edges.forEach((edge) => {
        expect(validTypes).toContain(edge.type);
      });
    });

    it('should reference valid node IDs', () => {
      const nodes = generateTransactionNetworkNodes();
      const edges = generateTransactionNetworkEdges();
      const nodeIds = new Set(nodes.map((n) => n.id));

      edges.forEach((edge) => {
        expect(nodeIds.has(edge.source)).toBe(true);
        expect(nodeIds.has(edge.target)).toBe(true);
      });
    });
  });

  describe('generateAccountNetworkNodes', () => {
    it('should return an array of nodes', () => {
      const nodes = generateAccountNetworkNodes();
      expect(Array.isArray(nodes)).toBe(true);
      expect(nodes.length).toBeGreaterThan(0);
    });

    it('should accept an optional counterpartyId parameter', () => {
      const nodes = generateAccountNetworkNodes('CP-999');
      expect(Array.isArray(nodes)).toBe(true);
    });

    it('should have a center node of type counterparty', () => {
      const nodes = generateAccountNetworkNodes();
      const center = nodes.find((n) => n.isCenter);
      expect(center).toBeDefined();
      expect(center?.type).toBe('counterparty');
    });

    it('should have nodes with sublabels', () => {
      const nodes = generateAccountNetworkNodes();
      nodes.forEach((node) => {
        expect(node.sublabel).toBeDefined();
      });
    });
  });

  describe('generateAccountNetworkEdges', () => {
    it('should return an array of edges', () => {
      const edges = generateAccountNetworkEdges();
      expect(Array.isArray(edges)).toBe(true);
      expect(edges.length).toBeGreaterThan(0);
    });

    it('should reference valid node IDs', () => {
      const nodes = generateAccountNetworkNodes();
      const edges = generateAccountNetworkEdges();
      const nodeIds = new Set(nodes.map((n) => n.id));

      edges.forEach((edge) => {
        expect(nodeIds.has(edge.source)).toBe(true);
        expect(nodeIds.has(edge.target)).toBe(true);
      });
    });
  });

  describe('generateCounterpartyNetworkNodes', () => {
    it('should return an array of nodes', () => {
      const nodes = generateCounterpartyNetworkNodes();
      expect(Array.isArray(nodes)).toBe(true);
      expect(nodes.length).toBeGreaterThan(0);
    });

    it('should accept an optional transactionId parameter', () => {
      const nodes = generateCounterpartyNetworkNodes('TXN-999');
      expect(Array.isArray(nodes)).toBe(true);
    });

    it('should have a center node', () => {
      const nodes = generateCounterpartyNetworkNodes();
      const center = nodes.find((n) => n.isCenter);
      expect(center).toBeDefined();
      expect(center?.type).toBe('counterparty');
    });

    it('should have all nodes of type counterparty', () => {
      const nodes = generateCounterpartyNetworkNodes();
      nodes.forEach((node) => {
        expect(node.type).toBe('counterparty');
      });
    });

    it('should have nodes with sublabels', () => {
      const nodes = generateCounterpartyNetworkNodes();
      nodes.forEach((node) => {
        expect(node.sublabel).toBeDefined();
      });
    });
  });

  describe('generateCounterpartyNetworkEdges', () => {
    it('should return an array of edges', () => {
      const edges = generateCounterpartyNetworkEdges();
      expect(Array.isArray(edges)).toBe(true);
      expect(edges.length).toBeGreaterThan(0);
    });

    it('should reference valid node IDs', () => {
      const nodes = generateCounterpartyNetworkNodes();
      const edges = generateCounterpartyNetworkEdges();
      const nodeIds = new Set(nodes.map((n) => n.id));

      edges.forEach((edge) => {
        expect(nodeIds.has(edge.source)).toBe(true);
        expect(nodeIds.has(edge.target)).toBe(true);
      });
    });

    it('should have edges with valid type values', () => {
      const edges = generateCounterpartyNetworkEdges();
      const validTypes = ['inbound', 'outbound'];
      edges.forEach((edge) => {
        expect(validTypes).toContain(edge.type);
      });
    });
  });
});
