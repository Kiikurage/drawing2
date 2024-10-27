import { assert } from "../../lib/assert";
import { normalizeAngle } from "../../lib/normalizeAngle";
import { Line } from "./Line";
import { Point } from "./Point";
import { Polygon } from "./Polygon";
import { Shape } from "./Shape";

export class GraphNode extends Point {
    constructor(
        public readonly id: string,
        x: number,
        y: number,
    ) {
        super(x, y);
    }
}

/**
 * A graph node that is not defined explicitly, but inserted
 * as a cross point of two edges.
 */
export class CrossPoint extends GraphNode {
    constructor(
        public readonly p00: string,
        public readonly p01: string,
        public readonly p10: string,
        public readonly p11: string,
        x: number,
        y: number,
    ) {
        super(`${p00}-${p01}-${p10}-${p11}`, x, y);
    }
}

export class GraphEdge extends Line {
    public readonly id: string;
    public readonly p1: GraphNode;
    public readonly p2: GraphNode;

    constructor(p0: GraphNode, p1: GraphNode) {
        super(p0, p1);

        if (p0.id > p1.id) {
            this.p1 = p1;
            this.p2 = p0;
        } else {
            this.p1 = p0;
            this.p2 = p1;
        }

        this.id = `${this.p1.id}-${this.p2.id}`;
    }
}

/**
 * A graph that consists of nodes and edges.
 */
export class Graph extends Shape {
    private readonly arguments = new Map<string, Map<string, number>>();
    private normalized = false;

    constructor(
        public readonly nodes: Map<string, GraphNode>,
        private readonly edges: Map<string, string[]>,
    ) {
        super();
    }

    static create(): Graph {
        return new Graph(new Map(), new Map());
    }

    contain(point: Point): boolean {
        return this.getOutline().contain(point);
    }

    getEdges(): GraphEdge[] {
        const edges: GraphEdge[] = [];
        for (const [from, tos] of this.edges.entries()) {
            const fromNode = this.nodes.get(from);
            assert(fromNode !== undefined, `Node ${from} is not found.`);
            for (const to of tos) {
                if (from > to) continue;

                const toNode = this.nodes.get(to);
                assert(toNode !== undefined, `Node ${to} is not found.`);

                edges.push(new GraphEdge(fromNode, toNode));
            }
        }
        return edges;
    }

    clone(): Graph {
        const nodes = new Map<string, GraphNode>();
        const edges = new Map<string, string[]>();
        for (const [id, node] of this.nodes) {
            nodes.set(id, node);
        }
        for (const [id, edge] of this.edges) {
            edges.set(id, [...edge]);
        }
        return new Graph(nodes, edges);
    }

    /**
     * Merge two nodes. The source node will be deleted. All edges connected to the source node
     * will be reconnected to the destination node.
     * @param sourceNodeId
     * @param destNodeId
     */
    mergeNodes(sourceNodeId: string, destNodeId: string) {
        const destNode = this.nodes.get(destNodeId);
        assert(destNode !== undefined, `Node ${destNodeId} is not found.`);

        for (const otherNodeId of this.edges.get(sourceNodeId) ?? []) {
            if (otherNodeId === destNodeId) continue;

            const otherNode = this.nodes.get(otherNodeId);
            assert(
                otherNode !== undefined,
                `Node ${otherNodeId} is not found.`,
            );

            this.addEdge(otherNode, destNode);
        }

        this.deleteNode(sourceNodeId);
    }

    addEdge(node1: GraphNode, node2: GraphNode): Graph {
        if (this.edges.get(node1.id)?.includes(node2.id)) return this;

        this.nodes.set(node1.id, node1);
        this.nodes.set(node2.id, node2);

        this.edges.set(node1.id, [
            ...(this.edges.get(node1.id) ?? []),
            node2.id,
        ]);
        this.edges.set(node2.id, [
            ...(this.edges.get(node2.id) ?? []),
            node1.id,
        ]);

        this.normalized = false;
        return this;
    }

    deleteEdge(nodeId1: string, nodeId2: string): Graph {
        const newEdges1 = (this.edges.get(nodeId1) ?? []).filter(
            (id) => id !== nodeId2,
        );
        if (newEdges1.length === 0) {
            this.nodes.delete(nodeId1);
            this.edges.delete(nodeId1);
        } else {
            this.edges.set(nodeId1, newEdges1);
        }

        const newEdges2 = (this.edges.get(nodeId2) ?? []).filter(
            (id) => id !== nodeId1,
        );
        if (newEdges2.length === 0) {
            this.nodes.delete(nodeId2);
            this.edges.delete(nodeId2);
        } else {
            this.edges.set(nodeId2, newEdges2);
        }

        this.normalized = false;
        return this;
    }

