import type { App } from "../../../core/App";
import {
    type Entity,
    EntityHandle,
    type EntityTapEvent,
} from "../../../core/Entity";
import { Graph, GraphNode } from "../../../core/shape/Graph";
import { Point } from "../../../core/shape/Point";
import type { TransformMatrix } from "../../../core/shape/TransformMatrix";
import { assert } from "../../../lib/assert";
import { type ColorId, PROPERTY_KEY_COLOR_ID } from "../../property/Colors";
import {
    type FillStyle,
    PROPERTY_KEY_FILL_STYLE,
} from "../../property/FillStyle";
import {
    PROPERTY_KEY_STROKE_STYLE,
    type StrokeStyle,
} from "../../property/StrokeStyle";
import { PROPERTY_KEY_STROKE_WIDTH } from "../../property/StrokeWidth";

import type { ComponentType } from "react";
import { getMaxCornerRadius } from "../../../core/SelectEntityModeController";
import { SelectPathModeController } from "../../../core/SelectPathModeController";
import type { Shape } from "../../../core/shape/Shape";
import { PathView } from "./PathView";

export const PROPERTY_KEY_CORNER_RADIUS = "cornerRadius";
export const PROPERTY_KEY_ARROW_HEAD_NODE_IDS = "arrowHeadNodeIds";

export interface PathEntity extends Entity {
    readonly type: "path";
    readonly id: string;
    nodes: { id: string; x: number; y: number }[];
    edges: [string, string][];
    [PROPERTY_KEY_COLOR_ID]: ColorId;
    [PROPERTY_KEY_STROKE_STYLE]: StrokeStyle;
    [PROPERTY_KEY_STROKE_WIDTH]: number;
    [PROPERTY_KEY_FILL_STYLE]: FillStyle;
    [PROPERTY_KEY_CORNER_RADIUS]: number;
    [PROPERTY_KEY_ARROW_HEAD_NODE_IDS]: string[];
}

export class PathEntityHandle extends EntityHandle<PathEntity> {
    public readonly type = "path";

    getShape(entity: PathEntity): Shape {
        return PathEntityHandle.getGraph(entity);
    }

    getView(): ComponentType<{ entity: PathEntity }> {
        return PathView;
    }

    transform(entity: PathEntity, transform: TransformMatrix): PathEntity {
        const graph = PathEntityHandle.getGraph(entity);
        for (const node of graph.nodes.values()) {
            graph.setNodePosition(
                node.id,
                transform.apply(new Point(node.x, node.y)),
            );
        }

        return PathEntityHandle.setGraph(entity, graph);
    }

    static getNodes(entity: PathEntity): GraphNode[] {
        return entity.nodes.map(
            ({ id, x, y }) => new GraphNode(id, new Point(x, y)),
        );
    }

    static getNodeById(
        entity: PathEntity,
        nodeId: string,
    ): GraphNode | undefined {
        const data = entity.nodes.find((node) => node.id === nodeId);
        if (!data) return undefined;

        return new GraphNode(data.id, new Point(data.x, data.y));
    }

    static setNodePosition(
        entity: PathEntity,
        nodeId: string,
        position: Point,
    ): PathEntity {
        return {
            ...entity,
            nodes: entity.nodes.map((node) =>
                node.id === nodeId
                    ? { ...node, x: position.x, y: position.y }
                    : node,
            ),
        };
    }

    onTap(entity: PathEntity, app: App, ev: EntityTapEvent) {
        if (ev.previousSelectedEntities.has(entity.id)) {
            app.canvasStateStore.unselectAll();
            app.canvasStateStore.select(entity.id);
            app.setMode(SelectPathModeController.MODE_NAME);
        }
        // if (
        //     ev.previousSelectedEntities.size === 1 &&
        //     ev.previousSelectedEntities.has(this.props.id)
        // ) {
        //     const labelId = randomId();
        //     const label = new TextEntity({
        //         id: labelId,
        //         rect: Rect.fromSize(ev.point, 1, 1),
        //         content: "",
        //         [PROPERTY_KEY_SIZING_MODE]: "content",
        //         [PROPERTY_KEY_TEXT_ALIGNMENT_X]: "center",
        //         [PROPERTY_KEY_COLOR_ID]: 0,
        //     });
        //     const p0 = this.getNodes()[0];
        //     const p1 = this.getNodes()[1];
        //
        //     app.canvasStateStore.edit((draft) => {
        //         draft.setEntity(label);
        //         const linkToEdge = new LinkToEdge(
        //             randomId(),
        //             labelId,
        //             this.props.id,
        //             p0.id,
        //             p1.id,
        //         );
        //         draft.addLink(linkToEdge);
        //     });
        //
        //     app.canvasStateStore.unselectAll();
        //     app.canvasStateStore.select(label.props.id);
        //     app.setMode(EditTextModeController.createMode(label.props.id));
        // }
    }

    onTransformEnd(entity: PathEntity, app: App) {
        this.constraintCornerRadius(entity, app);
    }

    private constraintCornerRadius(entity: PathEntity, app: App) {
        const graph = PathEntityHandle.getGraph(entity);
        const maxCornerRadius = getMaxCornerRadius(graph.getOutline().points);
        if (maxCornerRadius < entity[PROPERTY_KEY_CORNER_RADIUS]) {
            app.canvasStateStore.edit((draft) => {
                draft.updateProperty(
                    [entity.id],
                    PROPERTY_KEY_CORNER_RADIUS,
                    maxCornerRadius,
                );
            });
        }
    }

    static getGraph(entity: PathEntity): Graph {
        const nodes = new Map<string, GraphNode>();
        for (const node of PathEntityHandle.getNodes(entity)) {
            nodes.set(
                node.id,
                new GraphNode(node.id, new Point(node.x, node.y)),
            );
        }

        const graph = Graph.create();
        for (const edge of entity.edges) {
            const node1 = nodes.get(edge[0]);
            assert(
                node1 !== undefined,
                `node ${edge[0]} is not found in path ${entity.id}`,
            );

            const node2 = nodes.get(edge[1]);
            assert(
                node2 !== undefined,
                `node ${edge[1]} is not found in path ${entity.id}`,
            );

            graph.addEdge(node1, node2);
        }

        return graph;
    }

    static setGraph(entity: PathEntity, graph: Graph): PathEntity {
        return {
            ...entity,
            nodes: [...graph.nodes.values()].map((node) => ({
                id: node.id,
                x: node.x,
                y: node.y,
            })),
            edges: graph.getEdges().map((edge) => [edge.p1.id, edge.p2.id]),
        };
    }
}

export function isPathEntity(entity: Entity): entity is PathEntity {
    return entity.type === "path";
}
