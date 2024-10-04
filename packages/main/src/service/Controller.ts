import { type Line, distanceFromPointToLine } from "../geo/Line";
import { distanceFromPointToPoint } from "../geo/Point";
import {
    isRectOverlapWithLine,
    isRectOverlapWithPoint,
    isRectOverlapWithRect,
} from "../geo/Rect";
import { getRectanglePath } from "../geo/path";
import type { StateProvider } from "../lib/Store";
import { assert } from "../lib/assert";
import { isNotNullish } from "../lib/isNullish";
import { randomId } from "../lib/randomId";
import type { ColorId } from "../model/Colors";
import type { FillMode } from "../model/FillMode";
import type { Mode } from "../model/Mode";
import type { LineObject, Obj, PointObject, ShapeObject } from "../model/Page";
import type { TextAlignment } from "../model/TextAlignment";
import { Transaction } from "../model/Transaction";
import {
    type CanvasStateStore,
    MouseButton,
    fromCanvasCoordinate,
} from "../store/CanvasStateStore";
import {
    HoverStateStore,
    getNearestPoint,
    testHitItems,
} from "../store/HoverStateStore";
import { PointerStateStore } from "../store/PointerStateStore";
import { ViewportStore } from "../store/ViewportStore";
import {
    GestureRecognizer,
    type PointerEventSessionHandlers,
} from "./GestureRecognizer";
import { getRestoreViewportService } from "./RestoreViewportService";

export class Controller {
    readonly pointerStore = new PointerStateStore();
    readonly hoverStateStore: HoverStateStore;
    readonly viewportStore = new ViewportStore(getRestoreViewportService());
    readonly gestureRecognizer = new GestureRecognizer(this.viewportStore);

    constructor(private readonly store: CanvasStateStore) {
        this.hoverStateStore = new HoverStateStore(
            store,
            this.pointerStore,
            this.viewportStore,
        );
        this.gestureRecognizer.onPointerDown = this.handlePointerDown;
    }

