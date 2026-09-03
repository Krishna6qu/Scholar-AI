import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  Share2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Download,
  Search,
  ChevronRight,
  Layers,
  Brain,
  MessageSquare,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Compass,
  GitFork,
  Radio,
  CheckCircle2,
} from "lucide-react";
import { toCanvas } from "html-to-image";
import { api } from "@/lib/api";

interface RawTreeNode {
  name: string;
  description?: string;
  children?: RawTreeNode[];
}

interface MindMap {
  id: string;
  title: string;
  json_structure: RawTreeNode;
  viewed_at: string | null;
}

interface FlatNode {
  id: string;
  parentId: string | null;
  name: string;
  description: string;
  depth: number;
  childCount: number;
  childrenIds: string[];
  ancestorIds: string[];
  rawNode: RawTreeNode;
}

interface PositionedNode {
  node: FlatNode;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Edge {
  id: string;
  fromId: string;
  toId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

type LayoutMode = "flow" | "orbital";

export default function MindMapViewPage() {
  const { mapId } = useParams<{ mapId: string }>();
  const navigate = useNavigate();

  const [map, setMap] = useState<MindMap | null>(null);
  const [selectedId, setSelectedId] = useState<string>("0");
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("flow");
  const [searchQuery, setSearchQuery] = useState("");
  const [showInspector, setShowInspector] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Pan & Zoom state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 80, y: 150 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasCaptureRef = useRef<HTMLDivElement>(null);

  // Fetch mind map
  useEffect(() => {
    if (!mapId) return;
    api.get(`/mindmaps/${mapId}`).then(({ data }) => {
      setMap(data);
      if (!data.viewed_at) {
        api.post(`/mindmaps/${mapId}/complete`).then(({ data: updated }) => {
          setMap((prev) => (prev ? { ...prev, viewed_at: updated.viewed_at } : prev));
        }).catch((err) => console.error("Failed to mark mind map viewed:", err));
      }
    });
  }, [mapId]);

  // Flatten and index tree nodes with deterministic path IDs
  const { flatMap, rootId } = useMemo(() => {
    if (!map?.json_structure) return { flatMap: new Map<string, FlatNode>(), rootId: "0" };

    const mapDict = new Map<string, FlatNode>();

    function traverse(raw: RawTreeNode, id: string, parentId: string | null, depth: number, ancestors: string[]) {
      const childIds: string[] = [];
      const currentAncestors = [...ancestors, id];

      if (raw.children && raw.children.length > 0) {
        raw.children.forEach((c, i) => {
          const childId = `${id}.${i}`;
          childIds.push(childId);
          traverse(c, childId, id, depth + 1, currentAncestors);
        });
      }

      mapDict.set(id, {
        id,
        parentId,
        name: raw.name || "Untitled Concept",
        description: raw.description || "No description provided for this concept.",
        depth,
        childCount: childIds.length,
        childrenIds: childIds,
        ancestorIds: ancestors,
        rawNode: raw,
      });
    }

    traverse(map.json_structure, "0", null, 0, []);
    return { flatMap: mapDict, rootId: "0" };
  }, [map]);

  // Determine which nodes are currently visible based on collapsed parents
  const visibleNodeIds = useMemo(() => {
    const visible = new Set<string>();
    if (!flatMap.has(rootId)) return visible;

    function reveal(id: string) {
      visible.add(id);
      if (collapsedIds.has(id)) return;
      const node = flatMap.get(id);
      if (node) {
        node.childrenIds.forEach(reveal);
      }
    }

    reveal(rootId);
    return visible;
  }, [flatMap, rootId, collapsedIds]);

  // Calculate layout coordinates
  const { positions, edges, bounds } = useMemo(() => {
    const positionsList: PositionedNode[] = [];
    const edgesList: Edge[] = [];

    if (!map || !flatMap.has(rootId)) {
      return { positions: [], edges: [], bounds: { minX: 0, maxX: 1000, minY: 0, maxY: 600 } };
    }

    function getNodeDims(depth: number) {
      if (depth === 0) return { width: 290, height: 86 };
      if (depth === 1) return { width: 250, height: 78 };
      if (depth === 2) return { width: 230, height: 72 };
      return { width: 210, height: 66 };
    }

    if (layoutMode === "flow") {
      // Neural Flow (Horizontal Left-to-Right Tree)
      const X_GAP = 340;
      const Y_GAP = 30;

      function getVisibleLeafCount(id: string): number {
        if (collapsedIds.has(id)) return 1;
        const n = flatMap.get(id);
        if (!n || n.childrenIds.length === 0) return 1;
        return n.childrenIds.reduce((acc, cId) => acc + getVisibleLeafCount(cId), 0);
      }

      function placeFlowNode(id: string, depth: number, yTop: number, yBottom: number): { x: number; y: number } {
        const n = flatMap.get(id)!;
        const dims = getNodeDims(depth);
        const x = depth * X_GAP + 80;
        const totalLeaves = getVisibleLeafCount(id);

        if (collapsedIds.has(id) || n.childrenIds.length === 0) {
          const y = (yTop + yBottom) / 2;
          positionsList.push({ node: n, x, y, width: dims.width, height: dims.height });
          return { x, y };
        }

        let currentY = yTop;
        const childCoords: { x: number; y: number; childId: string }[] = [];

        for (const childId of n.childrenIds) {
          const leaves = getVisibleLeafCount(childId);
          const span = (yBottom - yTop) * (leaves / totalLeaves);
          const coords = placeFlowNode(childId, depth + 1, currentY, currentY + span);
          childCoords.push({ ...coords, childId });
          currentY += span;
        }

        const y = (childCoords[0].y + childCoords[childCoords.length - 1].y) / 2;
        positionsList.push({ node: n, x, y, width: dims.width, height: dims.height });

        for (const cc of childCoords) {
          const childDims = getNodeDims(depth + 1);
          edgesList.push({
            id: `${id}->${cc.childId}`,
            fromId: id,
            toId: cc.childId,
            x1: x + dims.width / 2,
            y1: y,
            x2: cc.x - childDims.width / 2,
            y2: cc.y,
          });
        }

        return { x, y };
      }

      const totalLeaves = Math.max(getVisibleLeafCount(rootId), 1);
      const totalHeight = Math.max(totalLeaves * (82 + Y_GAP), 520);
      placeFlowNode(rootId, 0, 50, totalHeight + 50);

    } else {
      // Orbital Galaxy Layout (Deep Multi-tier Radial Orbits)
      const centerX = 850;
      const centerY = 650;

      function placeOrbitalNode(
        id: string,
        depth: number,
        parentX: number,
        parentY: number,
        baseAngle: number,
        spreadAngle: number
      ) {
        const n = flatMap.get(id);
        if (!n) return;
        const dims = getNodeDims(depth);
        positionsList.push({ node: n, x: parentX, y: parentY, width: dims.width, height: dims.height });

        if (collapsedIds.has(id) || n.childrenIds.length === 0) return;

        const childCount = n.childrenIds.length;
        const dist = depth === 0 ? 360 : Math.max(260 - depth * 35, 170);
        const spread = depth === 0 ? 2 * Math.PI : Math.min(spreadAngle * 0.9, Math.PI / 1.5);

        n.childrenIds.forEach((childId, idx) => {
          const angleOffset =
            childCount > 1
              ? -spread / 2 + (spread * idx) / (childCount - 1)
              : 0;
          const childAngle =
            depth === 0
              ? (2 * Math.PI * idx) / childCount - Math.PI / 2
              : baseAngle + angleOffset;

          const cx = parentX + Math.cos(childAngle) * dist;
          const cy = parentY + Math.sin(childAngle) * dist;

          edgesList.push({
            id: `${id}->${childId}`,
            fromId: id,
            toId: childId,
            x1: parentX,
            y1: parentY,
            x2: cx,
            y2: cy,
          });

          placeOrbitalNode(childId, depth + 1, cx, cy, childAngle, spread / Math.max(childCount * 0.7, 1.2));
        });
      }

      placeOrbitalNode(rootId, 0, centerX, centerY, 0, 2 * Math.PI);
    }

    // Compute bounding box
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    positionsList.forEach((p) => {
      minX = Math.min(minX, p.x - p.width);
      maxX = Math.max(maxX, p.x + p.width);
      minY = Math.min(minY, p.y - p.height);
      maxY = Math.max(maxY, p.y + p.height);
    });

    return {
      positions: positionsList,
      edges: edgesList,
      bounds: {
        minX: minX === Infinity ? 0 : minX - 100,
        maxX: maxX === -Infinity ? 1000 : maxX + 100,
        minY: minY === Infinity ? 0 : minY - 100,
        maxY: maxY === -Infinity ? 600 : maxY + 100,
      },
    };
  }, [map, flatMap, rootId, collapsedIds, layoutMode]);

  // Selected node details and ancestry path
  const selectedNode = flatMap.get(selectedId) || flatMap.get(rootId);

  const activePathIds = useMemo(() => {
    if (!selectedNode) return new Set<string>();
    return new Set<string>([...selectedNode.ancestorIds, selectedNode.id]);
  }, [selectedNode]);

  // Search matches
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    const results: FlatNode[] = [];
    flatMap.forEach((node) => {
      if (node.name.toLowerCase().includes(query) || node.description.toLowerCase().includes(query)) {
        results.push(node);
      }
    });
    return results;
  }, [searchQuery, flatMap]);

