import type { StateProvider } from "../lib/Store";
import { assert } from "../lib/assert";
import { fromCanvasCoordinate } from "./CanvasStateStore";
import type {
    PointerEventHandlers,
    PointerEventSession,
    PointerEventSessionData,
} from "./PointerEventSession";
import type { ViewportStore } from "./ViewportStore";

const THRESHOLD_CLICK_DURATION_IN_MILLI = 200;

export class GestureRecognizer {
    constructor(
        private readonly viewportProvider: StateProvider<ViewportStore>,
    ) {}

    private readonly sessions = new Map<number, PointerEventSession>();

    handlePointerDown(ev: PointerEvent) {
        const point = fromCanvasCoordinate(
            ev.clientX,
            ev.clientY,
            this.viewportProvider.getState(),
        );
        const timestamp = performance.now();
        const data: PointerEventSessionData = {
            startAt: timestamp,
            endAt: timestamp,
            isShortClick: false,
            start: point,
            last: point,
            new: point,
            shiftKey: ev.shiftKey,
            ctrlKey: ev.ctrlKey,
            metaKey: ev.metaKey,
        };

        this.sessions.set(ev.pointerId, {
            pointerId: ev.pointerId,
            data,
            handlers: null,
        });
    }

    handlePointerMove(ev: PointerEvent) {
        const session = this.sessions.get(ev.pointerId);
        if (session === undefined) return;

        const point = fromCanvasCoordinate(
            ev.clientX,
            ev.clientY,
            this.viewportProvider.getState(),
        );

        const newData = { ...session.data };
        newData.new = point;
        newData.shiftKey = ev.shiftKey;
        newData.ctrlKey = ev.ctrlKey;
        newData.metaKey = ev.metaKey;
        session.handlers?.onPointerMove?.(newData);
        newData.last = point;

        session.data = newData;
    }

    handlePointerUp(ev: PointerEvent) {
        const session = this.sessions.get(ev.pointerId);
        if (session === undefined) return;

        const point = fromCanvasCoordinate(
            ev.clientX,
            ev.clientY,
            this.viewportProvider.getState(),
        );

        const newData = { ...session.data };
        newData.new = point;
        newData.shiftKey = ev.shiftKey;
        newData.ctrlKey = ev.ctrlKey;
        newData.metaKey = ev.metaKey;
        newData.endAt = performance.now();
        newData.isShortClick =
            newData.endAt - newData.startAt < THRESHOLD_CLICK_DURATION_IN_MILLI;
        session.handlers?.onPointerUp?.(newData);

        this.sessions.delete(ev.pointerId);
    }

    addSessionHandlers(pointerId: number, handlers: PointerEventHandlers) {
        const session = this.sessions.get(pointerId);
        assert(
            session !== undefined,
            `Pointer session ${pointerId} is not found`,
        );

        handlers.onPointerDown?.(session.data);
        this.sessions.set(pointerId, { ...session, handlers });
    }
}