    private readonly handlePointerDown = (
        ev: PointerEvent,
        startSession: (handlers: PointerEventSessionHandlers) => void,
    ) => {
        const [x, y] = fromCanvasCoordinate(
            ev.clientX,
            ev.clientY,
            this.viewportStore.getState(),
        );
        switch (ev.button) {
            case MouseButton.Left: {
                switch (this.store.getState().mode) {
                    case "select": {
                        const selectionRect = this.store
                            .getState()
                            .getSelectionRect();
                        const selectedObjects = this.store
                            .getState()
                            .getSelectedObjects();

                        // Selection
                        if (selectionRect !== null) {
                            const THRESHOLD = 32;

                            const isSingleLineMode =
                                selectedObjects.length === 1 &&
                                selectedObjects[0].type === "line";
                            if (isSingleLineMode) {
                                const line = selectedObjects[0] as LineObject;

                                if (
                                    distanceFromPointToPoint(
                                        { x: line.x1, y: line.y1 },
                                        { x, y },
                                    ) < THRESHOLD
                                ) {
                                    const originalPointId = this.store
                                        .getState()
                                        .page.dependencies.getByToObjectId(
                                            line.id,
                                        )
                                        .find(
                                            (dependency) =>
                                                dependency.type ===
                                                    "lineEndPoint" &&
                                                dependency.lineEnd === 1,
                                        )?.from;
                                    assert(
                                        originalPointId !== undefined,
                                        "LineEndPoint 1 is not found",
                                    );

                                    const originalPoint =
                                        this.store.getState().page.objects[
                                            originalPointId
                                        ];
                                    assert(
                                        originalPoint !== undefined,
                                        `Point ${originalPointId} is not found`,
                                    );
                                    assert(
                                        originalPoint.type === "point",
                                        `Object ${originalPointId} is not a point`,
                                    );
                                    startSession(
                                        createMovePointSessionHandlers(
                                            originalPoint,
                                            this.store,
                                            this.viewportStore,
                                        ),
                                    );
                                    return;
                                }

                                if (
                                    distanceFromPointToPoint(
                                        { x: line.x2, y: line.y2 },
                                        { x, y },
                                    ) < THRESHOLD
                                ) {
                                    const originalPointId = this.store
                                        .getState()
                                        .page.dependencies.getByToObjectId(
                                            line.id,
                                        )
                                        .find(
                                            (dependency) =>
                                                dependency.type ===
                                                    "lineEndPoint" &&
                                                dependency.lineEnd === 2,
                                        )?.from;
                                    assert(
                                        originalPointId !== undefined,
                                        "LineEndPoint 2 is not found",
                                    );

                                    const originalPoint =
                                        this.store.getState().page.objects[
                                            originalPointId
                                        ];
                                    assert(
                                        originalPoint !== undefined,
                                        `Point ${originalPointId} is not found`,
                                    );
                                    assert(
                                        originalPoint.type === "point",
                                        `Object ${originalPointId} is not a point`,
                                    );
                                    startSession(
                                        createMovePointSessionHandlers(
                                            originalPoint,
                                            this.store,
                                            this.viewportStore,
                                        ),
                                    );
                                    return;
                                }

                                if (
                                    distanceFromPointToLine({ x, y }, line)
                                        .distance < THRESHOLD
                                ) {
                                    startSession(
                                        createMoveSelectedObjectsSessionHandlers(
                                            x,
                                            y,
                                            ev.shiftKey,
                                            this.store,
                                            this.viewportStore,
                                        ),
                                    );
                                }
                            } else {
                                const topLeft = {
                                    x: selectionRect.x,
                                    y: selectionRect.y,
                                };
                                const topRight = {
                                    x: selectionRect.x + selectionRect.width,
                                    y: selectionRect.y,
                                };
                                const bottomLeft = {
                                    x: selectionRect.x,
                                    y: selectionRect.y + selectionRect.height,
                                };
                                const bottomRight = {
                                    x: selectionRect.x + selectionRect.width,
                                    y: selectionRect.y + selectionRect.height,
                                };

                                if (
                                    distanceFromPointToPoint(topLeft, {
                                        x,
                                        y,
                                    }) < THRESHOLD
                                ) {
                                    startSession(
                                        createXYResizeSessionHandlers(
                                            selectedObjects,
                                            bottomRight.x,
                                            bottomRight.y,
                                            this.store,
                                        ),
                                    );
                                    return;
                                }
                                if (
                                    distanceFromPointToPoint(topRight, {
                                        x,
                                        y,
                                    }) < THRESHOLD
                                ) {
                                    startSession(
                                        createXYResizeSessionHandlers(
                                            selectedObjects,
                                            bottomLeft.x,
                                            bottomLeft.y,
                                            this.store,
                                        ),
                                    );
                                    return;
                                }
                                if (
                                    distanceFromPointToPoint(bottomLeft, {
                                        x,
                                        y,
                                    }) < THRESHOLD
                                ) {
                                    startSession(
                                        createXYResizeSessionHandlers(
                                            selectedObjects,
                                            topRight.x,
                                            topRight.y,
                                            this.store,
                                        ),
                                    );
                                    return;
                                }
                                if (
                                    distanceFromPointToPoint(bottomRight, {
                                        x,
                                        y,
                                    }) < THRESHOLD
                                ) {
                                    startSession(
                                        createXYResizeSessionHandlers(
                                            selectedObjects,
                                            topLeft.x,
                                            topLeft.y,
                                            this.store,
                                        ),
                                    );
                                    return;
                                }

                                // Top, Bottom
                                {
                                    const top: Line = {
                                        x1: topLeft.x,
                                        y1: topLeft.y,
                                        x2: topRight.x,
                                        y2: topRight.y,
                                    };
                                    const bottom: Line = {
                                        x1: bottomLeft.x,
                                        y1: bottomLeft.y,
                                        x2: bottomRight.x,
                                        y2: bottomRight.y,
                                    };

                                    if (
                                        distanceFromPointToLine({ x, y }, top)
                                            .distance < THRESHOLD
                                    ) {
                                        startSession(
                                            createYResizeSessionHandlers(
                                                selectedObjects,
                                                bottom.y1,
                                                this.store,
                                            ),
                                        );
                                        return;
                                    }
                                    if (
                                        distanceFromPointToLine(
                                            { x, y },
                                            bottom,
                                        ).distance < THRESHOLD
                                    ) {
                                        startSession(
                                            createYResizeSessionHandlers(
                                                selectedObjects,
                                                top.y1,
                                                this.store,
                                            ),
                                        );
                                        return;
                                    }
                                }

                                // Left, Right
                                {
                                    const left: Line = {
                                        x1: topLeft.x,
                                        y1: topLeft.y,
                                        x2: bottomLeft.x,
                                        y2: bottomLeft.y,
                                    };
                                    const right: Line = {
                                        x1: topRight.x,
                                        y1: topRight.y,
                                        x2: bottomRight.x,
                                        y2: bottomRight.y,
                                    };
                                    if (
                                        distanceFromPointToLine({ x, y }, left)
                                            .distance < THRESHOLD
                                    ) {
                                        startSession(
                                            createXResizeSessionHandlers(
                                                selectedObjects,
                                                right.x1,
                                                this.store,
                                            ),
                                        );
                                        return;
                                    }
                                    if (
                                        distanceFromPointToLine({ x, y }, right)
                                            .distance < THRESHOLD
                                    ) {
                                        startSession(
                                            createXResizeSessionHandlers(
                                                selectedObjects,
                                                left.x1,
                                                this.store,
                                            ),
                                        );
                                        return;
                                    }
                                }

                                // Center
                                if (
                                    isRectOverlapWithPoint(selectionRect, {
                                        x,
                                        y,
                                    })
                                ) {
                                    startSession(
                                        createMoveSelectedObjectsSessionHandlers(
                                            x,
                                            y,
                                            ev.shiftKey,
                                            this.store,
                                            this.viewportStore,
                                        ),
                                    );
                                    return;
                                }
                            }
                        }

                        // Object
                        {
                            const hitResult = testHitItems(
                                this.store.getState().page,
                                x,
                                y,
                                this.viewportStore.getState().scale,
                            );
                            if (hitResult.orderedByZIndex.length > 0) {
                                startSession(
                                    createMoveObjectSessionHandlers(
                                        hitResult.orderedByZIndex[0].object,
                                        ev.shiftKey,
                                        this.store,
                                    ),
                                );
                                return;
                            }
                        }

                        // Canvas
                        {
                            if (!ev.shiftKey) {
                                this.store.unselectAll();
                            }
                            startSession(
                                createSelectByRangeSessionHandlers(this.store),
                            );
                            return;
                        }
                    }
                    case "text": {
                        this.store.setMode("select");

                        // Object
                        {
                            const hitResult = testHitItems(
                                this.store.getState().page,
                                x,
                                y,
                                this.viewportStore.getState().scale,
                            );
                            if (hitResult.orderedByZIndex.length > 0) {
                                this.store.unselectAll();
                                this.store.select(
                                    hitResult.orderedByZIndex[0].object.id,
                                );
                                startSession(
                                    createMoveObjectSessionHandlers(
                                        hitResult.orderedByZIndex[0].object,
                                        ev.shiftKey,
                                        this.store,
                                    ),
                                );
                                return;
                            }
                        }

                        // Canvas
                        {
                            if (!ev.shiftKey) {
                                this.store.unselectAll();
                            }
                            startSession(
                                createSelectByRangeSessionHandlers(this.store),
                            );
                            return;
                        }
                    }
                    case "line": {
                        startSession(
                            createNewLineSessionHandlers(
                                this.store,
                                this.viewportStore,
                            ),
                        );
                        return;
                    }
                    case "shape": {
                        startSession(createNewShapeSessionHandlers(this.store));
                        return;
                    }
                }
            }
        }
    };