  // Focus camera on a specific node
  const focusOnNode = useCallback((nodeId: string) => {
    const pos = positions.find((p) => p.node.id === nodeId);
    if (!pos || !containerRef.current) return;

    // Expand parents if collapsed
    const node = flatMap.get(nodeId);
    if (node && node.ancestorIds.length > 0) {
      setCollapsedIds((prev) => {
        const next = new Set(prev);
        node.ancestorIds.forEach((aId) => next.delete(aId));
        return next;
      });
    }

    setSelectedId(nodeId);

    const rect = containerRef.current.getBoundingClientRect();
    const targetX = rect.width / 2 - pos.x * zoom;
    const targetY = rect.height / 2 - pos.y * zoom;

    setPan({ x: targetX, y: targetY });
  }, [positions, zoom, flatMap]);

  // Reset to initial centered view
  const handleResetView = useCallback(() => {
    setZoom(1);
    if (layoutMode === "flow") {
      setPan({ x: 80, y: 150 });
    } else {
      const rect = containerRef.current?.getBoundingClientRect();
      const w = rect?.width || 1000;
      const h = rect?.height || 700;
      setPan({ x: w / 2 - 650, y: h / 2 - 450 });
    }
  }, [layoutMode]);

  // Fit mind map onto screen
  const handleFitView = useCallback(() => {
    if (!containerRef.current || positions.length === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const graphWidth = bounds.maxX - bounds.minX;
    const graphHeight = bounds.maxY - bounds.minY;

    const scaleX = (rect.width - 120) / graphWidth;
    const scaleY = (rect.height - 120) / graphHeight;
    const fitZoom = Math.min(Math.max(Math.min(scaleX, scaleY), 0.35), 1.4);

    setZoom(fitZoom);
    setPan({
      x: rect.width / 2 - ((bounds.minX + bounds.maxX) / 2) * fitZoom,
      y: rect.height / 2 - ((bounds.minY + bounds.maxY) / 2) * fitZoom,
    });
  }, [bounds, positions]);

  // Mouse pan handlers
  function handleMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPan({
      x: dragStartRef.current.panX + dx,
      y: dragStartRef.current.panY + dy,
    });
  }

