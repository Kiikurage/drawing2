import type { Property } from "csstype";
import {
    PROPERTY_KEY_ARROW_HEAD_NODE_IDS,
    PROPERTY_KEY_CORNER_RADIUS,
    type PathEntity,
    PathEntityHandle,
    isPathEntity,
} from "../default/entity/PathEntity/PathEntity";
import { NewTextModeController } from "../default/mode/NewTextModeController";
import { assert } from "../lib/assert";
import { normalizeAngle } from "../lib/normalizeAngle";
import { testHitEntities } from "../lib/testHitEntities";
import type { App } from "./App";
import type { Entity } from "./Entity";
import { type CanvasPointerEvent, ModeController } from "./ModeController";
import {
    ScaleSelectionTransformController,
    TranslateSelectionTransformController,
} from "./SelectionTransformController";
import { type ICell, cell, derived } from "./cell/ICell";
import { setupBrushSelectPointerEventHandlers } from "./setupBrushSelectPointerEventHandlers";
import { setupCornerRadiusHandlePointerEventHandlers } from "./setupCornerRadiusHandlePointerEventHandlers";
import { setupSelectionTransformPointerEventHandlers } from "./setupSelectionTransformPointerEventHandlers";
import type { GraphNode } from "./shape/Graph";
import { Point } from "./shape/Point";
import type { Rect } from "./shape/Shape";

export class SelectEntityModeController extends ModeController {
    static readonly type = "select-entity";

    readonly brushRect = cell<Rect | null>(null);
    readonly controlLayerData: ICell<CornerRoundHandleData[]>;

    constructor(readonly app: App) {
        super();

        // Static initializer doesn't work since this depends on this.app
        this.controlLayerData = derived(() => {
            const pointerPosition = this.app.pointerPosition.get();
            const selectedEntities = this.app.canvas.selectedEntities.get();

            if (
                selectedEntities.length !== 1 ||
                !isPathEntity(selectedEntities[0])
            ) {
                return [];
            }
            const entity = selectedEntities[0];

            const handles = getCornerRoundHandleData(
                PathEntityHandle.getGraph(entity).getOutline().points,
                entity[PROPERTY_KEY_CORNER_RADIUS],
            );

            const visibleHandles: CornerRoundHandleData[] = [];
            for (const handle of handles) {
                if (
                    isPointInTriangle(pointerPosition, [
                        handle.previousNode,
                        handle.node,
                        handle.nextNode,
                    ])
                ) {
                    visibleHandles.push(handle);
                }
            }

            return visibleHandles;
        });
    }

    onRegistered(app: App): void {
        app.keyboard.addBinding({
            key: "a",
            metaKey: true,
            action: (app, ev) => {
                app.setMode(SelectEntityModeController.type);
                app.canvas.selectAll();
            },
        });
        app.keyboard.addBinding({
            key: "a",
            ctrlKey: true,
            action: (app, ev) => {
                app.setMode(SelectEntityModeController.type);
                app.canvas.selectAll();
            },
        });

        app.keyboard.addBinding({
            key: "Escape",
            mode: [SelectEntityModeController.type],
            action: (app, ev) => {
                app.canvas.unselectAll();
            },
        });
        app.keyboard.addBinding({
            key: "Backspace",
            mode: [SelectEntityModeController.type],
            action: (app, ev) => {
                app.deleteSelectedEntities();
            },
        });
        app.keyboard.addBinding({
            key: "Delete",
            mode: [SelectEntityModeController.type],
            action: (app, ev) => {
                app.deleteSelectedEntities();
            },
        });

        app.contextMenu.add({
            title: "最前面へ",
            action: () => {
                app.bringToFront();
            },
        });
        app.contextMenu.add({
            title: "ひとつ前へ",
            action: () => {
                app.bringForward();
            },
        });
        app.contextMenu.add({
            title: "ひとつ後ろへ",
            action: () => {
                app.sendBackward();
            },
        });
        app.contextMenu.add({
            title: "最背面へ",
            action: () => {
                app.sendToBack();
            },
        });
        app.contextMenu.add({
            title: "線の端を矢印に",
            action: () => {
                const entities = app.canvas.selectedEntities.get();
                app.canvas.edit((draft) => {
                    for (const entity of entities) {
                        if (!isPathEntity(entity)) continue;
                        const nodeIds = [
                            ...PathEntityHandle.getGraph(
                                entity,
                            ).edges.entries(),
                        ]
                            .filter(([nodeId, childIds]) => {
                                return childIds.length === 1;
                            })
                            .map(([nodeId, childIds]) => nodeId);

                        draft.updateProperty(
                            [entity.id],
                            PROPERTY_KEY_ARROW_HEAD_NODE_IDS,
                            nodeIds,
                        );
                    }
                });
            },
        });
        app.contextMenu.add({
            title: "線の端の矢印を消す",
            action: () => {
                const selectedEntityIds = app.canvas.selectedEntityIds.get();
                app.canvas.edit((draft) => {
                    draft.updateProperty(
                        [...selectedEntityIds],
                        PROPERTY_KEY_ARROW_HEAD_NODE_IDS,
                        [],
                    );
                });
            },
        });
    }