    handleCanvasMouseDown(ev: PointerEvent) {
        this.gestureRecognizer.handlePointerDown(ev);
    }

    handleCanvasMouseMove(canvasX: number, canvasY: number, ev: PointerEvent) {
        this.gestureRecognizer.handlePointerMove(ev);

        const viewport = this.viewportStore.getState();
        this.pointerStore.setPosition(
            canvasX / viewport.scale + viewport.x,
            canvasY / viewport.scale + viewport.y,
        );

        // if (this.store.getState().dragging) {
        //     this.store.updateDrag(canvasX, canvasY);
        // }
    }

    handleCanvasMouseUp(ev: PointerEvent) {
        this.gestureRecognizer.handlePointerUp(ev);

        // if (this.store.getState().dragging) {
        //     this.store.endDrag();
        // }
    }

    handleShapeDoubleClick(
        id: string,
        canvasX: number,
        canvasY: number,
        mouseButton: number,
        modifiers: { shiftKey: boolean },
    ) {
        switch (mouseButton) {
            case MouseButton.Left: {
                this.store.unselectAll();
                this.store.select(id);
                this.store.setMode("text");
                return true;
            }
        }

        return false;
    }

    handleScroll(deltaCanvasX: number, deltaCanvasY: number) {
        this.viewportStore.movePosition(deltaCanvasX, deltaCanvasY);
    }

