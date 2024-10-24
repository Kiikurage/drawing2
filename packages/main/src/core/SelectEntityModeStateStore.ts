import { Store } from "../lib/Store";
import { Rect } from "../lib/geo/Rect";
import type { CornerRoundHandleData } from "./SelectEntityModeController";

export class SelectEntityModeStateStore extends Store<{
    brushRect: Rect | null;
    visibleCornerRoundHandles: CornerRoundHandleData[];
}> {
    constructor() {
        super({
            brushRect: Rect.of(0, 0, 0, 0),
            visibleCornerRoundHandles: [],
        });
    }

    setBrushRect(brushRect: Rect | null) {
        this.setState({ ...this.state, brushRect });
    }

    setVisibleCornerRoundHandles(
        visibleCornerRoundHandles: CornerRoundHandleData[],
    ) {
        this.setState({ ...this.state, visibleCornerRoundHandles });
    }
}