    onCanvasPointerDown(app: App, ev: CanvasPointerEvent): void {
        const handle = this.getHandleType(app, ev.point);
        if (handle !== null) {
            this.onSelectionPointerDown(app, ev, handle);
            return;
        }

        const hitResult = testHitEntities(
            app.canvas.page.get(),
            ev.point,
            app.viewport.get().scale,
            app.entityHandle,
        );
        const result = hitResult.entities.at(0);
        if (result !== undefined) {
            this.onEntityPointerDown(app, ev, result.target);
            return;
        }

        if (!ev.shiftKey) app.canvas.unselectAll();

        setupBrushSelectPointerEventHandlers(app, ev, this.brushRect);
    }

    onCanvasDoubleClick(app: App, ev: CanvasPointerEvent) {
        app.setMode(NewTextModeController.type);
        app.getModeController().onCanvasPointerDown(app, ev);
    }

    getCursor(app: App): Property.Cursor {
        const handle = this.getHandleType(app, app.pointerPosition.get());
        if (handle !== null) {
            switch (handle.type) {
                case "TopLeftHandle":
                case "BottomRightHandle":
                    return "nwse-resize";
                case "TopHandle":
                case "BottomHandle":
                    return "ns-resize";
                case "TopRightHandle":
                case "BottomLeftHandle":
                    return "nesw-resize";
                case "LeftHandle":
                case "RightHandle":
                    return "ew-resize";
                case "CenterHandle":
                default:
                    return "default";
            }
        } else {
            return "default";
        }
    }

    onContextMenu(app: App, ev: CanvasPointerEvent) {
        const hitResult = testHitEntities(
            app.canvas.page.get(),
            ev.point,
            app.viewport.get().scale,
            app.entityHandle,
        );
        const result = hitResult.entities.at(0);
        if (result !== undefined) {
            const entityId = result.target.id;
            if (!app.canvas.selectedEntityIds.get().has(entityId)) {
                app.canvas.unselectAll();
                app.canvas.select(result.target.id);
            }
        }

        super.onContextMenu(app, ev);
    }

    private onCanvasTap(app: App, ev: CanvasPointerEvent) {
        const hitEntity = testHitEntities(
            app.canvas.page.get(),
            ev.point,
            app.viewport.get().scale,
            app.entityHandle,
        ).entities.at(0);

        if (hitEntity !== undefined) {
            const previousSelectedEntityIds =
                app.canvas.selectedEntityIds.get();

            const selectedOnlyThisEntity =
                previousSelectedEntityIds.size === 1 &&
                previousSelectedEntityIds.has(hitEntity.target.id);

            if (ev.shiftKey) {
                app.canvas.unselect(hitEntity.target.id);
            } else {
                if (!selectedOnlyThisEntity) {
                    app.canvas.unselectAll();
                    app.canvas.select(hitEntity.target.id);
                }
            }

            app.entityHandle
                .getHandle(hitEntity.target)
                .onTap(hitEntity.target, app, {
                    ...ev,
                    previousSelectedEntities: previousSelectedEntityIds,
                });
        } else {
            if (!ev.shiftKey) app.canvas.unselectAll();
        }
    }

