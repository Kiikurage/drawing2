import type { Property } from "csstype";
import {
    type PathEntity,
    PathEntityHandle,
    isPathEntity,
} from "../../default/entity/PathEntity/PathEntity";
import { assert } from "../../lib/assert";
import { randomId } from "../../lib/randomId";
import type { App } from "../App";
import {
    type CanvasPointerEvent,
    type ModeChangeEvent,
    ModeController,
    type SelectedEntityChangeEvent,
} from "../ModeController";
import { cell } from "../cell/ICell";
import { type GraphEdge, GraphNode } from "../shape/Graph";
import { Line } from "../shape/Line";
import { Point } from "../shape/Point";
import { MoveNodeModeController } from "./MoveNodeModeController";
import { SelectEntityModeController } from "./SelectEntityModeController";

const NODE_CONTROL_HIT_AREA_MARGIN = 16;
const EDGE_CONTROL_HIT_AREA_MARGIN = 16;

export class SelectPathModeController extends ModeController {
    static readonly type = "select-path";

    readonly selectedEdgeIds = cell(new Set<string>());
    readonly selectedNodeIds = cell(new Set<string>());

    onRegistered(app: App) {
        app.keyboard.addBinding({
            key: "Escape",
            mode: [SelectPathModeController.type],
            action: (app, ev) => {
                app.setMode(SelectEntityModeController.type);
            },
        });
        app.keyboard.addBinding({
            key: "Delete",
            mode: [SelectPathModeController.type],
            action: (app, ev) => this.deleteSelectedItem(app),
        });
        app.keyboard.addBinding({
            key: "Backspace",
            mode: [SelectPathModeController.type],
            action: (app, ev) => this.deleteSelectedItem(app),
        });
    }

    deleteSelectedItem(app: App) {
        const selectedEdgeIds = this.selectedEdgeIds.get();
        const selectedNodeIds = this.selectedNodeIds.get();

        const entityIds = app.canvas.selectedEntityIds.get();

        app.canvas.edit((builder) => {
            for (const entityId of entityIds) {
                const entity = builder.getEntity(entityId);
                assert(isPathEntity(entity), `Invalid entity: ${entity}`);

                const graph = PathEntityHandle.getGraph(entity);
                const edges = graph
                    .getEdges()
                    .filter((edge) => selectedEdgeIds.has(edge.id));
                for (const edge of edges) {
                    graph.deleteEdge(edge.p1.id, edge.p2.id);
                }
                for (const nodeId of selectedNodeIds) {
                    graph.deleteNode(nodeId);
                }
                if (graph.edges.size === 0) {
                    builder.deleteEntity(entityId);
                } else {
                    builder.setEntities([
                        PathEntityHandle.setGraph(entity, graph),
                    ]);
                }
            }
        });
    }

    onAfterEnterMode(app: App, ev: ModeChangeEvent) {
        app.cursor.set(this.getCursor(app));
    }

    onPointerDown(app: App, ev: CanvasPointerEvent): void {
        const control = SelectPathModeController.getControlByPoint(
            app,
            ev.point,
        );
        if (control === null) {
            this.selectedEdgeIds.set(new Set());
            this.selectedNodeIds.set(new Set());
            app.setMode(SelectEntityModeController.type);
            return;
        }

        if (control.type === "node") {
            this.selectedEdgeIds.set(new Set());
            this.selectedNodeIds.set(new Set([control.node.id]));
            app.history.addCheckpoint();
            app.setMode(MoveNodeModeController.type);
        }

        if (control.type === "edge") {
            this.selectedEdgeIds.set(new Set([control.edge.id]));
            this.selectedNodeIds.set(new Set());
            app.history.addCheckpoint();
            app.setMode(MoveNodeModeController.type);
        }

        if (control.type === "center-of-edge") {
            const newNode = new GraphNode(randomId(), control.point);

            const graph = PathEntityHandle.getGraph(control.path);
            graph.addEdge(control.edge.p1, newNode);
            graph.addEdge(control.edge.p2, newNode);
            graph.deleteEdge(control.edge.p1.id, control.edge.p2.id);

            const newPath = PathEntityHandle.setGraph(control.path, graph);

            app.history.addCheckpoint();
            app.canvas.edit((builder) => builder.setEntities([newPath]));

            this.selectedEdgeIds.set(new Set());
            this.selectedNodeIds.set(new Set([newNode.id]));
            app.setMode(MoveNodeModeController.type);
        }
    }

    onPointerMove(app: App, ev: CanvasPointerEvent) {
        app.cursor.set(this.getCursor(app));
    }

    onBeforeSelectedEntitiesChange(app: App, ev: SelectedEntityChangeEvent) {
        this.updateSelectedItemState(
            ev.oldSelectedEntityIds,
            ev.newSelectedEntityIds,
        );
    }

