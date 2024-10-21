import type { App } from "../../core/App";
import {
    type CanvasPointerEvent,
    ModeController,
} from "../../core/ModeController";
import { createSelectEntityMode } from "../../core/SelectEntityModeController";
import { Rect } from "../../lib/geo/Rect";
import { randomId } from "../../lib/randomId";
import { TextEntity } from "../entity/TextEntity/TextEntity";
import { PROPERTY_KEY_COLOR_ID } from "../property/Colors";
import { PROPERTY_KEY_TEXT_ALIGNMENT_X } from "../property/TextAlignment";

export class NewTextModeController extends ModeController {
    onRegistered(app: App) {
        app.keyboard.addBinding({
            key: "t",
            action: (app, ev) => {
                app.setMode({ type: "new-text" });
            },
        });
        app.keyboard.addBinding({
            key: "Escape",
            mode: ["new-text"],
            action: (app, ev) => {
                app.setMode(createSelectEntityMode(new Set()));
            },
        });
    }

    onCanvasPointerDown(app: App, ev: CanvasPointerEvent): void {
        app.historyManager.pause();
        const text = this.insertNewText(app, Rect.fromSize(ev.point, 1, 1));

        app.setMode({
            type: "edit-text",
            entityId: text.props.id,
        });

        // To leave focus at the new text entity
        ev.preventDefault();
    }

    private insertNewText(app: App, rect: Rect): TextEntity {
        const text = new TextEntity({
            id: randomId(),
            rect,
            content: "",
            [PROPERTY_KEY_TEXT_ALIGNMENT_X]: app.defaultPropertyStore
                .getState()
                .getOrDefault(PROPERTY_KEY_TEXT_ALIGNMENT_X, "start"),
            [PROPERTY_KEY_COLOR_ID]: app.defaultPropertyStore
                .getState()
                .getOrDefault(PROPERTY_KEY_COLOR_ID, 0),
            sizingMode: "content",
        });

        app.canvasStateStore.edit((draft) => {
            draft.setEntity(text);
        });
        return text;
    }
}