    private onEntityPointerDown(
        app: App,
        ev: CanvasPointerEvent,
        entity: Entity,
    ) {
        const previousSelectedEntities = app.canvas.selectedEntityIds.get();

        if (!ev.shiftKey) app.canvas.unselectAll();
        app.canvas.select(entity.id);

        setupSelectionTransformPointerEventHandlers(
            app,
            ev,
            new TranslateSelectionTransformController(app, ev.point),
        );
        app.gesture.addPointerUpHandler(ev.pointerId, (app, ev) => {
            if (ev.isTap) {
                app.entityHandle
                    .getHandle(entity)
                    .onTap(entity, app, { ...ev, previousSelectedEntities });
            }
        });
    }

    private onSelectionPointerDown(
        app: App,
        ev: CanvasPointerEvent,
        handle: HandleType,
    ) {
        switch (handle.type) {
            case "TopLeftHandle": {
                setupSelectionTransformPointerEventHandlers(
                    app,
                    ev,
                    new ScaleSelectionTransformController(
                        app,
                        ev.point,
                        handle.selectionRect.bottomRight,
                        "left",
                        "top",
                    ),
                );
                break;
            }
            case "TopHandle": {
                setupSelectionTransformPointerEventHandlers(
                    app,
                    ev,
                    new ScaleSelectionTransformController(
                        app,
                        ev.point,
                        handle.selectionRect.bottomCenter,
                        "center",
                        "top",
                    ),
                );
                break;
            }
            case "TopRightHandle": {
                setupSelectionTransformPointerEventHandlers(
                    app,
                    ev,
                    new ScaleSelectionTransformController(
                        app,
                        ev.point,
                        handle.selectionRect.bottomLeft,
                        "right",
                        "top",
                    ),
                );
                break;
            }
            case "LeftHandle": {
                setupSelectionTransformPointerEventHandlers(
                    app,
                    ev,
                    new ScaleSelectionTransformController(
                        app,
                        ev.point,
                        handle.selectionRect.centerRight,
                        "left",
                        "center",
                    ),
                );
                break;
            }
            case "RightHandle": {
                setupSelectionTransformPointerEventHandlers(
                    app,
                    ev,
                    new ScaleSelectionTransformController(
                        app,
                        ev.point,
                        handle.selectionRect.centerLeft,
                        "right",
                        "center",
                    ),
                );
                break;
            }
            case "BottomLeftHandle": {
                setupSelectionTransformPointerEventHandlers(
                    app,
                    ev,
                    new ScaleSelectionTransformController(
                        app,
                        ev.point,
                        handle.selectionRect.topRight,
                        "left",
                        "bottom",
                    ),
                );
                break;
            }
            case "BottomHandle": {
                setupSelectionTransformPointerEventHandlers(
                    app,
                    ev,
                    new ScaleSelectionTransformController(
                        app,
                        ev.point,
                        handle.selectionRect.topCenter,
                        "center",
                        "bottom",
                    ),
                );
                break;
            }
            case "BottomRightHandle": {
                setupSelectionTransformPointerEventHandlers(
                    app,
                    ev,
                    new ScaleSelectionTransformController(
                        app,
                        ev.point,
                        handle.selectionRect.topLeft,
                        "right",
                        "bottom",
                    ),
                );
                break;
            }
            case "CenterHandle": {
                setupSelectionTransformPointerEventHandlers(
                    app,
                    ev,
                    new TranslateSelectionTransformController(app, ev.point),
                );
                break;
            }
            case "CornerRadiusHandle": {
                setupCornerRadiusHandlePointerEventHandlers(
                    app,
                    ev,
                    handle.entity,
                    handle.handle,
                );
                break;
            }
        }

        app.gesture.addPointerUpHandler(ev.pointerId, (app, ev) => {
            if (ev.isTap) {
                this.onCanvasTap(app, ev);
            }
        });
    }

