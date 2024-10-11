import type { TransformHandle } from "../../model/TransformHandle";
import type { HistoryManager } from "../HistoryManager";
import type { PointerEventHandlers } from "./PointerEventSession";

export function createTransformSession(
    historyManager: HistoryManager,
    transformHandle: TransformHandle,
): PointerEventHandlers {
    return {
        onPointerDown() {
            historyManager.pause();
        },
        onPointerMove(data) {
            transformHandle?.apply(
                { x: data.newX, y: data.newY },
                { constraint: data.shiftKey, snap: data.ctrlKey },
            );
        },
        onPointerUp() {
            transformHandle?.dispose();
            historyManager.resume();
        },
    };
}
