export interface PointerEventSession {
    pointerId: number;
    data: PointerEventSessionData;
    handlers: PointerEventHandlers | null;
}

export interface PointerEventHandlers {
    onPointerDown?: (data: PointerEventSessionData) => void;
    onPointerMove?: (data: PointerEventSessionData) => void;
    onPointerUp?: (data: PointerEventSessionData) => void;
}

export interface PointerEventSessionData {
    startAt: number;
    endAt: number;
    isShortClick: boolean;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    newX: number;
    newY: number;
    shiftKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
}

export function mergeHandlers(
    ...handlers: PointerEventHandlers[]
): PointerEventHandlers {
    return {
        onPointerDown(data) {
            for (const session of handlers) {
                session.onPointerDown?.(data);
            }
        },
        onPointerMove(data) {
            for (const session of handlers) {
                session.onPointerMove?.(data);
            }
        },
        onPointerUp(data) {
            for (const session of handlers) {
                session.onPointerUp?.(data);
            }
        },
    };
}