    handleScale(
        newScale: number,
        centerCanvasX: number,
        centerCanvasY: number,
    ) {
        this.viewportStore.setScale(newScale, centerCanvasX, centerCanvasY);
    }

    handleKeyDown(
        key: string,
        modifiers: { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean },
    ): boolean {
        switch (key) {
            case "a": {
                switch (this.store.getState().mode) {
                    case "line":
                    case "shape":
                    case "select": {
                        if (modifiers.metaKey || modifiers.ctrlKey) {
                            this.store.setMode("select");
                            this.store.selectAll();
                            return true;
                        }
                    }
                }
                break;
            }
            case "r": {
                switch (this.store.getState().mode) {
                    case "line":
                    case "select": {
                        this.store.setMode("shape");
                        return true;
                    }
                }
                break;
            }
            case "l": {
                switch (this.store.getState().mode) {
                    case "shape":
                    case "select": {
                        this.store.setMode("line");
                        return true;
                    }
                }
                break;
            }
            case "z": {
                switch (this.store.getState().mode) {
                    case "line":
                    case "shape":
                    case "select": {
                        if (modifiers.metaKey || modifiers.ctrlKey) {
                            if (modifiers.shiftKey) {
                                this.store.redo();
                            } else {
                                this.store.undo();
                            }
                            return true;
                        }
                    }
                }
                break;
            }
            case "x": {
                switch (this.store.getState().mode) {
                    case "select": {
                        if (modifiers.metaKey || modifiers.ctrlKey) {
                            this.store.cut();
                        }
                        return true;
                    }
                }
                break;
            }
            case "c": {
                switch (this.store.getState().mode) {
                    case "select": {
                        if (modifiers.metaKey || modifiers.ctrlKey) {
                            this.store.copy();
                        }
                        return true;
                    }
                }
                break;
            }
            case "v": {
                switch (this.store.getState().mode) {
                    case "select": {
                        if (modifiers.metaKey || modifiers.ctrlKey) {
                            this.store.paste();
                        }
                        return true;
                    }
                }
                break;
            }
            case "Escape": {
                switch (this.store.getState().mode) {
                    case "select": {
                        this.store.unselectAll();
                        return true;
                    }
                    default: {
                        this.store.setMode("select");
                        return true;
                    }
                }
            }
            case "Delete":
            case "Backspace": {
                switch (this.store.getState().mode) {
                    case "select": {
                        this.store.deleteSelectedObjects();
                        return true;
                    }
                }
                break;
            }
        }

        return false;
    }

    handleModeChange(mode: Mode) {
        this.store.setMode(mode);
    }

    handleLabelChange(id: string, label: string) {
        this.store.setLabel(id, label);
    }

    handleTextAlignButtonClick(alignX: TextAlignment, alignY: TextAlignment) {
        this.store.setTextAlign(alignX, alignY);
    }

    handleColorButtonClick(colorId: ColorId) {
        this.store.setColor(colorId);
    }

    handleFillModeButtonClick(fillMode: FillMode) {
        this.store.setFillMode(fillMode);
    }

    handleBringToFrontButtonClick() {
        this.store.bringToFront();
    }

    handleBringForwardButtonClick() {
        this.store.bringForward();
    }

