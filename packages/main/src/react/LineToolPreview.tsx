import type { LineObject } from "../model/Page";
import type { PointerEventSessionData } from "../service/GestureRecognizer";
import { useController } from "./ControllerProvider";
import { LineView } from "./LineView";
import { useStore } from "./hooks/useStore";

export function LineToolPreview({ data }: { data: PointerEventSessionData }) {
    const controller = useController();
    const appState = useStore(controller.appStateStore);

    const line: LineObject = {
        type: "line",
        id: "line-tool-preview",
        x1: data.startX,
        y1: data.startY,
        x2: data.lastX,
        y2: data.lastY,
        colorId: appState.defaultColorId,
    };

    return <LineView line={line} />;
}
