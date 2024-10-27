import { PathEntity } from "../default/entity/PathEntity/PathEntity";
import { registerLinkToRect } from "../default/mode/NewPathModeController";
import { assert } from "../lib/assert";
import { isNotNullish } from "../lib/isNullish";
import { testHitEntities } from "../lib/testHitEntities";
import type { App } from "./App";
import type { Entity } from "./Entity";
import type { CanvasPointerMoveEvent } from "./GestureRecognizer";
import type { GraphNode } from "./Graph";
import { LinkToRect } from "./Link";
import type { CanvasPointerEvent } from "./ModeController";
import { Line } from "./geo/Line";
import { Point } from "./geo/Point";
import { translate } from "./geo/TransformMatrix";
import { type AdjustAngleConstraintMode, adjustAngle } from "./geo/adjustAngle";

const OVERLAP_NODE_THRESHOLD = 8;
const SNAP_DISTANCE_THRESHOLD = 8;
const SNAP_GUIDE_KEY_ANGLE = "editPath-angle";
const SNAP_GUIDE_X_AXIS = "editPath-xAxis";
const SNAP_GUIDE_Y_AXIS = "editPath-yAxis";

export function setupMoveNodesPointerEventHandlers(
    app: App,
    ev: CanvasPointerEvent,
    entity: Entity,
    nodeIds: string[],
) {
    app.historyManager.pause();
    assert(entity instanceof PathEntity);

    const originalNodes = nodeIds
        .map((nodeId) => entity.getNodeById(nodeId))
        .filter(isNotNullish);

    const oldLinkIds = app.canvasStateStore
        .getState()
        .page.links.getByEntityId(entity.props.id)
        .filter((link) => link instanceof LinkToRect)
        .filter((link) => nodeIds.includes(link.nodeId))
        .map((link) => link.id);

    app.canvasStateStore.edit((draft) => draft.deleteLinks(oldLinkIds));

    app.gestureRecognizer
        .addPointerMoveHandler(
            ev.pointerId,
            getPointerMoveHandler(entity.props.id, nodeIds, originalNodes),
        )
        .addPointerUpHandler(
            ev.pointerId,
            getPointerUpHandler(entity.props.id, nodeIds),
        );
}

