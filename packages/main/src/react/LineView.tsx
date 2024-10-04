import { memo } from "react";
import { Colors } from "../model/Colors";
import type { LineObject } from "../model/Page";

export const LineView = memo(function LineView({ line }: { line: LineObject }) {
    const canvasX1 = line.x1;
    const canvasY1 = line.y1;
    const canvasX2 = line.x2;
    const canvasY2 = line.y2;

    const left = Math.min(canvasX1, canvasX2);
    const top = Math.min(canvasY1, canvasY2);

    return (
        <svg
            viewBox="0 0 1 1"
            width={1}
            height={1}
            css={{
                position: "absolute",
                left,
                top,
                overflow: "visible",
            }}
        >
            <line
                css={{ stroke: Colors[line.colorId] }}
                x1={canvasX1 - left}
                y1={canvasY1 - top}
                x2={canvasX2 - left}
                y2={canvasY2 - top}
                strokeWidth={5}
                strokeLinecap="round"
            />
        </svg>
    );
});
