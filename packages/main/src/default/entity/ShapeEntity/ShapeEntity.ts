import type { App } from "../../../core/App";
import { Entity, type EntityTapEvent } from "../../../core/Entity";
import type { JSONObject } from "../../../core/JSONObject";
import { Rect } from "../../../lib/geo/Rect";
import type { TransformMatrix } from "../../../lib/geo/TransformMatrix";
import { EditTextModeController } from "../../mode/EditTextModeController";
import { type ColorId, PROPERTY_KEY_COLOR_ID } from "../../property/Colors";
import {
    type FillStyle,
    PROPERTY_KEY_FILL_STYLE,
} from "../../property/FillStyle";
import {
    PROPERTY_KEY_STROKE_STYLE,
    type StrokeStyle,
} from "../../property/StrokeStyle";
import { PROPERTY_KEY_STROKE_WIDTH } from "../../property/StrokeWidth";
import {
    PROPERTY_KEY_TEXT_ALIGNMENT_X,
    PROPERTY_KEY_TEXT_ALIGNMENT_Y,
    type TextAlignment,
} from "../../property/TextAlignment";

export class ShapeEntity extends Entity<{
    id: string;
    rect: Rect;
    [PROPERTY_KEY_CONTENT]: string;
    [PROPERTY_KEY_TEXT_ALIGNMENT_X]: TextAlignment;
    [PROPERTY_KEY_TEXT_ALIGNMENT_Y]: TextAlignment;
    [PROPERTY_KEY_COLOR_ID]: ColorId;
    [PROPERTY_KEY_FILL_STYLE]: FillStyle;
    [PROPERTY_KEY_STROKE_STYLE]: StrokeStyle;
    [PROPERTY_KEY_STROKE_WIDTH]: number;
    path: number[][];
}> {
    readonly type = "shape";

    getBoundingRect(): Rect {
        return this.props.rect;
    }

    transform(transform: TransformMatrix) {
        return this.copy({ rect: transform.apply(this.props.rect) });
    }

    serialize(): SerializedShapeEntity {
        return {
            id: this.props.id,
            type: "shape",
            x: this.props.rect.left,
            y: this.props.rect.top,
            width: this.props.rect.width,
            height: this.props.rect.height,
            label: this.props.content,
            textAlignX: this.props[PROPERTY_KEY_TEXT_ALIGNMENT_X],
            textAlignY: this.props[PROPERTY_KEY_TEXT_ALIGNMENT_Y],
            colorId: this.props[PROPERTY_KEY_COLOR_ID],
            fillStyle: this.props[PROPERTY_KEY_FILL_STYLE],
            strokeStyle: this.props[PROPERTY_KEY_STROKE_STYLE],
            strokeWidth: this.props[PROPERTY_KEY_STROKE_WIDTH],
            path: this.props.path,
        };
    }

    static deserialize(data: JSONObject): ShapeEntity {
        const serialized = data as unknown as SerializedShapeEntity;

        return new ShapeEntity({
            id: serialized.id,
            rect: Rect.of(
                serialized.x,
                serialized.y,
                serialized.width,
                serialized.height,
            ),
            content: serialized.label,
            [PROPERTY_KEY_TEXT_ALIGNMENT_X]: serialized.textAlignX,
            [PROPERTY_KEY_TEXT_ALIGNMENT_Y]: serialized.textAlignY,
            [PROPERTY_KEY_COLOR_ID]: serialized.colorId,
            [PROPERTY_KEY_FILL_STYLE]: serialized.fillStyle,
            [PROPERTY_KEY_STROKE_STYLE]: serialized.strokeStyle,
            [PROPERTY_KEY_STROKE_WIDTH]: serialized.strokeWidth,
            path: serialized.path,
        });
    }

    onTap(app: App, ev: EntityTapEvent) {
        if (ev.selectedOnlyThisEntity) {
            app.setMode(EditTextModeController.createMode(this.props.id));
        }
    }
}

interface SerializedShapeEntity extends JSONObject {
    id: string;
    type: "shape";
    x: number;
    y: number;
    width: number;
    height: number;
    label: string;
    textAlignX: TextAlignment;
    textAlignY: TextAlignment;
    colorId: ColorId;
    fillStyle: FillStyle;
    strokeStyle: StrokeStyle;
    strokeWidth: number;
    path: number[][];
}

export const PROPERTY_KEY_CONTENT = "content";