    deleteNode(nodeId: string): Graph {
        this.nodes.delete(nodeId);
        const nextNodeIds = this.edges.get(nodeId);
        for (const nextNodeId of nextNodeIds ?? []) {
            const newEdges = (this.edges.get(nextNodeId) ?? []).filter(
                (id) => id !== nodeId,
            );
            if (newEdges.length === 0) {
                this.nodes.delete(nextNodeId);
                this.edges.delete(nextNodeId);
            } else {
                this.edges.set(nextNodeId, newEdges);
            }
        }
        this.edges.delete(nodeId);

        this.normalized = false;
        return this;
    }

    setNodePosition(nodeId: string, x: number, y: number): Graph {
        const node = this.nodes.get(nodeId);
        assert(node !== undefined, `Node ${nodeId} is not found.`);

        const newNode = new GraphNode(nodeId, x, y);
        this.nodes.set(nodeId, newNode);

        this.normalized = false;
        return this;
    }

    /**
     * Return the argument (偏角) from X-axis to the line segment.
     */
    getArgument(p0Id: string, p1Id: string): number {
        assert(p0Id !== p1Id, `from and to should be different: ${p0Id}`);
        if (p0Id > p1Id) {
            return normalizeAngle(this.getArgument(p1Id, p0Id) + Math.PI);
        }

        let value = this.arguments.get(p0Id)?.get(p1Id);
        if (value === undefined) {
            const p0 = this.nodes.get(p0Id);
            assert(p0 !== undefined, `Node ${p0Id} is not found.`);

            const p1 = this.nodes.get(p1Id);
            assert(p1 !== undefined, `Node ${p1Id} is not found.`);

            value = normalizeAngle(Math.atan2(p1.y - p0.y, p1.x - p0.x));
            if (!this.arguments.has(p0Id)) {
                this.arguments.set(p0Id, new Map());
            }
            this.arguments.get(p0Id)?.set(p1Id, value);
        }

        return value;
    }

    getOutline(): GraphPolygon {
        if (!this.normalized) {
            return this.normalize().getOutline();
        }

        if (this.nodes.size < 3)
            return new GraphPolygon([...this.nodes.values()]);

        const startNode = [...this.nodes.values()].reduce((n1, n2) =>
            n1.y < n2.y ? n1 : n2,
        );
        let lastNode = startNode;
        const nodes: GraphNode[] = [startNode];

        while (true) {
            const node = this.getNodeBySmallestAngle(
                lastNode.id,
                nodes.length < 2
                    ? 0
                    : this.getArgument(
                          nodes[nodes.length - 1].id,
                          nodes[nodes.length - 2].id,
                      ),
            );
            if (node === startNode) break;

            nodes.push(node);
            lastNode = node;
        }

        return new GraphPolygon(canonicalizeFace(nodes));
    }

    getNodeBySmallestAngle(nodeId: string, startAngle: number): GraphNode {
        const nextNodeIds = this.edges.get(nodeId);
        assert(nextNodeIds !== undefined, `Node ${nodeId} is not found.`);

        let bestAngle = normalizeAngle(
            this.getArgument(nodeId, nextNodeIds[0]) - startAngle,
        );
        if (bestAngle === 0) {
            bestAngle = 2 * Math.PI;
        }
        let bestNode = this.nodes.get(nextNodeIds[0]);
        assert(bestNode !== undefined, `Node ${nextNodeIds[0]} is not found.`);
        for (const nextNodeId of nextNodeIds.slice(1)) {
            const nextNode = this.nodes.get(nextNodeId);
            assert(nextNode !== undefined, `Node ${nextNodeId} is not found.`);

            let angle = normalizeAngle(
                this.getArgument(nodeId, nextNode.id) - startAngle,
            );
            if (angle === 0) {
                angle = 2 * Math.PI;
            }

            if (angle < bestAngle) {
                bestNode = nextNode;
                bestAngle = angle;
            }
        }

        return bestNode;
    }

