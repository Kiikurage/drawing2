import {
    PROPERTY_KEY_CORNER_RADIUS,
    PathEntity,
} from "../default/entity/PathEntity/PathEntity";
import { assert } from "../lib/assert";
import type { Point } from "../lib/geo/Point";
import { Rect } from "../lib/geo/Rect";
import { normalizeAngle } from "../lib/normalizeAngle";
import { testHitEntities } from "../lib/testHitEntities";
import type { App } from "./App";
import { BrushStore } from "./BrushStore";
import type { Entity } from "./Entity";
import type { GraphNode } from "./Graph";
import {
    type CanvasPointerEvent,
    type Mode,
    ModeController,
} from "./ModeController";
import type { Page } from "./Page";
import {
    ScaleSelectionTransformController,
    TranslateSelectionTransformController,
} from "./SelectionTransformController";
import { setupBrushSelectPointerEventHandlers } from "./setupBrushSelectPointerEventHandlers";
import { setupCornerRadiusHandlePointerEventHandlers } from "./setupCornerRadiusHandlePointerEventHandlers";
import { setupSelectionTransformPointerEventHandlers } from "./setupSelectionTransformPointerEventHandlers";

export class SelectEntityModeController extends ModeController {
    readonly brushStore = new BrushStore();

    onCanvasPointerDown(app: App, ev: CanvasPointerEvent): void {
        const handle = this.getHandleType(app, ev.point);
        if (handle !== null) {
            this.onSelectionPointerDown(app, ev, handle);
            return;
        }

        const hitResult = testHitEntities(
            app.canvasStateStore.getState(),
            ev.point,
            app.viewportStore.getState().scale,
        );
        const result = hitResult.entities.at(0);
        if (result !== undefined) {
            this.onEntityPointerDown(app, ev, result.target);
            return;
        }

        if (!ev.shiftKey) app.unselectAll();

        setupBrushSelectPointerEventHandlers(app, ev, this.brushStore);
    }

    onCanvasDoubleClick(app: App, ev: CanvasPointerEvent) {
        app.setMode({ type: "new-text" });
        app.getModeController().onCanvasPointerDown(app, ev);
    }

    onMouseMove(app: App, point: Point) {
        const handle = this.getHandleType(app, point);
        if (handle !== null) {
            switch (handle.type) {
                case "TopLeftHandle":
                    app.appStateStore.setCursor("nwse-resize");
                    break;
                case "TopHandle":
                    app.appStateStore.setCursor("ns-resize");
                    break;
                case "TopRightHandle":
                    app.appStateStore.setCursor("nesw-resize");
                    break;
                case "LeftHandle":
                    app.appStateStore.setCursor("ew-resize");
                    break;
                case "CenterHandle":
                    app.appStateStore.setCursor("default");
                    break;
                case "RightHandle":
                    app.appStateStore.setCursor("ew-resize");
                    break;
                case "BottomLeftHandle":
                    app.appStateStore.setCursor("nesw-resize");
                    break;
                case "BottomHandle":
                    app.appStateStore.setCursor("ns-resize");
                    break;
                case "BottomRightHandle":
                    app.appStateStore.setCursor("nwse-resize");
                    break;
            }
        } else {
            app.appStateStore.setCursor("default");
        }
    }

    private onCanvasTap(app: App, ev: CanvasPointerEvent) {
        const hitEntity = testHitEntities(
            app.canvasStateStore.getState(),
            ev.point,
            app.viewportStore.getState().scale,
        ).entities.at(0);

        if (hitEntity !== undefined) {
            const previousSelectedEntityIds = getSelectedEntityIds(
                app.appStateStore.getState().mode,
            );

            const selectedOnlyThisEntity =
                previousSelectedEntityIds.size === 1 &&
                previousSelectedEntityIds.has(hitEntity.target.props.id);

            if (ev.shiftKey) {
                app.unselect(hitEntity.target.props.id);
            } else {
                if (!selectedOnlyThisEntity) {
                    app.unselectAll();
                    app.select(hitEntity.target.props.id);
                }
            }

            hitEntity.target.onTap(app, {
                ...ev,
                previousSelectedEntities: previousSelectedEntityIds,
            });
        } else {
            if (!ev.shiftKey) app.unselectAll();
        }
    }

