import type { Property } from "csstype";
import {
    PROPERTY_KEY_ARROW_HEAD_NODE_IDS,
    PathEntityHandle,
    isPathEntity,
} from "../../default/entity/PathEntity/PathEntity";
import { NewTextModeController } from "../../default/mode/NewTextModeController";
import { testHitEntities } from "../../lib/testHitEntities";
import type { App } from "../App";
import type { Entity } from "../Entity";
import type { CanvasPointerUpEvent } from "../GestureRecognizer";
import { type CanvasPointerEvent, ModeController } from "../ModeController";
import type { Point } from "../shape/Point";
import type { Rect } from "../shape/Shape";
import { MoveEntityModeController } from "./MoveEntityModeController";
import { ResizeEntityModeController } from "./ResizeEntityModeController";
import { SelectByBrushModeController } from "./SelectByBrushModeController";

export class SelectEntityModeController extends ModeController {
    static readonly type = "select-entity";

    constructor(readonly app: App) {
        super();
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
                app.history.addCheckpoint();
                app.deleteSelectedEntities();
            },
        });
        app.keyboard.addBinding({
            key: "Delete",
            mode: [SelectEntityModeController.type],
            action: (app, ev) => {
                app.history.addCheckpoint();
                app.deleteSelectedEntities();
            },
        });

        app.contextMenu.add({
            title: "最前面へ",
            action: () => {
                app.history.addCheckpoint();
                app.bringToFront();
            },
        });
        app.contextMenu.add({
            title: "ひとつ前へ",
            action: () => {
                app.history.addCheckpoint();
                app.bringForward();
            },
        });
        app.contextMenu.add({
            title: "ひとつ後ろへ",
            action: () => {
                app.history.addCheckpoint();
                app.sendBackward();
            },
        });
        app.contextMenu.add({
            title: "最背面へ",
            action: () => {
                app.history.addCheckpoint();
                app.sendToBack();
            },
        });
        app.contextMenu.add({
            title: "線の端を矢印に",
            action: () => {
                const entities = app.canvas.selectedEntities.get();
                app.canvas.edit((builder) => {
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

                        builder.updateProperty(
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
                app.canvas.edit((builder) => {
                    builder.updateProperty(
                        [...selectedEntityIds],
                        PROPERTY_KEY_ARROW_HEAD_NODE_IDS,
                        [],
                    );
                });
            },
        });
    }

    onPointerDown(app: App, ev: CanvasPointerEvent): void {
        const selectedEntityIds = app.canvas.selectedEntityIds.get();

        const handle = this.getHandleType(app, ev.point);
        if (handle !== null) {
            this.onSelectionPointerDown(app, ev, handle);
            return;
        }

        const hitEntity = testHitEntities(
            app.canvas.page.get(),
            ev.point,
            app.viewport.get().scale,
            app.entityHandle,
        ).entities.at(0)?.target;
        if (hitEntity !== undefined) {
            this.onEntityPointerDown(app, ev, hitEntity);
            return;
        }

        if (!ev.shiftKey) app.canvas.unselectAll();

        app.setMode(SelectByBrushModeController.type);
    }

    onPointerMove(app: App, ev: CanvasPointerEvent) {
        app.cursor.set(this.getCursor(app));
    }

    onPointerUp(app: App, ev: CanvasPointerUpEvent) {
        const selectedEntityIds = app.canvas.selectedEntityIds.get();

        if (ev.isTap) {
            const hitResult = testHitEntities(
                app.canvas.page.get(),
                ev.point,
                app.viewport.get().scale,
                app.entityHandle,
            );
            const result = hitResult.entities.at(0);
            if (
                result !== undefined &&
                !selectedEntityIds.has(result.target.id)
            ) {
                if (!ev.shiftKey) {
                    app.canvas.unselectAll();
                }
                app.canvas.select(result.target.id);

                app.entityHandle
                    .getHandle(result.target)
                    .onTap(result.target, app, {
                        ...ev,
                        previousSelectedEntities: selectedEntityIds,
                    });
            }
        }
    }

    onDoubleClick(app: App, ev: CanvasPointerEvent) {
        app.setMode(NewTextModeController.type);
        app.getModeController().onPointerDown(app, ev);
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

        app.history.addCheckpoint();
        app.setMode(MoveEntityModeController.type);

        app.gesture.addPointerUpHandlerForPointer(ev.pointerId, (app, ev) => {
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
            case "TopLeftHandle":
            case "TopHandle":
            case "TopRightHandle":
            case "LeftHandle":
            case "RightHandle":
            case "BottomLeftHandle":
            case "BottomHandle":
            case "BottomRightHandle": {
                app.history.addCheckpoint();
                app.setMode(ResizeEntityModeController.type);
                break;
            }
            case "CenterHandle": {
                app.history.addCheckpoint();
                app.setMode(MoveEntityModeController.type);
                break;
            }
        }
    }

    private getHandleType(
        app: App,
        point: Point,
        margin = 8,
    ): HandleType | null {
        const marginInCanvas = margin / app.viewport.get().scale;

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

    private getCursor(app: App): Property.Cursor {
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
    | { type: "BottomRightHandle"; selectionRect: Rect };

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
