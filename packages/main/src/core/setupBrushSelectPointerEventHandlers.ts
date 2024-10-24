import { assert } from "../lib/assert";
import { Rect } from "../lib/geo/Rect";
import type { App } from "./App";
import type { CanvasPointerEvent } from "./ModeController";
import { SelectEntityModeController } from "./SelectEntityModeController";
import type { SelectEntityModeStateStore } from "./SelectEntityModeStateStore";

export function setupBrushSelectPointerEventHandlers(
    app: App,
    ev: CanvasPointerEvent,
    brushStore: SelectEntityModeStateStore,
) {
    const mode = app.appStateStore.getState().mode;
    assert(
        mode === SelectEntityModeController.MODE_NAME,
        `Invalid mode: ${mode}`,
    );

    const originalSelectedEntityIds =
        app.canvasStateStore.getState().selectedEntityIds;

    brushStore.setBrushRect(new Rect({ p0: ev.point, p1: ev.point }));

    app.gestureRecognizer
        .addPointerMoveHandler(ev.pointerId, (app, ev) => {
            const rect = Rect.fromPoints(ev.startPoint, ev.point);
            brushStore.setBrushRect(rect);

            const selectedEntityIds = new Set(originalSelectedEntityIds);
            for (const entity of app.canvasStateStore
                .getState()
                .page.entities.values()) {
                if (entity.isOverlapWith(rect)) {
                    selectedEntityIds.add(entity.props.id);
                }
            }

            app.canvasStateStore.setSelectedEntityIds(selectedEntityIds);
        })
        .addPointerUpHandler(ev.pointerId, () => {
            brushStore.setBrushRect(null);
        });
}
