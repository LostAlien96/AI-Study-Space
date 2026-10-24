import React, { useRef, useState, useCallback, useEffect } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { Network, ZoomIn, ZoomOut, Crosshair, Layers, Share2 } from 'lucide-react';
import { useWorkspaceStore } from '../stores/workspaceStore';

export default function TopologyView() {
  const { conceptTopology } = useWorkspaceStore();
  const graphCanvasRef = useRef(null);
  const containerWrapperRef = useRef(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });

  const safeTopology = {
    nodes: conceptTopology?.nodes || [],
    links: conceptTopology?.links || [],
  };

  useEffect(() => {
    if (graphCanvasRef.current && safeTopology.nodes.length > 0) {
      graphCanvasRef.current.d3ReheatSimulation();
    }
  }, [safeTopology.nodes.length, safeTopology.links.length]);

  useEffect(() => {
    const recalculateDimensions = () => {
      if (containerWrapperRef.current) {
        setViewportSize({
          width: containerWrapperRef.current.clientWidth,
          height: containerWrapperRef.current.clientHeight,
        });
      }
    };

    recalculateDimensions();
    window.addEventListener('resize', recalculateDimensions);
    const timeout = setTimeout(recalculateDimensions, 100);
    return () => {
      window.removeEventListener('resize', recalculateDimensions);
      clearTimeout(timeout);
    };
  }, []);

  const renderCustomNode = useCallback((node, ctx, globalScale) => {
    const textLabel = node.name || node.id;
    const fontHeight = Math.max(12 / globalScale, 2.5);
    const nodeColor = node.color || '#06B6D4';

    ctx.shadowColor = nodeColor;
    ctx.shadowBlur = 12 / globalScale;

    ctx.beginPath();
    ctx.arc(node.x, node.y, 6, 0, 2 * Math.PI, false);
    ctx.fillStyle = '#030712';
    ctx.fill();

    ctx.lineWidth = 2 / globalScale;
    ctx.strokeStyle = nodeColor;
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.font = `600 ${fontHeight}px 'Plus Jakarta Sans', system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#F8FAFC';
    ctx.fillText(textLabel, node.x, node.y + 9);
  }, []);

  const triggerZoomIn = () => graphCanvasRef.current?.zoom(graphCanvasRef.current.zoom() * 1.3, 300);
  const triggerZoomOut = () => graphCanvasRef.current?.zoom(graphCanvasRef.current.zoom() * 0.7, 300);
  const triggerFitCamera = () => graphCanvasRef.current?.zoomToFit(300, 40);

  return (
    <div className="flex-1 w-full h-full relative overflow-hidden bg-surface-950" ref={containerWrapperRef}>
      {/* Stat Header Badge */}
      <div className="absolute top-4 left-4 z-10 p-3 bg-surface-900/80 backdrop-blur-xl border border-surface-800 rounded-2xl shadow-xl pointer-events-auto">
        <div className="flex items-center gap-2">
          <Network className="w-4 h-4 text-cyan-400" />
          <h2 className="text-xs font-bold text-slate-100">Knowledge Topology</h2>
        </div>
        <div className="flex items-center gap-3 mt-1.5 text-[10px] font-mono text-slate-400">
          <span className="flex items-center gap-1">
            <Layers className="w-3 h-3 text-cyan-500" /> {safeTopology.nodes.length} Concepts
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Share2 className="w-3 h-3 text-indigo-400" /> {safeTopology.links.length} Relations
          </span>
        </div>
      </div>

      {/* Floating Control Box */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-1 p-1 bg-surface-900/80 backdrop-blur-xl border border-surface-800 rounded-xl shadow-xl">
        <button
          onClick={triggerZoomIn}
          className="p-2 text-slate-400 hover:text-white hover:bg-surface-800 rounded-lg transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={triggerZoomOut}
          className="p-2 text-slate-400 hover:text-white hover:bg-surface-800 rounded-lg transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={triggerFitCamera}
          className="p-2 text-slate-400 hover:text-white hover:bg-surface-800 rounded-lg transition-colors"
          title="Reset View"
        >
          <Crosshair className="w-4 h-4" />
        </button>
      </div>

      {viewportSize.width > 0 && viewportSize.height > 0 && (
        <ForceGraph2D
          ref={graphCanvasRef}
          width={viewportSize.width}
          height={viewportSize.height}
          graphData={safeTopology}
          nodeCanvasObject={renderCustomNode}
          nodeRelSize={6}
          linkColor={() => '#1F2937'}
          linkWidth={1.5}
          linkDirectionalParticles={2}
          linkDirectionalParticleWidth={2}
          linkDirectionalParticleColor={() => '#06B6D4'}
          backgroundColor="transparent"
          d3AlphaDecay={0.02}
          d3VelocityDecay={0.2}
        />
      )}

      {safeTopology.nodes.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center pointer-events-none">
          <div className="w-16 h-16 rounded-3xl bg-surface-900 border border-surface-800 flex items-center justify-center text-slate-600 mb-3">
            <Network className="w-8 h-8" />
          </div>
          <h3 className="text-sm font-bold text-slate-300">Topology Standby</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-xs">
            Concept networks will automatically populate as conversations occur in the Dialogue Space.
          </p>
        </div>
      )}
    </div>
  );
}