    private getHandleType(
        app: App,
        point: Point,
        margin = 8,
    ): HandleType | null {
        const marginInCanvas = margin / app.viewport.get().scale;
        const selectedEntities = app.canvas.selectedEntities.get();
        if (
            selectedEntities.length === 1 &&
            isPathEntity(selectedEntities[0])
        ) {
            const entity = selectedEntities[0];

            const handles = getCornerRoundHandleData(
                PathEntityHandle.getGraph(entity).getOutline().points,
                entity[PROPERTY_KEY_CORNER_RADIUS],
            );

            for (const handle of handles) {
                const distance = Math.hypot(
                    handle.handlePosition.x - point.x,
                    handle.handlePosition.y - point.y,
                );

                if (distance < marginInCanvas) {
                    return {
                        type: "CornerRadiusHandle",
                        entity,
                        handle,
                    };
                }
            }
        }

        const selectionRect = app.canvas.selectionRect.get();
        if (selectionRect === null) return null;

        const hitAreaX = testHitWithRange(
            point.x,
            selectionRect.left,
            selectionRect.right,
            marginInCanvas,
        );
        const hitAreaY = testHitWithRange(
            point.y,
            selectionRect.top,
            selectionRect.bottom,
            marginInCanvas,
        );

        switch (hitAreaX) {
            case "start": {
                switch (hitAreaY) {
                    case "start": {
                        return {
                            type: "TopLeftHandle",
                            selectionRect,
                        };
                    }
                    case "middle": {
                        return {
                            type: "LeftHandle",
                            selectionRect,
                        };
                    }
                    case "end": {
                        return {
                            type: "BottomLeftHandle",
                            selectionRect,
                        };
                    }
                }
                break;
            }
            case "middle": {
                switch (hitAreaY) {
                    case "start": {
                        return {
                            type: "TopHandle",
                            selectionRect,
                        };
                    }
                    case "middle": {
                        return {
                            type: "CenterHandle",
                            selectionRect,
                        };
                    }
                    case "end": {
                        return {
                            type: "BottomHandle",
                            selectionRect,
                        };
                    }
                }
                break;
            }
            case "end": {
                switch (hitAreaY) {
                    case "start": {
                        return {
                            type: "TopRightHandle",
                            selectionRect,
                        };
                    }
                    case "middle": {
                        return {
                            type: "RightHandle",
                            selectionRect,
                        };
                    }
                    case "end": {
                        return {
                            type: "BottomRightHandle",
                            selectionRect,
                        };
                    }
                }
                break;
            }
        }

        return null;
    }
}

export interface CornerRoundHandleData {
    node: GraphNode;
    previousNode: GraphNode;
    nextNode: GraphNode;
    arcStartPosition: Point;
    arcEndPosition: Point;
    handlePosition: Point;

    /**
     * The angle of the corner in radian
     */
    cornerAngle: number;

    /**
     * The angle of the corner arc in radian
     */
    arcAngle: number;

    /**
     * Length from the corner to the point on the edge that the circle touches on
     */
    offset: number;
}

export function getMaxCornerRadius(outline: Array<Point>): number {
    // 1/tan(angle / 2) of each angle of the outline
    const invTans: number[] = [];

    // i-th element is the length between P_i and P_i+1
    const edgeLength: number[] = [];

    for (let i = 0; i < outline.length; i++) {
        const p0 = outline[(i - 1 + outline.length) % outline.length];
        const p1 = outline[i];
        const p2 = outline[(i + 1) % outline.length];

        const p10x = p0.x - p1.x;
        const p10y = p0.y - p1.y;

        const p12x = p2.x - p1.x;
        const p12y = p2.y - p1.y;
        const norm12 = Math.hypot(p12x, p12y);

        const angleP10 = Math.atan2(p10y, p10x);
        const angleP12 = Math.atan2(p12y, p12x);
        const angle = normalizeAngle(-(angleP12 - angleP10));
        const invTan =
            1 / Math.tan(angle > Math.PI ? Math.PI - angle / 2 : angle / 2);

        invTans.push(invTan);
        edgeLength.push(norm12);
    }

    let minCornerRadius = Number.POSITIVE_INFINITY;
    for (let i = 0; i < outline.length; i++) {
        const sumInvTan = invTans[i] + invTans[(i + 1) % outline.length];
        minCornerRadius = Math.min(minCornerRadius, edgeLength[i] / sumInvTan);
    }

    return minCornerRadius;
}