    handleSendBackwardButtonClick() {
        this.store.sendBackward();
    }

    handleSendToBackButtonClick() {
        this.store.sendToBack();
    }
}

function createNewLineSessionHandlers(
    canvasStateStore: CanvasStateStore,
    viewportProvider: StateProvider<ViewportStore>,
): PointerEventSessionHandlers {
    return {
        type: "new-line",
        onPointerUp: (data) => {
            const page = canvasStateStore.getState().page;
            const transaction = new Transaction(
                canvasStateStore.getState().page,
            );

            let p1: PointObject;
            const nearestPoint1 = getNearestPoint(
                page,
                data.startX,
                data.startY,
                viewportProvider.getState().scale,
                [],
            );

            if (isNotNullish(nearestPoint1?.pointId)) {
                const _p1 = page.objects[nearestPoint1.pointId];
                assert(
                    _p1 !== undefined,
                    `Cannot find the highlighted point(${nearestPoint1.pointId})`,
                );
                assert(
                    _p1.type === "point",
                    `Invalid object type: ${_p1.id} ${_p1.type}`,
                );
                p1 = _p1;
            } else if (isNotNullish(nearestPoint1?.lineId)) {
                const parentLine = page.objects[nearestPoint1.lineId];
                assert(
                    parentLine !== undefined,
                    `Line not found: ${nearestPoint1.lineId}`,
                );
                assert(parentLine.type === "line", "Parent is not a line");

                const width = parentLine.x2 - parentLine.x1;
                const height = parentLine.y2 - parentLine.y1;
                const relativePosition =
                    width > height
                        ? (nearestPoint1.x - parentLine.x1) / width
                        : (nearestPoint1.y - parentLine.y1) / height;
                p1 = {
                    type: "point",
                    id: randomId(),
                    x: nearestPoint1.x,
                    y: nearestPoint1.y,
                };
                transaction.insertObjects([p1]).addDependency({
                    type: "pointOnLine",
                    id: randomId(),
                    from: nearestPoint1.lineId,
                    to: p1.id,
                    r: relativePosition,
                });
            } else {
                p1 = {
                    type: "point",
                    id: randomId(),
                    x: data.startX,
                    y: data.startY,
                };
                transaction.insertObjects([p1]);
            }

            let p2: PointObject;
            const nearestPoint2 = getNearestPoint(
                page,
                data.newX,
                data.newY,
                viewportProvider.getState().scale,
                [],
            );

            if (isNotNullish(nearestPoint2?.pointId)) {
                const _p2 = page.objects[nearestPoint2.pointId];
                assert(
                    _p2 !== undefined,
                    `Cannot find the highlighted point(${nearestPoint2.pointId})`,
                );
                assert(
                    _p2.type === "point",
                    `Invalid object type: ${_p2.id} ${_p2.type}`,
                );
                p2 = _p2;
            } else if (isNotNullish(nearestPoint2?.lineId)) {
                const parentLine = page.objects[nearestPoint2.lineId];
                assert(
                    parentLine !== undefined,
                    `Line not found: ${nearestPoint2.lineId}`,
                );
                assert(parentLine.type === "line", "Parent is not a line");

                const width = parentLine.x2 - parentLine.x1;
                const height = parentLine.y2 - parentLine.y1;
                const relativePosition =
                    width > height
                        ? (nearestPoint2.x - parentLine.x1) / width
                        : (nearestPoint2.y - parentLine.y1) / height;
                p2 = {
                    type: "point",
                    id: randomId(),
                    x: nearestPoint2.x,
                    y: nearestPoint2.y,
                };
                transaction.insertObjects([p2]).addDependency({
                    type: "pointOnLine",
                    id: randomId(),
                    from: nearestPoint2.lineId,
                    to: p2.id,
                    r: relativePosition,
                });
            } else {
                p2 = {
                    type: "point",
                    id: randomId(),
                    x: data.newX,
                    y: data.newY,
                };
                transaction.insertObjects([p2]);
            }

            const line: LineObject = {
                id: randomId(),
                type: "line",
                x1: p1.x,
                y1: p1.y,
                x2: p2.x,
                y2: p2.y,
                colorId: canvasStateStore.getState().defaultColorId,
            };
            transaction
                .insertObjects([line])
                .addDependency({
                    id: randomId(),
                    type: "lineEndPoint",
                    lineEnd: 1,
                    from: p1.id,
                    to: line.id,
                })
                .addDependency({
                    id: randomId(),
                    type: "lineEndPoint",
                    lineEnd: 2,
                    from: p2.id,
                    to: line.id,
                });

            canvasStateStore.setPage(transaction.commit());
            canvasStateStore.setMode("select");
            canvasStateStore.unselectAll();
            canvasStateStore.select(line.id);
        },
    };
}