    normalize(): Graph {
        if (this.normalized) return this;
        const clone = this.clone();

        const edges = new Set(clone.getEdges());
        const queue = new Set(edges);

        const newNodesMap = new Map<GraphEdge, GraphNode[]>();

        while (queue.size > 0) {
            const edge1 = queue.values().next().value;
            assert(edge1 !== undefined, "Empty queue");
            queue.delete(edge1);

            for (const edge2 of edges) {
                if (edge1 === edge2) continue;
                if (edge1.p1.id > edge2.p1.id) continue;

                if (edge1.p1 === edge2.p1) continue;
                if (edge1.p1 === edge2.p2) continue;
                if (edge1.p2 === edge2.p1) continue;
                if (edge1.p2 === edge2.p2) continue;

                if (isCross(edge1.p1, edge1.p2, edge2.p1, edge2.p2)) {
                    const crossPoint = getCrossPoint(
                        edge1.p1,
                        edge1.p2,
                        edge2.p1,
                        edge2.p2,
                    );

                    newNodesMap.set(edge1, [
                        ...(newNodesMap.get(edge1) ?? []),
                        crossPoint,
                    ]);
                    newNodesMap.set(edge2, [
                        ...(newNodesMap.get(edge2) ?? []),
                        crossPoint,
                    ]);
                }
            }
        }

        for (const [edge, newNodes] of newNodesMap.entries()) {
            newNodes.sort((n1, n2) =>
                n1.x === n2.x ? n1.y - n2.y : n1.x - n2.x,
            );
            if (
                edge.p1.x < edge.p2.x ||
                (edge.p1.x === edge.p2.x && edge.p1.y < edge.p2.y)
            ) {
                newNodes.unshift(edge.p1);
                newNodes.push(edge.p2);
            } else {
                newNodes.unshift(edge.p2);
                newNodes.push(edge.p1);
            }

            clone.deleteEdge(edge.p1.id, edge.p2.id);
            for (let i = 0; i < newNodes.length - 1; i++) {
                clone.addEdge(newNodes[i], newNodes[i + 1]);
            }
        }

        const nodeIdsToBeDeleted = new Set<string>();
        let flagDirty = true;
        while (flagDirty) {
            flagDirty = false;

            for (const node of clone.nodes.values()) {
                if (nodeIdsToBeDeleted.has(node.id)) continue;

                const nextNodeIds = clone.edges
                    .get(node.id)
                    ?.filter(
                        (nextNodeId) => !nodeIdsToBeDeleted.has(nextNodeId),
                    );
                if (nextNodeIds === undefined || nextNodeIds.length <= 1) {
                    nodeIdsToBeDeleted.add(node.id);
                    flagDirty = true;
                }
            }
        }

        for (const nodeId of nodeIdsToBeDeleted) {
            clone.deleteNode(nodeId);
        }

        clone.normalized = true;
        return clone;
    }
}

/**
 * Check if two line segments cross each other.
 * @param p00 The start point of the first line segment.
 * @param p01 The end point of the first line segment.
 * @param p10 The start point of the second line segment.
 * @param p11 The end point of the second line segment.
 */
function isCross(p00: Point, p01: Point, p10: Point, p11: Point): boolean {
    const dx0001 = p01.x - p00.x;
    const dy0001 = p01.y - p00.y;

    const dx1011 = p11.x - p10.x;
    const dy1011 = p11.y - p10.y;

    const dx0010 = p10.x - p00.x;
    const dy0010 = p10.y - p00.y;

    const dx0011 = p11.x - p00.x;
    const dy0011 = p11.y - p00.y;

    const dx1000 = p00.x - p10.x;
    const dy1000 = p00.y - p10.y;

    const dx1001 = p01.x - p10.x;
    const dy1001 = p01.y - p10.y;

    const cross00010010 = dx0001 * dy0010 - dy0001 * dx0010;
    const cross00010011 = dx0001 * dy0011 - dy0001 * dx0011;
    const cross10111000 = dx1011 * dy1000 - dy1011 * dx1000;
    const cross10111001 = dx1011 * dy1001 - dy1011 * dx1001;

    return (
        cross00010010 * cross00010011 < 0 && cross10111000 * cross10111001 < 0
    );
}

function getCrossPoint(
    p00: GraphNode,
    p01: GraphNode,
    p10: GraphNode,
    p11: GraphNode,
): GraphNode {
    const dx1011 = p11.x - p10.x;
    const dy1011 = p11.y - p10.y;

    const dx1000 = p00.x - p10.x;
    const dy1000 = p00.y - p10.y;
    const cross_v1000_v1011 = Math.abs(dx1000 * dy1011 - dy1000 * dx1011);

    const dx1001 = p01.x - p10.x;
    const dy1001 = p01.y - p10.y;
    const cross_v1001_v1011 = Math.abs(dx1001 * dy1011 - dy1001 * dx1011);

    const x =
        p10.x +
        (cross_v1001_v1011 * dx1000 + cross_v1000_v1011 * dx1001) /
            (cross_v1000_v1011 + cross_v1001_v1011);
    const y =
        p10.y +
        (cross_v1001_v1011 * dy1000 + cross_v1000_v1011 * dy1001) /
            (cross_v1000_v1011 + cross_v1001_v1011);

    return new CrossPoint(p00.id, p01.id, p10.id, p11.id, x, y);
}

export function getEdgeId(p0: string, p1: string): string {
    return p0 < p1 ? `${p0}-${p1}` : `${p1}-${p0}`;
}

function canonicalizeFace(face: GraphNode[]): GraphNode[] {
    const startNode = face.reduce((n1, n2) => (n1.y < n2.y ? n1 : n2));
    const startIndex = face.indexOf(startNode);
    return [...face.slice(startIndex), ...face.slice(0, startIndex)];
}

export class GraphPolygon extends Polygon {
    constructor(public readonly points: GraphNode[]) {
        super(points);
    }
}