function getPointerMoveHandler(
    entityId: string,
    nodeIds: string[],
    originalNodes: GraphNode[],
) {
    return (app: App, ev: CanvasPointerMoveEvent) => {
        let transform = translate(
            ev.point.x - ev.startPoint.x,
            ev.point.y - ev.startPoint.y,
        );

        const entity = app.canvasStateStore
            .getState()
            .page.entities.get(entityId);
        assert(entity !== undefined, `Entity not found: ${entityId}`);
        assert(entity instanceof PathEntity);

        const nodes = entity.getNodes();

        // snap
        const xSnapResult = {
            score: SNAP_DISTANCE_THRESHOLD,
            distance: Number.POSITIVE_INFINITY,
            points: {} as { [originalNodeId: string]: Point[] },
        };
        const ySnapResult = {
            score: SNAP_DISTANCE_THRESHOLD,
            distance: Number.POSITIVE_INFINITY,
            points: {} as { [originalNodeId: string]: Point[] },
        };
        const otherNodes = nodes.filter((node) => !nodeIds.includes(node.id));
        for (const originalNode of originalNodes) {
            const newPoint = transform.apply(originalNode);
            const snapPointsX: Point[] = [];
            const snapPointsY: Point[] = [];

            for (const otherNode of otherNodes) {
                const distanceX = otherNode.x - newPoint.x;
                const scoreX = Math.abs(distanceX);
                if (scoreX < xSnapResult.score) {
                    xSnapResult.distance = distanceX;
                    xSnapResult.score = scoreX;
                    xSnapResult.points = {};
                    snapPointsX.push(otherNode);
                } else if (distanceX === xSnapResult.distance) {
                    snapPointsX.push(otherNode);
                }

                const distanceY = otherNode.y - newPoint.y;
                const scoreY = Math.abs(distanceY);
                if (scoreY < ySnapResult.score) {
                    ySnapResult.distance = distanceY;
                    ySnapResult.score = scoreY;
                    ySnapResult.points = {};
                    snapPointsY.push(otherNode);
                } else if (distanceY === ySnapResult.distance) {
                    snapPointsY.push(otherNode);
                }
            }

            if (snapPointsX.length > 0) {
                xSnapResult.points[originalNode.id] = snapPointsX;
            }
            if (snapPointsY.length > 0) {
                ySnapResult.points[originalNode.id] = snapPointsY;
            }
        }

        if (xSnapResult.score < SNAP_DISTANCE_THRESHOLD) {
            transform = transform.translate(xSnapResult.distance, 0);
        }
        if (ySnapResult.distance < SNAP_DISTANCE_THRESHOLD) {
            transform = transform.translate(0, ySnapResult.distance);
        }

        // constraint
        if (ev.shiftKey) {
            let constraintMode: AdjustAngleConstraintMode;
            if (
                xSnapResult.score < SNAP_DISTANCE_THRESHOLD &&
                ySnapResult.score < SNAP_DISTANCE_THRESHOLD
            ) {
                if (xSnapResult.distance < ySnapResult.distance) {
                    constraintMode = "keep-x";
                    ySnapResult.points = {};
                } else {
                    constraintMode = "keep-y";
                    xSnapResult.points = {};
                }
            } else if (xSnapResult.distance < SNAP_DISTANCE_THRESHOLD) {
                constraintMode = "keep-x";
                ySnapResult.points = {};
            } else if (ySnapResult.distance < SNAP_DISTANCE_THRESHOLD) {
                constraintMode = "keep-y";
                xSnapResult.points = {};
            } else {
                constraintMode = "none";
            }

            const originalNode0 = originalNodes[0];
            const newPoint0 = transform.apply(originalNode0);
            const adjustedNewPoint0 = adjustAngle(
                originalNode0,
                newPoint0,
                0,
                Math.PI / 4,
                constraintMode,
            );

            transform = transform.translate(
                adjustedNewPoint0.x - newPoint0.x,
                adjustedNewPoint0.y - newPoint0.y,
            );
        }

        // snap guide
        if (ev.shiftKey) {
            const points: Point[] = [];
            const lines: Line[] = [];

            for (const nodeId of nodeIds) {
                const originalNode = originalNodes.find(
                    (node) => node.id === nodeId,
                );
                assert(originalNode !== undefined);
                const newPoint = transform.apply(originalNode);
                points.push(originalNode, newPoint);
                lines.push(new Line(originalNode, newPoint));
            }

            app.snapGuideStore.setSnapGuide(SNAP_GUIDE_KEY_ANGLE, {
                points,
                lines,
            });
        } else {
            app.snapGuideStore.deleteSnapGuide(SNAP_GUIDE_KEY_ANGLE);
        }

        const xSnapGuidePoints: Point[] = [];
        const xSnapGuideLines: Line[] = [];
        for (const [originalNodeId, snapPoints] of Object.entries(
            xSnapResult.points,
        )) {
            const originalNode = originalNodes.find(
                (node) => node.id === originalNodeId,
            );
            assert(originalNode !== undefined);
            const newNode = transform.apply(originalNode);

            xSnapGuidePoints.push(newNode, ...snapPoints);
            const points = [newNode, ...snapPoints];

            const yMin = Math.min(...points.map((p) => p.y));
            const yMax = Math.max(...points.map((p) => p.y));
            xSnapGuideLines.push(
                new Line(
                    new Point(newNode.x, yMin),
                    new Point(newNode.x, yMax),
                ),
            );
        }
        if (xSnapGuidePoints.length > 0) {
            app.snapGuideStore.setSnapGuide(SNAP_GUIDE_X_AXIS, {
                points: xSnapGuidePoints,
                lines: xSnapGuideLines,
            });
        } else {
            app.snapGuideStore.deleteSnapGuide(SNAP_GUIDE_X_AXIS);
        }

        const ySnapGuidePoints: Point[] = [];
        const ySnapGuideLines: Line[] = [];
        for (const [originalNodeId, snapPoints] of Object.entries(
            ySnapResult.points,
        )) {
            const originalNode = originalNodes.find(
                (node) => node.id === originalNodeId,
            );
            assert(originalNode !== undefined);
            const newNode = transform.apply(originalNode);
            const points = [newNode, ...snapPoints];

            ySnapGuidePoints.push(...points);

            const xMin = Math.min(...points.map((p) => p.x));
            const xMax = Math.max(...points.map((p) => p.x));
            ySnapGuideLines.push(
                new Line(
                    new Point(xMin, newNode.y),
                    new Point(xMax, newNode.y),
                ),
            );
        }
        if (ySnapGuidePoints.length > 0) {
            app.snapGuideStore.setSnapGuide(SNAP_GUIDE_Y_AXIS, {
                points: ySnapGuidePoints,
                lines: ySnapGuideLines,
            });
        } else {
            app.snapGuideStore.deleteSnapGuide(SNAP_GUIDE_Y_AXIS);
        }

        app.canvasStateStore.edit((draft) => {
            for (const originalNode of originalNodes) {
                draft.setPointPosition(
                    entity.props.id,
                    originalNode.id,
                    transform.apply(originalNode),
                );
            }
        });
    };
}