    onAfterSelectedEntitiesChange(app: App, ev: SelectedEntityChangeEvent) {
        if (ev.newSelectedEntityIds.size === 0) {
            app.setMode(SelectEntityModeController.type);
        }
    }

    static computeControlLayerData(
        app: App,
        pointerPoint: Point,
    ): {
        edges: GraphEdge[];
        nodes: GraphNode[];
        highlightedItemIds: Set<string>;
        highlightCenterOfEdgeHandle: boolean;
    } {
        const path =
            SelectPathModeController.getSelectedSinglePathEntityOrNull(app);
        if (path === null) {
            return {
                edges: [],
                nodes: [],
                highlightedItemIds: new Set(),
                highlightCenterOfEdgeHandle: false,
            };
        }

        const control = SelectPathModeController.getControlByPoint(
            app,
            pointerPoint,
        );
        if (control === null) {
            const graph = PathEntityHandle.getGraph(path);
            return {
                edges: graph.getEdges(),
                nodes: Array.from(graph.nodes.values()),
                highlightedItemIds: new Set(),
                highlightCenterOfEdgeHandle: false,
            };
        }

        switch (control.type) {
            case "node": {
                const graph = PathEntityHandle.getGraph(path);
                return {
                    edges: graph.getEdges(),
                    nodes: Array.from(graph.nodes.values()),
                    highlightedItemIds: new Set([control.node.id]),
                    highlightCenterOfEdgeHandle: false,
                };
            }
            case "edge": {
                const graph = PathEntityHandle.getGraph(path);
                return {
                    edges: graph.getEdges(),
                    nodes: Array.from(graph.nodes.values()),
                    highlightedItemIds: new Set([control.edge.id]),
                    highlightCenterOfEdgeHandle: false,
                };
            }
            case "center-of-edge": {
                const graph = PathEntityHandle.getGraph(path);
                return {
                    edges: graph.getEdges(),
                    nodes: Array.from(graph.nodes.values()),
                    highlightedItemIds: new Set([control.edge.id]),
                    highlightCenterOfEdgeHandle: true,
                };
            }
        }
    }

    static getControlByPoint(app: App, point: Point): Control | null {
        const nodeControlMargin =
            NODE_CONTROL_HIT_AREA_MARGIN / app.viewport.get().scale;
        const edgeControlMargin =
            EDGE_CONTROL_HIT_AREA_MARGIN / app.viewport.get().scale;

        const entities = app.canvas.selectedEntities.get();
        if (entities.length !== 1) return null;

        const path = entities[0];
        if (!isPathEntity(path)) return null;

        const graph = PathEntityHandle.getGraph(path);

        for (const node of graph.nodes.values()) {
            const distance = Math.hypot(node.x - point.x, node.y - point.y);
            if (distance < nodeControlMargin) {
                return { type: "node", path, node };
            }
        }

        for (const edge of graph.getEdges()) {
            const { p1, p2 } = edge;
            const center = new Point((p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
            const distance = Math.hypot(center.x - point.x, center.y - point.y);
            if (distance < edgeControlMargin) {
                return { type: "center-of-edge", path, edge, point: center };
            }

            const entry = Line.of(p1.x, p1.y, p2.x, p2.y).getDistance(point);

            if (entry.distance < edgeControlMargin) {
                return { type: "edge", path, edge, point: entry.point };
            }
        }

        return null;
    }

    static getSelectedSinglePathEntityOrNull(app: App): PathEntity | null {
        const entities = app.canvas.selectedEntities.get();
        if (entities.length !== 1) return null;

        const path = entities[0];
        if (!isPathEntity(path)) return null;

        return path;
    }

    private updateSelectedItemState(
        oldSelectedEntityIds: ReadonlySet<string>,
        newSelectedEntityIds: ReadonlySet<string>,
    ) {
        if (
            oldSelectedEntityIds.size !== 1 ||
            newSelectedEntityIds.size !== 1 ||
            oldSelectedEntityIds.values().next().value !==
                newSelectedEntityIds.values().next().value
        ) {
            this.selectedEdgeIds.set(new Set());
            this.selectedNodeIds.set(new Set());
            return;
        }
    }

    private getCursor(app: App): Property.Cursor {
        const control = SelectPathModeController.getControlByPoint(
            app,
            app.pointerPosition.get(),
        );
        if (control === null) return "default";

        switch (control.type) {
            case "node":
            case "edge":
                return "grab";
            case "center-of-edge":
                return "crosshair";
        }
    }
}

export type Control =
    | { type: "edge"; path: PathEntity; edge: GraphEdge; point: Point }
    | {
          type: "center-of-edge";
          path: PathEntity;
          edge: GraphEdge;
          point: Point;
      }
    | { type: "node"; path: PathEntity; node: GraphNode };
