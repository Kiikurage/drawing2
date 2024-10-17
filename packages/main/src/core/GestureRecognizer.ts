import { assert } from "../lib/assert";
import { Point } from "../lib/geo/Point";
import type { App } from "./App";
import type { CanvasPointerEvent } from "./ModeController";

const THRESHOLD_CLICK_DURATION_IN_MILLI = 200;

export class GestureRecognizer {
    constructor(private readonly app: App) {}

    private readonly sessions = new Map<number, PointerEventSession>();

    handlePointerDown(nativeEv: PointerEvent) {
        const point = this.app.viewportStore
            .getState()
            .fromCanvasCoordinateTransform.apply(
                new Point(nativeEv.clientX, nativeEv.clientY),
            );

        const timestamp = performance.now();

        this.sessions.set(nativeEv.pointerId, {
            pointerId: nativeEv.pointerId,
            startAt: timestamp,
            startPoint: point,
            lastPoint: point,
            pointerMoveHandlers: new Set(),
            pointerUpHandlers: new Set(),
        });
    }

    handlePointerMove(nativeEv: PointerEvent) {
        const session = this.sessions.get(nativeEv.pointerId);
        if (session === undefined) return;

        const point = this.app.viewportStore
            .getState()
            .fromCanvasCoordinateTransform.apply(
                new Point(nativeEv.clientX, nativeEv.clientY),
            );

        for (const handler of session.pointerMoveHandlers) {
            handler(this.app, {
                point,
                pointerId: nativeEv.pointerId,
                shiftKey: nativeEv.shiftKey,
                ctrlKey: nativeEv.ctrlKey,
                metaKey: nativeEv.metaKey,
                preventDefault: (): void => {
                    throw new Error("Function not implemented.");
                },
                startPoint: session.startPoint,
                lastPoint: session.lastPoint,
            });
        }

        session.lastPoint = point;
    }

    handlePointerUp(nativeEv: PointerEvent) {
        const session = this.sessions.get(nativeEv.pointerId);
        if (session === undefined) return;

        const point = this.app.viewportStore
            .getState()
            .fromCanvasCoordinateTransform.apply(
                new Point(nativeEv.clientX, nativeEv.clientY),
            );

        const endAt = performance.now();
        for (const handler of session.pointerUpHandlers) {
            handler(this.app, {
                point,
                pointerId: nativeEv.pointerId,
                shiftKey: nativeEv.shiftKey,
                ctrlKey: nativeEv.ctrlKey,
                metaKey: nativeEv.metaKey,
                preventDefault: (): void => {
                    throw new Error("Function not implemented.");
                },
                startPoint: session.startPoint,
                lastPoint: session.lastPoint,
                isTap:
                    endAt - session.startAt < THRESHOLD_CLICK_DURATION_IN_MILLI,
            });
        }

        this.sessions.delete(nativeEv.pointerId);
    }

    addPointerMoveHandler(
        pointerId: number,
        handler: (app: App, ev: CanvasPointerMoveEvent) => void,
    ): this {
        const session = this.sessions.get(pointerId);
        assert(
            session !== undefined,
            `Pointer session ${pointerId} is not found`,
        );

        session.pointerMoveHandlers.add(handler);
        return this;
    }

    addPointerUpHandler(
        pointerId: number,
        handler: (app: App, ev: CanvasPointerUpEvent) => void,
    ): this {
        const session = this.sessions.get(pointerId);
        assert(
            session !== undefined,
            `Pointer session ${pointerId} is not found`,
        );

        session.pointerUpHandlers.add(handler);
        return this;
    }
}

export interface CanvasPointerMoveEvent extends CanvasPointerEvent {
    startPoint: Point;
    lastPoint: Point;
}

export interface CanvasPointerUpEvent extends CanvasPointerEvent {
    startPoint: Point;
    lastPoint: Point;

    /**
     * A flag that is set to true if the this pointer up event is
     * classified as a "Tap," meaning the touch was brief and
     * involved minimal movement.
     */
    isTap: boolean;
}

interface PointerEventSession {
    pointerId: number;
    startAt: number;
    startPoint: Point;
    lastPoint: Point;
    pointerMoveHandlers: Set<(app: App, ev: CanvasPointerMoveEvent) => void>;
    pointerUpHandlers: Set<(app: App, ev: CanvasPointerUpEvent) => void>;
}