function getPointerUpHandler(entityId: string, nodeIds: string[]) {
    return (app: App, ev: CanvasPointerEvent) => {
        const entity = app.canvasStateStore
            .getState()
            .page.entities.get(entityId);
        assert(entity !== undefined, `Entity not found: ${entityId}`);
        assert(entity instanceof PathEntity);

        const overlappedNodePairs: [GraphNode, GraphNode][] = [];

        for (const nodeId of nodeIds) {
            const nodes = entity.getNodes();
            const targetNode = nodes.find((node) => node.id === nodeId);
            assert(targetNode !== undefined);
            const otherNodes = nodes.filter((node) => node.id !== nodeId);

            // Merge overlap nodes
            for (const otherNode of otherNodes) {
                const distance = Math.hypot(
                    otherNode.x - ev.point.x,
                    otherNode.y - ev.point.y,
                );
                if (distance < OVERLAP_NODE_THRESHOLD) {
                    overlappedNodePairs.push([otherNode, targetNode]);
                }
            }
            if (overlappedNodePairs.length > 0) {
                const graph = entity.graph.clone();
                for (const [otherNode, targetNode] of overlappedNodePairs) {
                    graph.mergeNodes(otherNode.id, targetNode.id);
                }
                const newEntity = new PathEntity(entity.props, graph);
                app.canvasStateStore.edit((draft) => {
                    draft.setEntities([newEntity]);
                });
            }
        }

        // Link to other entity
        if (nodeIds.length === 1) {
            const targetNode = entity
                .getNodes()
                .find((node) => node.id === nodeIds[0]);
            assert(targetNode !== undefined, `Node not found: ${nodeIds[0]}`);

            const hit = testHitEntities(
                app.canvasStateStore.getState().page,
                ev.point,
                app.viewportStore.getState().scale,
            );
            if (hit.entities.length > 0) {
                const { target } = hit.entities[0];

                registerLinkToRect(app, entity, targetNode, target);
            }
        }

        app.historyManager.resume();
        app.snapGuideStore.deleteSnapGuide(SNAP_GUIDE_KEY_ANGLE);
        app.snapGuideStore.deleteSnapGuide(SNAP_GUIDE_X_AXIS);
        app.snapGuideStore.deleteSnapGuide(SNAP_GUIDE_Y_AXIS);
    };
}