  function handleMouseUp() {
    setIsDragging(false);
  }

  // Wheel zoom centered on cursor
  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseCanvasX = (e.clientX - rect.left - pan.x) / zoom;
    const mouseCanvasY = (e.clientY - rect.top - pan.y) / zoom;

    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.88;
    const newZoom = Math.min(Math.max(zoom * zoomFactor, 0.3), 2.5);

    setZoom(newZoom);
    setPan({
      x: e.clientX - rect.left - mouseCanvasX * newZoom,
      y: e.clientY - rect.top - mouseCanvasY * newZoom,
    });
  }

  // Toggle node collapse
  function toggleCollapse(nodeId: string, e: React.MouseEvent) {
    e.stopPropagation();
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }

  // Collapse/Expand all
  function handleExpandAll() {
    setCollapsedIds(new Set());
  }

  function handleCollapseAll() {
    const allParentIds = new Set<string>();
    flatMap.forEach((node) => {
      if (node.childCount > 0 && node.depth > 0) {
        allParentIds.add(node.id);
      }
    });
    setCollapsedIds(allParentIds);
  }

  // Export Mind Map as PNG
  async function handleExportImage() {
    if (!canvasCaptureRef.current) return;
    setExporting(true);
    try {
      const canvas = await toCanvas(canvasCaptureRef.current, {
        backgroundColor: "#050507",
        pixelRatio: 2,
      });
      const link = document.createElement("a");
      link.download = `${(map?.title || "mindmap").toLowerCase().replace(/\s+/g, "_")}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (err) {
      console.error("Failed to export mind map image:", err);
    } finally {
      setExporting(false);
    }
  }

  if (!map) {
    return (
      <div className="min-h-screen bg-void-950 flex items-center justify-center text-void-300">
        <div className="flex flex-col items-center gap-3">
          <Sparkles className="w-6 h-6 text-neon-pink animate-spin" style={{ animationDuration: "3s" }} />
          <span>Generating interactive neural mind map…</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative min-h-screen bg-void-950 text-void-100 ${isFullscreen ? "fixed inset-0 z-50 overflow-hidden" : ""}`}>
      {/* Top Header Bar */}
      <header className="relative z-20 backdrop-blur-xl bg-void-950/80 border-b border-void-700/60 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/study"
            className="text-xs text-void-300 hover:text-white transition-colors flex items-center gap-1 border border-void-700 rounded-lg px-2.5 py-1.5 bg-void-900/60"
          >
            ← Study Pack
          </Link>
          <div className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-neon-pink shrink-0" />
            <h1 className="text-lg font-semibold text-white truncate max-w-sm md:max-w-md">
              {map.title}
            </h1>
            {map.viewed_at && (
              <span title="Viewed" className="shrink-0">
                <CheckCircle2 className="w-4 h-4 text-neon-pink" />
              </span>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          {/* Layout Mode Switcher */}
          <div className="flex items-center rounded-lg border border-void-700 bg-void-900/80 p-0.5">
            <button
              onClick={() => { setLayoutMode("flow"); handleResetView(); }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                layoutMode === "flow" ? "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30" : "text-void-300 hover:text-white"
              }`}
              title="Neural Flow Layout (Curved Left-to-Right Tree)"
            >
              <GitFork className="w-3.5 h-3.5" />
              <span>Neural Flow</span>
            </button>
            <button
              onClick={() => { setLayoutMode("orbital"); handleResetView(); }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                layoutMode === "orbital" ? "bg-neon-pink/20 text-neon-pink border border-neon-pink/30" : "text-void-300 hover:text-white"
              }`}
              title="Orbital Galaxy Layout (360° Radial Solar System)"
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Orbital Galaxy</span>
            </button>
          </div>

          {/* Search Input with dropdown */}
          <div className="relative">
            <div className="flex items-center rounded-lg border border-void-700 bg-void-900/80 px-2.5 py-1 text-xs text-white">
              <Search className="w-3.5 h-3.5 text-void-400 mr-2 shrink-0" />
              <input
                type="text"
                placeholder="Search concepts…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent text-xs text-white placeholder-void-400 focus:outline-none w-28 md:w-36"
              />
            </div>

            {searchResults.length > 0 && (
              <div className="absolute right-0 top-full mt-1.5 w-64 glass rounded-xl shadow-2xl border border-void-600/80 p-1.5 z-30 max-h-56 overflow-y-auto">
                <p className="text-[10px] uppercase tracking-wider text-void-400 px-2 py-1 font-mono">
                  {searchResults.length} {searchResults.length === 1 ? "match" : "matches"}
                </p>
                {searchResults.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => {
                      focusOnNode(r.id);
                      setSearchQuery("");
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-void-700/60 text-void-100 flex items-center justify-between"
                  >
                    <span className="truncate font-medium">{r.name}</span>
                    <span className="text-[10px] text-neon-cyan shrink-0 ml-1">L{r.depth}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Export PNG */}
          <button
            onClick={handleExportImage}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-void-700 bg-void-900/80 text-void-200 hover:text-white text-xs transition-colors disabled:opacity-50"
            title="Download mind map as PNG image"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{exporting ? "Exporting…" : "Export"}</span>
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={() => setIsFullscreen((f) => !f)}
            className="p-1.5 rounded-lg border border-void-700 bg-void-900/80 text-void-300 hover:text-white transition-colors"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Mode"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Breadcrumbs Navigation Bar */}
      {selectedNode && (
        <div className="relative z-10 bg-void-900/50 border-b border-void-800/80 px-6 py-2 flex items-center gap-1.5 text-xs text-void-300 overflow-x-auto">
          <span className="text-void-400 font-mono text-[10px] uppercase mr-1">Pathway:</span>
          {selectedNode.ancestorIds.map((aId) => {
            const ancestor = flatMap.get(aId);
            if (!ancestor) return null;
            return (
              <div key={aId} className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => focusOnNode(aId)}
                  className="hover:text-neon-cyan transition-colors"
                >
                  {ancestor.name}
                </button>
                <ChevronRight className="w-3 h-3 text-void-500" />
              </div>
            );
          })}
          <span className="text-neon-pink font-medium truncate">{selectedNode.name}</span>
        </div>
      )}

      {/* Interactive Mind Map Canvas Area */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        className={`relative w-full ${isFullscreen ? "h-[calc(100vh-95px)]" : "h-[calc(100vh-140px)]"} overflow-hidden cursor-grab active:cursor-grabbing select-none`}
      >
        {/* SVG Canvas with Pan & Zoom Transform */}
        <div
          ref={canvasCaptureRef}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
            transition: isDragging ? "none" : "transform 0.08s ease-out",
          }}
          className="absolute left-0 top-0 pointer-events-auto"
        >
          <svg
            width={bounds.maxX + 400}
            height={bounds.maxY + 400}
            className="overflow-visible"
          >
            <defs>
              {/* Neon Glow Filters */}
              <filter id="neon-glow-cyan" x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#22D3EE" floodOpacity="0.75" />
              </filter>
              <filter id="neon-glow-violet" x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow dx="0" dy="0" stdDeviation="8" floodColor="#A855F7" floodOpacity="0.8" />
              </filter>
              <filter id="neon-glow-pink" x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#F472B6" floodOpacity="0.75" />
              </filter>

              {/* Animated Connection Pulse Gradient */}
              <linearGradient id="pulse-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#A855F7" stopOpacity="0.2" />
                <stop offset="50%" stopColor="#22D3EE" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#F472B6" stopOpacity="0.2" />
              </linearGradient>
            </defs>

            {/* Background Orbit Guidelines for Orbital Layout */}
            {layoutMode === "orbital" && (
              <g className="pointer-events-none opacity-20">
                <circle cx={650} cy={450} r={300} fill="none" stroke="#22D3EE" strokeDasharray="6 6" strokeWidth={1.5} />
                <circle cx={650} cy={450} r={490} fill="none" stroke="#F472B6" strokeDasharray="4 8" strokeWidth={1} />
              </g>
            )}

            {/* Connecting Edges */}
            <g className="edges-layer">
              {edges.map((e) => {
                const isPathActive = activePathIds.has(e.fromId) && activePathIds.has(e.toId);
                const midX = (e.x1 + e.x2) / 2;

                // Path shape based on layout mode
                const pathData =
                  layoutMode === "flow"
                    ? `M ${e.x1} ${e.y1} C ${midX} ${e.y1}, ${midX} ${e.y2}, ${e.x2} ${e.y2}`
                    : `M ${e.x1} ${e.y1} L ${e.x2} ${e.y2}`;

                return (
                  <g key={e.id}>
                    {/* Shadow/Base Line */}
                    <path
                      d={pathData}
                      fill="none"
                      stroke={isPathActive ? "#22D3EE" : "#26262F"}
                      strokeWidth={isPathActive ? 2.5 : 1.5}
                      strokeOpacity={isPathActive ? 0.9 : 0.6}
                      filter={isPathActive ? "url(#neon-glow-cyan)" : undefined}
                      className="transition-all duration-300"
                    />

                    {/* Animated Energy Flow Pulse (for active connections) */}
                    {isPathActive && (
                      <path
                        d={pathData}
                        fill="none"
                        stroke="#ffffff"
                        strokeWidth={2}
                        strokeDasharray="8 24"
                        strokeDashoffset="0"
                        className="animate-pulse"
                      />
                    )}
                  </g>
                );
              })}
            </g>

            {/* Node Elements */}
            <g className="nodes-layer">
              {positions.map((p) => {
                const node = p.node;
                const isSelected = selectedId === node.id;
                const isPathActive = activePathIds.has(node.id);
                const isCollapsed = collapsedIds.has(node.id);
                const hasChildren = node.childCount > 0;

                // Depth-specific aesthetics
                let bgGradient = "linear-gradient(135deg, rgba(38, 38, 47, 0.95), rgba(18, 18, 24, 0.95))";
                let borderColor = isSelected ? "#22D3EE" : isPathActive ? "#A855F7" : "rgba(84, 84, 95, 0.45)";
                let titleColor = "text-xs md:text-sm font-medium text-void-100";
                let depthBadge = `L${node.depth}`;

                if (node.depth === 0) {
                  bgGradient = "linear-gradient(135deg, #9333EA, #581C87)";
                  borderColor = "#F472B6";
                  titleColor = "text-sm md:text-base font-bold text-white";
                  depthBadge = "L0 Core";
                } else if (node.depth === 1) {
                  bgGradient = "linear-gradient(135deg, rgba(34, 211, 238, 0.22), rgba(15, 23, 42, 0.95))";
                  borderColor = isSelected ? "#22D3EE" : "rgba(34, 211, 238, 0.65)";
                  titleColor = "text-xs md:text-sm font-semibold text-white";
                  depthBadge = "L1 Pillar";
                } else if (node.depth === 2) {
                  bgGradient = "linear-gradient(135deg, rgba(168, 85, 247, 0.18), rgba(15, 23, 42, 0.95))";
                  borderColor = isSelected ? "#A855F7" : "rgba(168, 85, 247, 0.55)";
                  depthBadge = "L2 Sub";
                } else if (node.depth === 3) {
                  bgGradient = "linear-gradient(135deg, rgba(244, 114, 182, 0.16), rgba(15, 23, 42, 0.95))";
                  borderColor = isSelected ? "#F472B6" : "rgba(244, 114, 182, 0.5)";
                  depthBadge = "L3 Principle";
                } else {
                  bgGradient = "linear-gradient(135deg, rgba(163, 230, 53, 0.14), rgba(15, 23, 42, 0.95))";
                  borderColor = isSelected ? "#A3E635" : "rgba(163, 230, 53, 0.45)";
                  depthBadge = `L${node.depth} Detail`;
                }

                return (
                  <g
                    key={node.id}
                    transform={`translate(${p.x - p.width / 2}, ${p.y - p.height / 2})`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedId(node.id);
                    }}
                    className="cursor-pointer group"
                  >
                    {/* Node Container via ForeignObject for responsive HTML/Tailwind styling */}
                    <foreignObject width={p.width} height={p.height}>
                      <div
                        style={{
                          background: bgGradient,
                          borderColor: borderColor,
                        }}
                        className={`w-full h-full rounded-2xl border px-3.5 py-2.5 flex flex-col justify-center transition-all duration-300 shadow-xl ${
                          isSelected
                            ? "ring-2 ring-neon-cyan shadow-neon-cyan/50 scale-105"
                            : isPathActive
                            ? "ring-1 ring-neon-violet shadow-neon-violet/40"
                            : "hover:border-void-400 hover:scale-[1.02]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <span className={`truncate ${titleColor}`} title={node.name}>
                            {node.name}
                          </span>

                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-[9px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded bg-void-950/60 text-void-300 font-semibold border border-void-700/50">
                              {depthBadge}
                            </span>
                            {/* Interactive Expand / Collapse Toggle for Branch Nodes */}
                            {hasChildren && (
                              <button
                                type="button"
                                onClick={(e) => toggleCollapse(node.id, e)}
                                className={`rounded-full px-2 py-0.5 text-xs font-mono font-bold flex items-center gap-0.5 transition-colors ${
                                  isCollapsed
                                    ? "bg-neon-pink/20 text-neon-pink border border-neon-pink/40"
                                    : "bg-void-700/80 text-void-300 hover:text-white"
                                }`}
                                title={isCollapsed ? `Expand ${node.childCount} sub-branches` : "Collapse sub-branches"}
                              >
                                <span>{node.childCount}</span>
                                {isCollapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Sub-label snippet */}
                        <p className="text-xs text-void-300/80 truncate mt-1">
                          {node.description}
                        </p>
                      </div>
                    </foreignObject>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        {/* Floating Viewport Dock Controls */}
        <div className="absolute left-6 bottom-6 z-20 glass rounded-2xl p-1.5 flex items-center gap-1 border border-void-700/80 shadow-2xl">
          <button
            onClick={() => setZoom((z) => Math.min(z * 1.15, 2.5))}
            className="p-2 rounded-xl hover:bg-void-700 text-void-200 hover:text-white transition-colors"
            title="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(z * 0.85, 0.3))}
            className="p-2 rounded-xl hover:bg-void-700 text-void-200 hover:text-white transition-colors"
            title="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={handleResetView}
            className="px-2.5 py-1.5 rounded-xl hover:bg-void-700 text-void-200 hover:text-white font-mono text-xs transition-colors"
            title="Reset Zoom to 100%"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={handleFitView}
            className="p-2 rounded-xl hover:bg-void-700 text-void-200 hover:text-white transition-colors"
            title="Fit Entire Map on Screen"
          >
            <Compass className="w-4 h-4" />
          </button>

          <div className="w-px h-5 bg-void-700 mx-1" />

          <button
            onClick={handleExpandAll}
            className="px-2 py-1 rounded-lg text-[11px] hover:bg-void-700 text-void-300 hover:text-white transition-colors"
            title="Expand all branches"
          >
            Expand All
          </button>
          <button
            onClick={handleCollapseAll}
            className="px-2 py-1 rounded-lg text-[11px] hover:bg-void-700 text-void-300 hover:text-white transition-colors"
            title="Collapse branches"
          >
            Collapse
          </button>
        </div>

        {/* Floating Mini-Map / Navigator Indicator */}
        <div className="hidden sm:flex absolute right-6 bottom-6 z-10 glass rounded-xl px-3 py-1.5 border border-void-700/60 text-[11px] text-void-400 items-center gap-2 pointer-events-none">
          <span className="w-2 h-2 rounded-full bg-neon-cyan animate-pulse" />
          <span>{visibleNodeIds.size} nodes rendered • Drag to pan</span>
        </div>

        {/* Collapsible Concept Inspector Sidebar */}
        <aside
          className={`absolute right-6 top-6 z-20 w-80 max-w-[calc(100vw-3rem)] glass rounded-2xl p-5 border border-void-600/70 shadow-2xl transition-all duration-300 ${
            showInspector ? "translate-x-0 opacity-100" : "translate-x-full opacity-0 pointer-events-none"
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-mono uppercase tracking-widest text-neon-pink flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" /> Concept Inspector
            </span>
            <button
              onClick={() => setShowInspector(false)}
              className="text-void-400 hover:text-white text-xs p-1"
              title="Close inspector"
            >
              ✕
            </button>
          </div>

          {selectedNode ? (
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-base font-semibold text-white leading-snug">
                    {selectedNode.name}
                  </h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-void-700 text-void-300 font-mono">
                    Depth {selectedNode.depth}
                  </span>
                </div>
                <p className="text-xs text-void-300 leading-relaxed mt-2 bg-void-900/60 p-3 rounded-xl border border-void-700/50">
                  {selectedNode.description}
                </p>
              </div>

              {/* Connected Sub-topics */}
              {selectedNode.childrenIds.length > 0 && (
                <div>
                  <p className="text-[11px] font-medium text-void-300 mb-2">
                    Subconcepts ({selectedNode.childrenIds.length}):
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedNode.childrenIds.map((cId) => {
                      const childNode = flatMap.get(cId);
                      if (!childNode) return null;
                      return (
                        <button
                          key={cId}
                          onClick={() => focusOnNode(cId)}
                          className="text-xs px-2.5 py-1 rounded-lg bg-void-800/80 hover:bg-neon-cyan/20 border border-void-700 text-void-200 hover:text-neon-cyan transition-colors truncate max-w-[220px]"
                        >
                          {childNode.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Integrated AI Study Actions */}
              <div className="pt-2 border-t border-void-700/60 space-y-2">
                <p className="text-[10px] font-mono uppercase tracking-wider text-void-400">
                  Study this concept
                </p>

                <button
                  onClick={() => navigate("/chat", { state: { initialPrompt: `Explain the concept "${selectedNode.name}" in depth: ${selectedNode.description}` } })}
                  className="w-full flex items-center justify-between text-xs px-3 py-2 rounded-xl bg-void-900 border border-void-700 hover:border-neon-violet text-void-200 hover:text-white transition-all group"
                >
                  <span className="flex items-center gap-2">
                    <MessageSquare className="w-3.5 h-3.5 text-neon-violet" />
                    <span>Ask AI in Chat</span>
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-void-500 group-hover:translate-x-0.5 transition-transform" />
                </button>

                <button
                  onClick={() => navigate("/study/quiz")}
                  className="w-full flex items-center justify-between text-xs px-3 py-2 rounded-xl bg-void-900 border border-void-700 hover:border-neon-cyan text-void-200 hover:text-white transition-all group"
                >
                  <span className="flex items-center gap-2">
                    <Brain className="w-3.5 h-3.5 text-neon-cyan" />
                    <span>Generate Concept Quiz</span>
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-void-500 group-hover:translate-x-0.5 transition-transform" />
                </button>

                <button
                  onClick={() => navigate("/study/flashcards/new")}
                  className="w-full flex items-center justify-between text-xs px-3 py-2 rounded-xl bg-void-900 border border-void-700 hover:border-neon-pink text-void-200 hover:text-white transition-all group"
                >
                  <span className="flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-neon-pink" />
                    <span>Create Flashcards</span>
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-void-500 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-void-300">Click any concept node to inspect its breakdown.</p>
          )}
        </aside>

        {/* Button to reopen inspector if closed */}
        {!showInspector && (
          <button
            onClick={() => setShowInspector(true)}
            className="absolute right-6 top-6 z-20 glass rounded-xl px-3 py-2 text-xs text-white border border-void-600 flex items-center gap-2 shadow-xl hover:border-neon-pink transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-neon-pink" />
            <span>Open Inspector</span>
          </button>
        )}
      </div>
    </div>
  );
}
