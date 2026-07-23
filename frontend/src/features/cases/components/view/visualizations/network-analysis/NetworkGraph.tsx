import React from 'react';
import {
  MagnifyingGlassPlusIcon,
  MagnifyingGlassMinusIcon,
  ArrowsPointingOutIcon,
} from '@heroicons/react/24/outline';

export interface NetworkNodeData {
  id: string;
  label: string;
  sublabel?: string;
  type: 'account' | 'counterparty' | 'transaction';
  status: 'normal' | 'alert' | 'investigation' | 'flagged';
  position: { x: number; y: number };
  isCenter?: boolean;
}

export interface NetworkEdgeData {
  id: string;
  source: string;
  target: string;
  type: 'inbound' | 'outbound';
}

interface NetworkGraphProps {
  nodes: NetworkNodeData[];
  edges: NetworkEdgeData[];
  onNodeClick?: (node: NetworkNodeData) => void;
  selectedNodeId?: string;
}

const NetworkGraph: React.FC<NetworkGraphProps> = ({
  nodes,
  edges,
  onNodeClick,
  selectedNodeId,
}) => {
  const [zoom, setZoom] = React.useState(1);
  const svgRef = React.useRef<SVGSVGElement>(null);

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.2, 2));
  };
  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.2, 0.5));
  };
  const handleReset = () => {
    setZoom(1);
  };

  const getNodeColor = (node: NetworkNodeData) => {
    if (node.type === 'counterparty') {
      return {
        fill: '#818CF8', // Indigo
        stroke: '#6366F1',
        ring: 'none',
      };
    }

    switch (node.status) {
      case 'alert':
      case 'flagged':
        return {
          fill: '#FEE2E2',
          stroke: '#EF4444',
          ring: '#EF4444',
        };
      case 'investigation':
        return {
          fill: '#FEF3C7',
          stroke: '#F59E0B',
          ring: '#F59E0B',
        };
      default:
        return {
          fill: '#E0E7FF',
          stroke: '#6366F1',
          ring: 'none',
        };
    }
  };

  const getNodeById = (id: string) => nodes.find((n) => n.id === id);

  const renderEdge = (edge: NetworkEdgeData) => {
    const source = getNodeById(edge.source);
    const target = getNodeById(edge.target);

    if (!source || !target) return null;

    const isOutbound = edge.type === 'outbound';
    const strokeColor = isOutbound ? '#F472B6' : '#60A5FA';

    return (
      <line
        key={edge.id}
        x1={source.position.x}
        y1={source.position.y}
        x2={target.position.x}
        y2={target.position.y}
        stroke={strokeColor}
        strokeWidth={2}
        strokeDasharray="6,4"
        markerEnd={`url(#arrow-${isOutbound ? 'outbound' : 'inbound'})`}
      />
    );
  };

  const renderNode = (node: NetworkNodeData) => {
    const colors = getNodeColor(node);
    const isSelected = selectedNodeId === node.id;
    const nodeSize = node.isCenter ? 55 : 45;
    const fontSize = node.isCenter ? 12 : 11;

    return (
      <g
        key={node.id}
        transform={`translate(${node.position.x}, ${node.position.y})`}
        onClick={() => onNodeClick?.(node)}
        style={{ cursor: 'pointer' }}
      >
        {/* Selection ring */}
        {isSelected && (
          <circle
            r={nodeSize + 8}
            fill="none"
            stroke="#3B82F6"
            strokeWidth={3}
            strokeDasharray="4,2"
          />
        )}

        {/* Alert/Investigation ring */}
        {colors.ring !== 'none' && (
          <circle
            r={nodeSize + 4}
            fill="none"
            stroke={colors.ring}
            strokeWidth={3}
          />
        )}

        {/* Main circle */}
        <circle
          r={nodeSize}
          fill={colors.fill}
          stroke={colors.stroke}
          strokeWidth={2}
        />

        {/* Icon for counterparty */}
        {node.type === 'counterparty' && (
          <g transform="translate(-12, -20)">
            <rect
              x={4}
              y={4}
              width={16}
              height={16}
              rx={2}
              fill="white"
              opacity={0.9}
            />
            <path
              d="M8 8h8M8 12h8M8 16h8"
              stroke="#6366F1"
              strokeWidth={1.5}
              strokeLinecap="round"
            />
          </g>
        )}

        {/* Warning icon for investigation */}
        {node.status === 'investigation' && node.type !== 'counterparty' && (
          <g transform="translate(-8, 15)">
            <circle r={10} fill="#F59E0B" cx={8} cy={0} />
            <text
              x={8}
              y={4}
              textAnchor="middle"
              fill="white"
              fontSize={14}
              fontWeight="bold"
            >
              !
            </text>
          </g>
        )}

        {/* Alert dot */}
        {(node.status === 'alert' || node.status === 'flagged') &&
          node.type !== 'counterparty' && (
            <circle
              r={8}
              fill="#EF4444"
              cx={nodeSize - 10}
              cy={-nodeSize + 15}
            />
          )}

        {/* Node ID */}
        <text
          y={-5}
          textAnchor="middle"
          fill="#1F2937"
          fontSize={fontSize}
          fontWeight="bold"
        >
          {node.id}
        </text>

        {/* Node Label */}
        <text y={10} textAnchor="middle" fill="#6B7280" fontSize={fontSize - 2}>
          {node.label.length > 12
            ? `${node.label.slice(0, 12)}...`
            : node.label}
        </text>

        {/* Sublabel */}
        {node.sublabel && (
          <text
            y={23}
            textAnchor="middle"
            fill="#9CA3AF"
            fontSize={fontSize - 3}
          >
            {node.sublabel}
          </text>
        )}
      </g>
    );
  };

  return (
    <div className="relative h-full min-h-[400px] w-full rounded-lg bg-gray-50">
      {/* Zoom Controls */}
      <div className="absolute right-3 top-3 z-10 flex flex-col gap-2">
        <button
          onClick={handleZoomIn}
          className="rounded-lg border border-gray-300 bg-white p-2 shadow-sm hover:bg-gray-50"
          aria-label="Zoom in"
        >
          <MagnifyingGlassPlusIcon className="h-5 w-5 text-gray-600" />
        </button>
        <button
          onClick={handleZoomOut}
          className="rounded-lg border border-gray-300 bg-white p-2 shadow-sm hover:bg-gray-50"
          aria-label="Zoom out"
        >
          <MagnifyingGlassMinusIcon className="h-5 w-5 text-gray-600" />
        </button>
        <button
          onClick={handleReset}
          className="rounded-lg border border-gray-300 bg-white p-2 shadow-sm hover:bg-gray-50"
          aria-label="Reset view"
        >
          <ArrowsPointingOutIcon className="h-5 w-5 text-gray-600" />
        </button>
      </div>

      {/* SVG Graph */}
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox="0 0 600 500"
        preserveAspectRatio="xMidYMid meet"
        style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
      >
        {/* Arrow markers */}
        <defs>
          <marker
            id="arrow-outbound"
            markerWidth="10"
            markerHeight="10"
            refX="8"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L0,6 L9,3 z" fill="#F472B6" />
          </marker>
          <marker
            id="arrow-inbound"
            markerWidth="10"
            markerHeight="10"
            refX="8"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L0,6 L9,3 z" fill="#60A5FA" />
          </marker>
        </defs>

        {/* Render edges first (behind nodes) */}
        <g className="edges">{edges.map(renderEdge)}</g>

        {/* Render nodes */}
        <g className="nodes">{nodes.map(renderNode)}</g>
      </svg>
    </div>
  );
};

export default NetworkGraph;
