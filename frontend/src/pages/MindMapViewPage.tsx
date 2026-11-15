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
  X,
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

  // Touch gesture state for mobile pinch-to-zoom and drag
  const touchStartRef = useRef<{
    x: number;
    y: number;
    panX: number;
    panY: number;
    initialDistance?: number;
    initialZoom?: number;
    touchCenterX?: number;
    touchCenterY?: number;
  }>({ x: 0, y: 0, panX: 0, panY: 0 });

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
      if (depth === 0) return { width: 290, height: 88 };
      if (depth === 1) return { width: 250, height: 80 };
      if (depth === 2) return { width: 230, height: 74 };
      return { width: 210, height: 68 };
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
    setShowInspector(true);

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

  // Mouse pan handlers (Desktop)
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

  // Wheel zoom centered on cursor (Desktop)
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

  // Mobile Touch Gestures (Single-finger drag pan & Dual-finger pinch-to-zoom)
  function handleTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        panX: pan.x,
        panY: pan.y,
      };
      setIsDragging(true);
    } else if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const centerX = (t1.clientX + t2.clientX) / 2;
      const centerY = (t1.clientY + t2.clientY) / 2;

      touchStartRef.current = {
        x: centerX,
        y: centerY,
        panX: pan.x,
        panY: pan.y,
        initialDistance: dist,
        initialZoom: zoom,
        touchCenterX: centerX,
        touchCenterY: centerY,
      };
      setIsDragging(false);
    }
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (e.touches.length === 1 && !touchStartRef.current.initialDistance) {
      const touch = e.touches[0];
      const dx = touch.clientX - touchStartRef.current.x;
      const dy = touch.clientY - touchStartRef.current.y;
      setPan({
        x: touchStartRef.current.panX + dx,
        y: touchStartRef.current.panY + dy,
      });
    } else if (e.touches.length === 2 && touchStartRef.current.initialDistance && touchStartRef.current.initialZoom) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const currentDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const scaleFactor = currentDist / touchStartRef.current.initialDistance;
      const newZoom = Math.min(Math.max(touchStartRef.current.initialZoom * scaleFactor, 0.3), 2.5);

      const rect = containerRef.current?.getBoundingClientRect();
      if (rect && touchStartRef.current.touchCenterX !== undefined && touchStartRef.current.touchCenterY !== undefined) {
        const cx = touchStartRef.current.touchCenterX;
        const cy = touchStartRef.current.touchCenterY;
        const originCanvasX = (cx - rect.left - touchStartRef.current.panX) / touchStartRef.current.initialZoom;
        const originCanvasY = (cy - rect.top - touchStartRef.current.panY) / touchStartRef.current.initialZoom;

        setZoom(newZoom);
        setPan({
          x: cx - rect.left - originCanvasX * newZoom,
          y: cy - rect.top - originCanvasY * newZoom,
        });
      } else {
        setZoom(newZoom);
      }
    }
  }

  function handleTouchEnd() {
    setIsDragging(false);
    touchStartRef.current = { x: 0, y: 0, panX: 0, panY: 0 };
  }

  // Toggle node collapse
  function toggleCollapse(nodeId: string, e: React.MouseEvent | React.TouchEvent) {
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
          <Sparkles className="w-7 h-7 text-neon-pink animate-spin" style={{ animationDuration: "3s" }} />
          <span className="text-sm font-medium">Synthesizing Neural Mind Map…</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative min-h-screen bg-void-950 text-void-100 ${isFullscreen ? "fixed inset-0 z-50 overflow-hidden" : ""}`}>
      {/* Top Header Bar (Dual Desktop & Mobile Responsive) */}
      <header className="relative z-20 backdrop-blur-xl bg-void-950/85 border-b border-void-700/60 px-4 md:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to="/study"
            className="text-xs text-void-300 hover:text-white transition-colors flex items-center gap-1 border border-void-700 rounded-xl px-2.5 py-1.5 bg-void-900/70 shrink-0 min-h-[36px]"
          >
            ← Study
          </Link>
          <div className="flex items-center gap-2 min-w-0">
            <Share2 className="w-5 h-5 text-neon-pink shrink-0" />
            <h1 className="text-base md:text-lg font-semibold text-white truncate max-w-[180px] sm:max-w-xs md:max-w-md">
              {map.title}
            </h1>
            {map.viewed_at && (
              <span title="Completed/Viewed" className="shrink-0">
                <CheckCircle2 className="w-4 h-4 text-neon-lime" />
              </span>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Layout Mode Switcher */}
          <div className="flex items-center rounded-xl border border-void-700 bg-void-900/80 p-0.5">
            <button
              onClick={() => { setLayoutMode("flow"); handleResetView(); }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors min-h-[34px] ${
                layoutMode === "flow" ? "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30" : "text-void-300 hover:text-white"
              }`}
              title="Neural Flow Layout (Curved Left-to-Right Tree)"
            >
              <GitFork className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Flow</span>
            </button>
            <button
              onClick={() => { setLayoutMode("orbital"); handleResetView(); }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors min-h-[34px] ${
                layoutMode === "orbital" ? "bg-neon-pink/20 text-neon-pink border border-neon-pink/30" : "text-void-300 hover:text-white"
              }`}
              title="Orbital Galaxy Layout (360° Radial Solar System)"
            >
              <Radio className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Orbital</span>
            </button>
          </div>

          {/* Search Input with dropdown */}
          <div className="relative">
            <div className="flex items-center rounded-xl border border-void-700 bg-void-900/80 px-2.5 py-1.5 text-xs text-white min-h-[36px]">
              <Search className="w-3.5 h-3.5 text-void-400 mr-1.5 shrink-0" />
              <input
                type="text"
                placeholder="Search…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent text-xs text-white placeholder-void-400 focus:outline-none w-20 sm:w-28 md:w-36"
              />
            </div>

            {searchResults.length > 0 && (
              <div className="absolute right-0 top-full mt-2 w-72 glass-modern rounded-2xl shadow-2xl border border-void-600/80 p-2 z-30 max-h-60 overflow-y-auto">
                <p className="text-[10px] uppercase tracking-wider text-void-400 px-2.5 py-1 font-mono">
                  {searchResults.length} {searchResults.length === 1 ? "match" : "matches"}
                </p>
                {searchResults.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => {
                      focusOnNode(r.id);
                      setSearchQuery("");
                    }}
                    className="w-full text-left px-2.5 py-2 rounded-xl text-xs hover:bg-void-700/70 text-void-100 flex items-center justify-between transition-colors"
                  >
                    <span className="truncate font-medium">{r.name}</span>
                    <span className="text-[10px] text-neon-cyan shrink-0 ml-2 font-mono">L{r.depth}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Export PNG */}
          <button
            onClick={handleExportImage}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-void-700 bg-void-900/80 text-void-200 hover:text-white text-xs transition-colors disabled:opacity-50 min-h-[36px]"
            title="Download mind map as PNG image"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{exporting ? "Saving…" : "Export"}</span>
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={() => setIsFullscreen((f) => !f)}
            className="p-2 rounded-xl border border-void-700 bg-void-900/80 text-void-300 hover:text-white transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Mode"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Breadcrumbs Navigation Bar */}
      {selectedNode && (
        <div className="relative z-10 bg-void-900/60 border-b border-void-800/80 px-4 md:px-6 py-2 flex items-center gap-1.5 text-xs text-void-300 overflow-x-auto no-scrollbar">
          <span className="text-void-400 font-mono text-[10px] uppercase mr-1 shrink-0">Path:</span>
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
          <span className="text-neon-pink font-semibold truncate shrink-0">{selectedNode.name}</span>
        </div>
      )}

      {/* Interactive Mind Map Canvas Area */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`relative w-full ${isFullscreen ? "h-[calc(100vh-95px)]" : "h-[calc(100vh-140px)]"} overflow-hidden cursor-grab active:cursor-grabbing select-none touch-none`}
      >
        {/* SVG Canvas with GPU Hardware-Accelerated Pan & Zoom Transform */}
        <div
          ref={canvasCaptureRef}
          style={{
            transform: `translate3d(${pan.x}px, ${pan.y}px, 0px) scale(${zoom})`,
            transformOrigin: "0 0",
            willChange: "transform",
            transition: isDragging ? "none" : "transform 0.08s cubic-bezier(0.16, 1, 0.3, 1)",
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
                <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#22D3EE" floodOpacity="0.8" />
              </filter>
              <filter id="neon-glow-violet" x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow dx="0" dy="0" stdDeviation="8" floodColor="#A855F7" floodOpacity="0.85" />
              </filter>
              <filter id="neon-glow-pink" x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#F472B6" floodOpacity="0.8" />
              </filter>

              {/* Animated Connection Pulse Gradient */}
              <linearGradient id="pulse-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#A855F7" stopOpacity="0.3" />
                <stop offset="50%" stopColor="#22D3EE" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#F472B6" stopOpacity="0.3" />
              </linearGradient>
            </defs>

            {/* Background Orbit Guidelines for Orbital Layout */}
            {layoutMode === "orbital" && (
              <g className="pointer-events-none opacity-20">
                <circle cx={850} cy={650} r={360} fill="none" stroke="#22D3EE" strokeDasharray="6 6" strokeWidth={1.5} />
                <circle cx={850} cy={650} r={580} fill="none" stroke="#F472B6" strokeDasharray="4 8" strokeWidth={1} />
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
                    {/* Base Connection Line */}
                    <path
                      d={pathData}
                      fill="none"
                      stroke={isPathActive ? "#22D3EE" : "rgba(84, 84, 95, 0.45)"}
                      strokeWidth={isPathActive ? 2.5 : 1.5}
                      strokeOpacity={isPathActive ? 0.95 : 0.6}
                      filter={isPathActive ? "url(#neon-glow-cyan)" : undefined}
                      className="transition-all duration-300"
                    />

                    {/* Animated Energy Flow Pulse (for active path) */}
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
                let bgGradient = "linear-gradient(135deg, rgba(27, 27, 36, 0.95), rgba(11, 11, 16, 0.95))";
                let borderColor = isSelected ? "#22D3EE" : isPathActive ? "#A855F7" : "rgba(84, 84, 95, 0.5)";
                let titleColor = "text-xs md:text-sm font-medium text-void-100";
                let depthBadge = `L${node.depth}`;

                if (node.depth === 0) {
                  bgGradient = "linear-gradient(135deg, #9333EA, #581C87)";
                  borderColor = "#F472B6";
                  titleColor = "text-sm md:text-base font-bold text-white";
                  depthBadge = "Core";
                } else if (node.depth === 1) {
                  bgGradient = "linear-gradient(135deg, rgba(34, 211, 238, 0.22), rgba(15, 23, 42, 0.96))";
                  borderColor = isSelected ? "#22D3EE" : "rgba(34, 211, 238, 0.7)";
                  titleColor = "text-xs md:text-sm font-semibold text-white";
                  depthBadge = "Pillar";
                } else if (node.depth === 2) {
                  bgGradient = "linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(15, 23, 42, 0.96))";
                  borderColor = isSelected ? "#A855F7" : "rgba(168, 85, 247, 0.6)";
                  depthBadge = "Branch";
                } else if (node.depth === 3) {
                  bgGradient = "linear-gradient(135deg, rgba(244, 114, 182, 0.18), rgba(15, 23, 42, 0.96))";
                  borderColor = isSelected ? "#F472B6" : "rgba(244, 114, 182, 0.55)";
                  depthBadge = "Concept";
                } else {
                  bgGradient = "linear-gradient(135deg, rgba(163, 230, 53, 0.15), rgba(15, 23, 42, 0.96))";
                  borderColor = isSelected ? "#A3E635" : "rgba(163, 230, 53, 0.5)";
                  depthBadge = `Detail`;
                }

                return (
                  <g
                    key={node.id}
                    transform={`translate(${p.x - p.width / 2}, ${p.y - p.height / 2})`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedId(node.id);
                      setShowInspector(true);
                    }}
                    className="cursor-pointer group"
                  >
                    <foreignObject width={p.width} height={p.height}>
                      <div
                        style={{
                          background: bgGradient,
                          borderColor: borderColor,
                        }}
                        className={`w-full h-full rounded-2xl border px-3.5 py-2.5 flex flex-col justify-center transition-all duration-300 shadow-xl ${
                          isSelected
                            ? "ring-2 ring-neon-cyan shadow-neon-cyan/50 scale-[1.03]"
                            : isPathActive
                            ? "ring-1 ring-neon-violet shadow-neon-violet/40"
                            : "hover:border-void-300 hover:scale-[1.02]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <span className={`truncate ${titleColor}`} title={node.name}>
                            {node.name}
                          </span>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[9px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded-md bg-void-950/70 text-void-300 font-semibold border border-void-700/60">
                              {depthBadge}
                            </span>
                            {/* Interactive Touch-friendly Expand/Collapse Toggle */}
                            {hasChildren && (
                              <button
                                type="button"
                                onClick={(e) => toggleCollapse(node.id, e)}
                                className={`min-w-[28px] min-h-[28px] px-2 py-0.5 rounded-full text-xs font-mono font-bold flex items-center justify-center gap-0.5 transition-all ${
                                  isCollapsed
                                    ? "bg-neon-pink/20 text-neon-pink border border-neon-pink/40 shadow-glow-pink"
                                    : "bg-void-700/80 text-void-300 hover:text-white hover:bg-void-600"
                                }`}
                                title={isCollapsed ? `Expand ${node.childCount} sub-branches` : "Collapse sub-branches"}
                              >
                                <span>{node.childCount}</span>
                                {isCollapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Concept short description */}
                        <p className="text-[11px] text-void-300/80 truncate mt-1">
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

        {/* Floating Viewport Dock Controls (Optimized for Mobile Touch & Desktop) */}
        <div className="absolute left-4 bottom-4 md:left-6 md:bottom-6 z-20 glass-modern rounded-2xl p-1.5 flex items-center gap-1 border border-void-700/80 shadow-2xl">
          <button
            onClick={() => setZoom((z) => Math.min(z * 1.15, 2.5))}
            className="w-9 h-9 rounded-xl hover:bg-void-700/70 text-void-200 hover:text-white transition-colors flex items-center justify-center"
            title="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(z * 0.85, 0.3))}
            className="w-9 h-9 rounded-xl hover:bg-void-700/70 text-void-200 hover:text-white transition-colors flex items-center justify-center"
            title="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={handleResetView}
            className="px-2.5 h-9 rounded-xl hover:bg-void-700/70 text-void-200 hover:text-white font-mono text-xs transition-colors flex items-center justify-center"
            title="Reset Zoom to 100%"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={handleFitView}
            className="w-9 h-9 rounded-xl hover:bg-void-700/70 text-void-200 hover:text-white transition-colors flex items-center justify-center"
            title="Fit Entire Map on Screen"
          >
            <Compass className="w-4 h-4" />
          </button>

          <div className="w-px h-5 bg-void-700 mx-1" />

          <button
            onClick={handleExpandAll}
            className="px-2.5 h-9 rounded-xl text-xs hover:bg-void-700/70 text-void-300 hover:text-white transition-colors hidden sm:flex items-center"
            title="Expand all branches"
          >
            Expand
          </button>
          <button
            onClick={handleCollapseAll}
            className="px-2.5 h-9 rounded-xl text-xs hover:bg-void-700/70 text-void-300 hover:text-white transition-colors hidden sm:flex items-center"
            title="Collapse branches"
          >
            Collapse
          </button>
        </div>

        {/* Floating Mini-Map / Node Counter (Desktop indicator) */}
        <div className="hidden lg:flex absolute left-6 top-6 z-10 glass-modern rounded-xl px-3 py-1.5 border border-void-700/60 text-[11px] text-void-400 items-center gap-2 pointer-events-none">
          <span className="w-2 h-2 rounded-full bg-neon-cyan animate-pulse" />
          <span>{visibleNodeIds.size} concepts rendered</span>
        </div>

        {/* Desktop Inspector Sidebar */}
        <aside
          className={`hidden md:block absolute right-6 top-6 z-30 w-80 lg:w-96 glass-modern rounded-2xl p-5 border border-void-600/80 shadow-2xl transition-all duration-300 max-h-[calc(100vh-180px)] overflow-y-auto ${
            showInspector ? "translate-x-0 opacity-100" : "translate-x-full opacity-0 pointer-events-none"
          }`}
        >
          <div className="flex items-center justify-between mb-3.5">
            <span className="text-[10px] font-mono uppercase tracking-widest text-neon-pink flex items-center gap-1.5 font-bold">
              <Sparkles className="w-3.5 h-3.5" /> Concept Inspector
            </span>
            <button
              onClick={() => setShowInspector(false)}
              className="text-void-400 hover:text-white text-xs p-1 rounded-lg hover:bg-void-800 transition-colors"
              title="Close inspector"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {selectedNode ? (
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-base font-semibold text-white leading-snug">
                    {selectedNode.name}
                  </h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-void-800 text-void-300 font-mono shrink-0">
                    L{selectedNode.depth}
                  </span>
                </div>
                <p className="text-xs text-void-200 leading-relaxed mt-2.5 bg-void-900/80 p-3.5 rounded-xl border border-void-700/60">
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
                          className="text-xs px-2.5 py-1.5 rounded-xl bg-void-800/80 hover:bg-neon-cyan/20 border border-void-700 text-void-200 hover:text-neon-cyan transition-colors truncate max-w-[220px]"
                        >
                          {childNode.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Integrated AI Study Actions */}
              <div className="pt-3 border-t border-void-700/60 space-y-2">
                <p className="text-[10px] font-mono uppercase tracking-wider text-void-400">
                  Interactive Study
                </p>

                <button
                  onClick={() => navigate("/chat", { state: { initialPrompt: `Explain the concept "${selectedNode.name}" in depth: ${selectedNode.description}` } })}
                  className="w-full flex items-center justify-between text-xs px-3.5 py-2.5 rounded-xl bg-void-900/90 border border-void-700 hover:border-neon-violet text-void-200 hover:text-white transition-all group"
                >
                  <span className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-neon-violet" />
                    <span>Ask AI in Chat</span>
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-void-500 group-hover:translate-x-0.5 transition-transform" />
                </button>

                <button
                  onClick={() => navigate("/study/quiz")}
                  className="w-full flex items-center justify-between text-xs px-3.5 py-2.5 rounded-xl bg-void-900/90 border border-void-700 hover:border-neon-cyan text-void-200 hover:text-white transition-all group"
                >
                  <span className="flex items-center gap-2">
                    <Brain className="w-4 h-4 text-neon-cyan" />
                    <span>Generate Concept Quiz</span>
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-void-500 group-hover:translate-x-0.5 transition-transform" />
                </button>

                <button
                  onClick={() => navigate("/study/flashcards/new")}
                  className="w-full flex items-center justify-between text-xs px-3.5 py-2.5 rounded-xl bg-void-900/90 border border-void-700 hover:border-neon-pink text-void-200 hover:text-white transition-all group"
                >
                  <span className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-neon-pink" />
                    <span>Create Flashcards</span>
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-void-500 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-void-300">Tap any concept node to inspect its breakdown.</p>
          )}
        </aside>

        {/* Mobile Responsive Bottom Sheet Inspector */}
        {showInspector && selectedNode && (
          <div className="md:hidden fixed inset-0 z-40 flex flex-col justify-end">
            <div
              className="absolute inset-0 bg-void-950/60 backdrop-blur-sm transition-opacity"
              onClick={() => setShowInspector(false)}
            />
            <div className="relative glass-modern rounded-t-3xl border-t border-void-600/80 p-5 shadow-2xl max-h-[75vh] overflow-y-auto z-10 animate-in slide-in-from-bottom duration-300">
              {/* Drag Pill Handle */}
              <div className="w-12 h-1 bg-void-600 rounded-full mx-auto mb-3" />

              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-mono uppercase tracking-widest text-neon-pink flex items-center gap-1.5 font-bold">
                  <Sparkles className="w-3.5 h-3.5" /> Concept Inspector
                </span>
                <button
                  onClick={() => setShowInspector(false)}
                  className="w-8 h-8 rounded-full bg-void-800 text-void-300 flex items-center justify-center hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <h3 className="text-base font-semibold text-white">
                    {selectedNode.name}
                  </h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-void-800 text-void-300 font-mono">
                    L{selectedNode.depth}
                  </span>
                </div>
                <p className="text-xs text-void-200 leading-relaxed bg-void-900/90 p-3 rounded-xl border border-void-700/60 mb-4">
                  {selectedNode.description}
                </p>
              </div>

              {selectedNode.childrenIds.length > 0 && (
                <div className="mb-4">
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
                          className="text-xs px-2.5 py-1.5 rounded-xl bg-void-800 border border-void-700 text-void-200 hover:text-neon-cyan transition-colors"
                        >
                          {childNode.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-void-800">
                <button
                  onClick={() => navigate("/chat", { state: { initialPrompt: `Explain the concept "${selectedNode.name}" in depth: ${selectedNode.description}` } })}
                  className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-void-900 border border-void-700 text-void-200 text-center"
                >
                  <MessageSquare className="w-4 h-4 text-neon-violet mb-1" />
                  <span className="text-[10px]">Chat AI</span>
                </button>

                <button
                  onClick={() => navigate("/study/quiz")}
                  className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-void-900 border border-void-700 text-void-200 text-center"
                >
                  <Brain className="w-4 h-4 text-neon-cyan mb-1" />
                  <span className="text-[10px]">Quiz</span>
                </button>

                <button
                  onClick={() => navigate("/study/flashcards/new")}
                  className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-void-900 border border-void-700 text-void-200 text-center"
                >
                  <Layers className="w-4 h-4 text-neon-pink mb-1" />
                  <span className="text-[10px]">Cards</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reopen Inspector Button if closed */}
        {!showInspector && (
          <button
            onClick={() => setShowInspector(true)}
            className="absolute right-4 top-4 md:right-6 md:top-6 z-20 glass-modern rounded-xl px-3.5 py-2 text-xs text-white border border-void-600 flex items-center gap-2 shadow-xl hover:border-neon-pink transition-colors min-h-[36px]"
          >
            <Sparkles className="w-3.5 h-3.5 text-neon-pink" />
            <span className="hidden sm:inline">Open Inspector</span>
          </button>
        )}
      </div>
    </div>
  );
}
