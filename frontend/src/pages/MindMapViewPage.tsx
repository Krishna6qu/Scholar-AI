import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "@/lib/api";

interface TreeNode {
  name: string;
  description?: string;
  children?: TreeNode[];
}

interface MindMap {
  id: string;
  title: string;
  json_structure: TreeNode;
}

interface PositionedNode {
  node: TreeNode;
  x: number;
  y: number;
  depth: number;
}

interface Edge {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const X_SPACING = 240;
const LEAF_HEIGHT = 56;

function countLeaves(n: TreeNode): number {
  if (!n.children || n.children.length === 0) return 1;
  return n.children.reduce((sum, c) => sum + countLeaves(c), 0);
}

function layoutTree(root: TreeNode) {
  const positions: PositionedNode[] = [];
  const edges: Edge[] = [];

  function place(n: TreeNode, depth: number, yTop: number, yBottom: number): PositionedNode {
    const x = depth * X_SPACING;
    if (!n.children || n.children.length === 0) {
      const y = (yTop + yBottom) / 2;
      const pos = { node: n, x, y, depth };
      positions.push(pos);
      return pos;
    }
    const totalLeaves = countLeaves(n);
    let cursor = yTop;
    const childPositions: PositionedNode[] = [];
    for (const child of n.children) {
      const leaves = countLeaves(child);
      const span = (yBottom - yTop) * (leaves / totalLeaves);
      childPositions.push(place(child, depth + 1, cursor, cursor + span));
      cursor += span;
    }
    const y = (childPositions[0].y + childPositions[childPositions.length - 1].y) / 2;
    const pos = { node: n, x, y, depth };
    positions.push(pos);
    for (const cp of childPositions) edges.push({ x1: x, y1: y, x2: cp.x, y2: cp.y });
    return pos;
  }

  const totalLeaves = Math.max(countLeaves(root), 1);
  const height = Math.max(totalLeaves * LEAF_HEIGHT, 220);
  place(root, 0, 0, height);

  const maxDepth = Math.max(...positions.map((p) => p.depth));
  const width = (maxDepth + 1) * X_SPACING + 200;
  return { positions, edges, width, height };
}

const DEPTH_STYLES = [
  { fill: "#A855F7", text: "#050507", w: 180, h: 48 }, // root
  { fill: "#22D3EE", text: "#050507", w: 160, h: 40 }, // branch
  { fill: "#1B1B24", text: "#D4D4DC", w: 150, h: 34 }, // leaf
];

export default function MindMapViewPage() {
  const { mapId } = useParams<{ mapId: string }>();
  const [map, setMap] = useState<MindMap | null>(null);
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);

  useEffect(() => {
    api.get(`/mindmaps/${mapId}`).then(({ data }) => {
      setMap(data);
      setSelectedNode(data.json_structure);
    });
  }, [mapId]);

  if (!map) {
    return <div className="min-h-screen bg-void-950 flex items-center justify-center text-void-300">Loading…</div>;
  }

  const { positions, edges, width, height } = layoutTree(map.json_structure);
  const PAD = 40;

  return (
    <div className="min-h-screen bg-void-950 px-4 py-10">
      <div className="max-w-6xl mx-auto">
        <Link to="/study" className="text-sm text-void-300 hover:text-white transition-colors mb-6 inline-block">
          ← Back to Study Pack
        </Link>
        <h1 className="text-2xl text-white mb-6">{map.title}</h1>

        <div className="grid lg:grid-cols-[1fr_320px] gap-5">
          <div className="glass rounded-2xl p-6 overflow-auto">
            <svg
              width={width + PAD * 2}
              height={height + PAD * 2}
              viewBox={`0 0 ${width + PAD * 2} ${height + PAD * 2}`}
            >
              <g transform={`translate(${PAD}, ${PAD})`}>
                {edges.map((e, i) => {
                  const midX = (e.x1 + e.x2) / 2;
                  return (
                    <path
                      key={i}
                      d={`M ${e.x1} ${e.y1} C ${midX} ${e.y1}, ${midX} ${e.y2}, ${e.x2} ${e.y2}`}
                      fill="none"
                      stroke="#33424B"
                      strokeWidth={1.5}
                    />
                  );
                })}
                {positions.map((p, i) => {
                  const style = DEPTH_STYLES[Math.min(p.depth, DEPTH_STYLES.length - 1)];
                  const isSelected = selectedNode === p.node;
                  return (
                    <g
                      key={i}
                      transform={`translate(${p.x - style.w / 2}, ${p.y - style.h / 2})`}
                      onClick={() => setSelectedNode(p.node)}
                      className="cursor-pointer"
                    >
                      <rect
                        width={style.w}
                        height={style.h}
                        rx={style.h / 2}
                        fill={style.fill}
                        stroke={isSelected ? "#ffffff" : "none"}
                        strokeWidth={isSelected ? 2 : 0}
                      />
                      <foreignObject width={style.w} height={style.h}>
                        <div
                          style={{ color: style.text }}
                          className="w-full h-full flex items-center justify-center text-center text-xs font-medium px-2 truncate"
                          title={p.node.name}
                        >
                          {p.node.name}
                        </div>
                      </foreignObject>
                    </g>
                  );
                })}
              </g>
            </svg>
          </div>

          <div className="glass rounded-2xl p-6 h-fit sticky top-10">
            <p className="text-xs text-void-400 uppercase tracking-widest mb-2">
              {selectedNode ? "Selected" : "Click a node"}
            </p>
            {selectedNode ? (
              <>
                <h3 className="text-white font-semibold mb-3">{selectedNode.name}</h3>
                <p className="text-void-200 text-sm leading-relaxed">
                  {selectedNode.description || "No description available for this node."}
                </p>
              </>
            ) : (
              <p className="text-void-300 text-sm">
                Click any block in the diagram to read more about it here.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