function createNewShapeSessionHandlers(
    canvasStateStore: CanvasStateStore,
): PointerEventSessionHandlers {
    return {
        type: "new-shape",
        onPointerUp: (data) => {
            const width = Math.abs(data.newX - data.startX);
            const height = Math.abs(data.newY - data.startY);
            if (width === 0 || height === 0) return;

            const x = Math.min(data.startX, data.newX);
            const y = Math.min(data.startY, data.newY);
            const shape: ShapeObject = {
                type: "shape",
                id: randomId(),
                x,
                y,
                width,
                height,
                label: "",
                textAlignX: canvasStateStore.getState().defaultTextAlignX,
                textAlignY: canvasStateStore.getState().defaultTextAlignY,
                colorId: canvasStateStore.getState().defaultColorId,
                fillMode: canvasStateStore.getState().defaultFillMode,
                path: getRectanglePath(),
            };
            canvasStateStore.addObjects(shape);
            canvasStateStore.setMode("select");
            canvasStateStore.unselectAll();
            canvasStateStore.select(shape.id);
        },
    };
}

function createMoveSelectedObjectsSessionHandlers(
    x: number,
    y: number,
    shiftKey: boolean,
    canvasStateStore: CanvasStateStore,
    viewportStore: ViewportStore,
): PointerEventSessionHandlers {
    const hitResult = testHitItems(
        canvasStateStore.getState().page,
        x,
        y,
        viewportStore.getState().scale,
    );
    const selectedObjects = canvasStateStore.getState().getSelectedObjects();

    return {
        type: "move",
        onPointerMove: (data) => {
            canvasStateStore.resetAndMoveObjects(
                selectedObjects,
                data.newX - data.startX,
                data.newY - data.startY,
            );
        },
        onClick: () => {
            if (hitResult.orderedByZIndex.length > 0) {
                if (shiftKey) {
                    canvasStateStore.toggleSelect(
                        hitResult.orderedByZIndex[0].object.id,
                    );
                } else {
                    canvasStateStore.unselectAll();
                    canvasStateStore.select(
                        hitResult.orderedByZIndex[0].object.id,
                    );
                }
            }
        },
    };
}

function createMoveObjectSessionHandlers(
    object: Obj,
    shiftKey: boolean,
    canvasStateStore: CanvasStateStore,
): PointerEventSessionHandlers {
    if (!shiftKey) {
        canvasStateStore.unselectAll();
    }
    canvasStateStore.select(object.id);

    const selectedObjects = canvasStateStore.getState().getSelectedObjects();

    return {
        type: "move",
        onPointerMove: (data) => {
            canvasStateStore.resetAndMoveObjects(
                selectedObjects,
                data.newX - data.startX,
                data.newY - data.startY,
            );
        },
    };
}

function createSelectByRangeSessionHandlers(
    canvasStateStore: CanvasStateStore,
): PointerEventSessionHandlers {
    const originalSelectedObjectIds =
        canvasStateStore.getState().selectedObjectIds;

    return {
        type: "selector",
        onPointerMove: (data) => {
            const selectionRect = {
                x: Math.min(data.startX, data.newX),
                y: Math.min(data.startY, data.newY),
                width: Math.abs(data.newX - data.startX),
                height: Math.abs(data.newY - data.startY),
            };
            const selectedObjectIds = new Set(originalSelectedObjectIds);

            for (const obj of Object.values(
                canvasStateStore.getState().page.objects,
            )) {
                switch (obj.type) {
                    case "shape": {
                        if (isRectOverlapWithRect(selectionRect, obj)) {
                            selectedObjectIds.add(obj.id);
                        }
                        break;
                    }
                    case "line": {
                        if (isRectOverlapWithLine(selectionRect, obj)) {
                            selectedObjectIds.add(obj.id);
                        }
                        break;
                    }
                    case "point": {
                        if (isRectOverlapWithPoint(selectionRect, obj)) {
                            selectedObjectIds.add(obj.id);
                        }
                        break;
                    }
                }
            }

            canvasStateStore.setSelectedObjectIds([...selectedObjectIds]);
        },
    };
}