    private onEntityPointerDown(
        app: App,
        ev: CanvasPointerEvent,
        entity: Entity,
    ) {
        const previousSelectedEntities = getSelectedEntityIds(
            app.appStateStore.getState().mode,
        );

        if (!ev.shiftKey) app.unselectAll();
        app.select(entity.props.id);

        setupSelectionTransformPointerEventHandlers(
            app,
            ev,
            new TranslateSelectionTransformController(app, ev.point),
        );
        app.gestureRecognizer.addPointerUpHandler(ev.pointerId, (app, ev) => {
            if (ev.isTap) {
                entity.onTap(app, { ...ev, previousSelectedEntities });
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
                    handle.corner,
                );
                break;
            }
        }

        app.gestureRecognizer.addPointerUpHandler(ev.pointerId, (app, ev) => {
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
        const marginInCanvas = margin / app.viewportStore.getState().scale;
        const selectedEntities = getSelectedEntities(
            app.appStateStore.getState().mode,
            app.canvasStateStore.getState(),
        );
        if (
            selectedEntities.length === 1 &&
            selectedEntities[0] instanceof PathEntity
        ) {
            const entity = selectedEntities[0];
            const outline = entity.graph.getOutline();
            const cornerRadius = entity.getProperty(
                PROPERTY_KEY_CORNER_RADIUS,
                0,
            );
            const CORNER_RADIUS_HANDLE_MARGIN = 50;

            for (let i = 0; i < outline.length; i++) {
                const p0 = outline[(i - 1 + outline.length) % outline.length];
                const p1 = outline[i];
                const p2 = outline[(i + 1) % outline.length];

                const p10x = p0.x - p1.x;
                const p10y = p0.y - p1.y;
                const norm10 = Math.hypot(p10x, p10y);
                const i10x = p10x / norm10;
                const i10y = p10y / norm10;

                const p12x = p2.x - p1.x;
                const p12y = p2.y - p1.y;
                const norm12 = Math.hypot(p12x, p12y);
                const i12x = p12x / norm12;
                const i12y = p12y / norm12;

                const angleP10 = Math.atan2(p10y, p10x);
                const angleP12 = Math.atan2(p12y, p12x);
                const angle = normalizeAngle(-(angleP12 - angleP10));

                const normVHandle =
                    cornerRadius / Math.sin(angle / 2) +
                    CORNER_RADIUS_HANDLE_MARGIN;
                const vHandleCX = p1.x + ((i10x + i12x) / 2) * normVHandle;
                const vHandleCY = p1.y + ((i10y + i12y) / 2) * normVHandle;

                const distance = Math.hypot(
                    vHandleCX - point.x,
                    vHandleCY - point.y,
                );

                if (distance < marginInCanvas) {
                    return {
                        type: "CornerRadiusHandle",
                        corner: p1,
                        entity,
                    };
                }
            }
        }

        const selectionRect = getSelectionRect(
            app.appStateStore.getState().mode,
            app.canvasStateStore.getState(),
        );
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

export interface SelectEntityMode extends Mode {
    type: "select-entity";
    entityIds: Set<string>;
}

export function isSelectEntityMode(mode: Mode): mode is SelectEntityMode {
    return mode.type === "select-entity";
}

export function createSelectEntityMode(
    entityIds: Set<string>,
): SelectEntityMode {
    return { type: "select-entity", entityIds };
}

export function getSelectedEntityIds(mode: Mode): Set<string> {
    if (!isSelectEntityMode(mode)) return new Set();
    return mode.entityIds;
}

export function getSelectedEntities(mode: Mode, page: Page): Entity[] {
    return Array.from(getSelectedEntityIds(mode)).map((id) => {
        const entity = page.entities.get(id);
        assert(entity !== undefined, `Entity ${id} not found`);
        return entity;
    });
}

export function getSelectionRect(mode: Mode, page: Page): Rect | null {
    const selectedEntities = getSelectedEntities(mode, page);
    if (selectedEntities.length === 0) return null;

    return Rect.union(
        selectedEntities.map((entity) => entity.getBoundingRect()),
    );
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
    | { type: "CornerRadiusHandle"; entity: PathEntity; corner: GraphNode };

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
