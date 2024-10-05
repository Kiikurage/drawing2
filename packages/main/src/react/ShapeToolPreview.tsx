import { getRectanglePath } from "../geo/path";
import type { ShapeBlock } from "../model/Page";
import type { PointerEventSessionData } from "../service/GestureRecognizer";
import { useController } from "./ControllerProvider";
import { ShapeView } from "./ShapeView";
import { useStore } from "./hooks/useStore";

export function ShapeToolPreview({ data }: { data: PointerEventSessionData }) {
    const controller = useController();
    const appState = useStore(controller.appStateStore);

    const x1 = data.startX;
    const y1 = data.startY;
    const x2 = data.lastX;
    const y2 = data.lastY;

    const shape: ShapeBlock = {
        type: "shape",
        id: "shape-tool-preview",
        x: Math.min(x1, x2),
        y: Math.min(y1, y2),
        width: Math.abs(x2 - x1),
        height: Math.abs(y2 - y1),
        x1,
        y1,
        x2,
        y2,
        label: "",
        textAlignX: appState.defaultTextAlignX,
        textAlignY: appState.defaultTextAlignY,
        colorId: appState.defaultColorId,
        fillMode: appState.defaultFillMode,
        path: getRectanglePath(),
    };

    return <ShapeView shape={shape} isLabelEditing={false} />;
}
