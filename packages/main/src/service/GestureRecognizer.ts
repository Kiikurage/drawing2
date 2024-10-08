import type { StateProvider } from "../lib/Store";
import { fromCanvasCoordinate } from "../store/CanvasStateStore";
import type { ViewportStore } from "../store/ViewportStore";
import type {
    PointerEventHandlers,
    PointerEventSession,
    PointerEventSessionData,
} from "./PointerEventSession/PointerEventSession";

const THRESHOLD_CLICK_DURATION_IN_MILLI = 200;

export class GestureRecognizer {
    constructor(
        private readonly viewportProvider: StateProvider<ViewportStore>,
    ) {}

    private readonly sessions = new Map<number, PointerEventSession>();

    onPointerDown?: (
        ev: PointerEvent,
        startSession: (initializer: PointerEventHandlers) => void,
    ) => void;
    onPointerMove?: (ev: PointerEvent) => void;
    onPointerUp?: (ev: PointerEvent) => void;

    handlePointerDown(ev: PointerEvent) {
        this.onPointerDown?.(ev, (handlers) => {
            const [x, y] = fromCanvasCoordinate(
                ev.clientX,
                ev.clientY,
                this.viewportProvider.getState(),
            );
            const timestamp = performance.now();
            const data: PointerEventSessionData = {
                startAt: timestamp,
                endAt: timestamp,
                isShortClick: false,
                startX: x,
                startY: y,
                lastX: x,
                lastY: y,
                newX: x,
                newY: y,
                shiftKey: ev.shiftKey,
                ctrlKey: ev.ctrlKey,
                metaKey: ev.metaKey,
            };

            handlers.onPointerDown?.(data);
            this.sessions.set(ev.pointerId, {
                pointerId: ev.pointerId,
                data,
                handlers,
            });
        });
    }

    handlePointerMove(ev: PointerEvent) {
        this.onPointerMove?.(ev);

        const session = this.sessions.get(ev.pointerId);
        if (session === undefined) return;

        const [x, y] = fromCanvasCoordinate(
            ev.clientX,
            ev.clientY,
            this.viewportProvider.getState(),
        );

        const newData = { ...session.data };
        newData.newX = x;
        newData.newY = y;
        newData.shiftKey = ev.shiftKey;
        newData.ctrlKey = ev.ctrlKey;
        newData.metaKey = ev.metaKey;
        session.handlers?.onPointerMove?.(newData);
        newData.lastX = x;
        newData.lastY = y;

        session.data = newData;
    }

    handlePointerUp(ev: PointerEvent) {
        this.onPointerUp?.(ev);

        const session = this.sessions.get(ev.pointerId);
        if (session === undefined) return;

        const [x, y] = fromCanvasCoordinate(
            ev.clientX,
            ev.clientY,
            this.viewportProvider.getState(),
        );

        const newData = { ...session.data };
        newData.newX = x;
        newData.newY = y;
        newData.shiftKey = ev.shiftKey;
        newData.ctrlKey = ev.ctrlKey;
        newData.metaKey = ev.metaKey;
        newData.endAt = performance.now();
        newData.isShortClick =
            newData.endAt - newData.startAt < THRESHOLD_CLICK_DURATION_IN_MILLI;
        session.handlers?.onPointerUp?.(newData);

        this.sessions.delete(ev.pointerId);
    }
}