function createMovePointSessionHandlers(
    originalPoint: PointObject,
    canvasStateStore: CanvasStateStore,
    viewportProvider: StateProvider<ViewportStore>,
): PointerEventSessionHandlers {
    return {
        type: "move-point",
        onPointerMove: (data) => {
            const nearestPoint = getNearestPoint(
                canvasStateStore.getState().page,
                data.newX,
                data.newY,
                viewportProvider.getState().scale,
                [originalPoint.id],
            );

            const x =
                nearestPoint?.x ?? originalPoint.x + (data.newX - data.startX);
            const y =
                nearestPoint?.y ?? originalPoint.y + (data.newY - data.startY);

            canvasStateStore.setPage(
                new Transaction(canvasStateStore.getState().page)
                    .setPointPosition(originalPoint.id, x, y)
                    .commit(),
            );
        },
        onPointerUp: (data) => {
            const transaction = new Transaction(
                canvasStateStore.getState().page,
            );

            const nearestPoint = getNearestPoint(
                canvasStateStore.getState().page,
                data.newX,
                data.newY,
                viewportProvider.getState().scale,
                [originalPoint.id],
            );

            if (isNotNullish(nearestPoint?.pointId)) {
                transaction.mergePoints(originalPoint.id, nearestPoint.pointId);
            } else if (isNotNullish(nearestPoint?.lineId)) {
                const line =
                    canvasStateStore.getState().page.objects[
                        nearestPoint.lineId
                    ];
                assert(
                    line !== undefined,
                    `Line not found: ${nearestPoint.lineId}`,
                );
                assert(line.type === "line", "Parent is not a line");

                const width = line.x2 - line.x1;
                const height = line.y2 - line.y1;

                const relativePosition =
                    width > height
                        ? (nearestPoint.x - line.x1) / width
                        : (nearestPoint.y - line.y1) / height;

                transaction.addDependency({
                    id: line.id,
                    type: "pointOnLine",
                    from: nearestPoint.lineId,
                    to: originalPoint.id,
                    r: relativePosition,
                });
            }

            canvasStateStore.setPage(transaction.commit());
        },
    };
}

function createXYResizeSessionHandlers(
    originalObjects: Obj[],
    originX: number,
    originY: number,
    canvasStateStore: CanvasStateStore,
): PointerEventSessionHandlers {
    return {
        type: "resize",
        onPointerMove: (data) => {
            canvasStateStore.resetAndScaleObjects(
                originalObjects,
                (data.newX - originX) / (data.startX - originX),
                (data.newY - originY) / (data.startY - originY),
                originX,
                originY,
            );
        },
    };
}

function createXResizeSessionHandlers(
    originalObjects: Obj[],
    originX: number,
    canvasStateStore: CanvasStateStore,
): PointerEventSessionHandlers {
    return {
        type: "resize",
        onPointerMove: (data) => {
            canvasStateStore.resetAndScaleObjects(
                originalObjects,
                (data.newX - originX) / (data.startX - originX),
                1,
                originX,
                0,
            );
        },
    };
}

function createYResizeSessionHandlers(
    originalObjects: Obj[],
    originY: number,
    canvasStateStore: CanvasStateStore,
): PointerEventSessionHandlers {
    return {
        type: "resize",
        onPointerMove: (data) => {
            canvasStateStore.resetAndScaleObjects(
                originalObjects,
                1,
                (data.newY - originY) / (data.startY - originY),
                0,
                originY,
            );
        },
    };
}