export function getCornerRoundHandleData(
    outline: GraphNode[],
    cornerRadius: number,
): CornerRoundHandleData[] {
    const CORNER_RADIUS_HANDLE_MARGIN = 50;

    const handles: CornerRoundHandleData[] = [];

    for (let i = 0; i < outline.length; i++) {
        const p0 = outline[(i - 1 + outline.length) % outline.length];
        const p1 = outline[i];
        const p2 = outline[(i + 1) % outline.length];
        if (p0.id === p2.id) continue;

        const p10x = p0.x - p1.x;
        const p10y = p0.y - p1.y;
        const norm10 = Math.hypot(p10x, p10y);
        const i10x = p10x / norm10;
        const i10y = p10y / norm10;
        if (p10x === 0 && p10y === 0) {
            continue;
        }

        const p12x = p2.x - p1.x;
        const p12y = p2.y - p1.y;
        const norm12 = Math.hypot(p12x, p12y);
        const i12x = p12x / norm12;
        const i12y = p12y / norm12;
        if (p12x === 0 && p12y === 0) {
            continue;
        }

        const angleP10 = Math.atan2(p10y, p10x);
        const angleP12 = Math.atan2(p12y, p12x);
        const angle = normalizeAngle(-(angleP12 - angleP10));
        if (angle === 0) {
            console.log(angle, p0, p1, p2);
            assert(angle !== 0);
        }

        const offset =
            cornerRadius /
            Math.tan(angle > Math.PI ? Math.PI - angle / 2 : angle / 2);

        const normHandle = Math.max(
            Math.hypot(offset, cornerRadius),
            CORNER_RADIUS_HANDLE_MARGIN,
        );

        const iHandleX = (i10x + i12x) / Math.hypot(i10x + i12x, i10y + i12y);
        const iHandleY = (i10y + i12y) / Math.hypot(i10x + i12x, i10y + i12y);
        const handleX = p1.x + iHandleX * normHandle;
        const handleY = p1.y + iHandleY * normHandle;

        handles.push({
            node: p1,
            previousNode: p0,
            nextNode: p2,
            arcStartPosition: new Point(
                p1.x + offset * i10x,
                p1.y + offset * i10y,
            ),
            arcEndPosition: new Point(
                p1.x + offset * i12x,
                p1.y + offset * i12y,
            ),
            handlePosition: new Point(handleX, handleY),
            cornerAngle: angle,
            arcAngle: angle > Math.PI ? 2 * Math.PI - angle : angle,
            offset,
        });
    }

    return handles;
}

export type HandleType =
    | { type: "TopLeftHandle"; selectionRect: Rect }
    | { type: "TopHandle"; selectionRect: Rect }
    | { type: "TopRightHandle"; selectionRect: Rect }
    | { type: "LeftHandle"; selectionRect: Rect }
    | { type: "CenterHandle"; selectionRect: Rect }
    | { type: "RightHandle"; selectionRect: Rect }
    | { type: "BottomLeftHandle"; selectionRect: Rect }
    | { type: "BottomHandle"; selectionRect: Rect }
    | { type: "BottomRightHandle"; selectionRect: Rect }
    | {
          type: "CornerRadiusHandle";
          entity: PathEntity;
          handle: CornerRoundHandleData;
      };

/**
 * Test if a given value is inside of a range.
 */
function testHitWithRange(
    value: number,
    start: number,
    end: number,
    marginInCanvas: number,
): "start" | "middle" | "end" | "none" {
    const outerStart = start - marginInCanvas;
    const innerStart =
        end - start < marginInCanvas * 4
            ? (start * 3 + end) / 4
            : start + marginInCanvas;
    const innerEnd =
        end - start < marginInCanvas * 4
            ? (start + end * 3) / 4
            : end - marginInCanvas;
    const outerEnd = end + marginInCanvas;

    if (value < outerStart) {
        return "none";
    } else if (value < innerStart) {
        return "start";
    } else if (value < innerEnd) {
        return "middle";
    } else if (value < outerEnd) {
        return "end";
    } else {
        return "none";
    }
}

function isPointInTriangle(
    point: Point,
    triangle: [Point, Point, Point],
): boolean {
    const [p0, p1, p2] = triangle;

    const p0x = p0.x - point.x;
    const p0y = p0.y - point.y;
    const p1x = p1.x - point.x;
    const p1y = p1.y - point.y;
    const p2x = p2.x - point.x;
    const p2y = p2.y - point.y;

    const cross01 = p0x * p1y - p0y * p1x;
    const cross12 = p1x * p2y - p1y * p2x;
    const cross20 = p2x * p0y - p2y * p0x;

    if (cross01 * cross12 < 0) return false;
    if (cross12 * cross20 < 0) return false;
    if (cross20 * cross01 < 0) return false;

    return true;
}
