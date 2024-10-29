import type { CSSObject } from "@emotion/styled";
import { MathJax } from "better-react-mathjax";
import { type ReactNode, memo } from "react";
import { assert } from "../../../lib/assert";
import { useCell } from "../../../react/hooks/useCell";
import { useResizeObserver } from "../../../react/hooks/useResizeObserver";
import { useApp } from "../../../react/useApp";
import { EditTextModeController } from "../../mode/EditTextModeController";
import { Colors, PROPERTY_KEY_COLOR_ID } from "../../property/Colors";
import { PROPERTY_KEY_SIZING_MODE } from "../../property/SizingMode";
import {
    PROPERTY_KEY_TEXT_ALIGNMENT_X,
    type TextAlignment,
} from "../../property/TextAlignment";
import { PROPERTY_KEY_CONTENT, type TextEntity } from "./TextEntity";

export const TextView = memo(function ShapeView({
    entity,
}: { entity: TextEntity }) {
    const app = useApp();
    const mode = useCell(app.mode);
    const selectedEntityIds = useCell(app.canvas.selectedEntityIds);
    const editing =
        mode === EditTextModeController.type &&
        selectedEntityIds.has(entity.id);

    const textAlignment = entity[PROPERTY_KEY_TEXT_ALIGNMENT_X];
    assert(textAlignment !== undefined, "Text alignment must not be null");

    return (
        <div
            style={{
                transform: `translate(${entity.x}px, ${entity.y}px)`,
            }}
            css={{ position: "absolute" }}
        >
            <TextViewInner
                editing={editing}
                shapeId={entity.id}
                width={entity.width}
                sizingMode={entity[PROPERTY_KEY_SIZING_MODE]}
                color={Colors[entity[PROPERTY_KEY_COLOR_ID]]}
                textAlignment={textAlignment}
                content={entity[PROPERTY_KEY_CONTENT]}
            />
        </div>
    );
});

const TextViewInner = memo(function ShapeViewInner({
    shapeId,
    width,
    sizingMode,
    textAlignment,
    color,
    editing,
    content,
}: {
    shapeId: string;
    width: number;
    sizingMode: "content" | "fixed";
    textAlignment: TextAlignment;
    color: string;
    editing: boolean;
    content: string;
}) {
    const app = useApp();

    const containerRef = useResizeObserver((entry) => {
        // ResizeObserver is not affected by CSS transform.
        // So we don't need to care about the viewport scaling.
        app.handleEntityResize(
            shapeId,
            entry.contentRect.width,
            entry.contentRect.height,
        );
    });

    return (
        <div
            ref={containerRef}
            css={{
                color,
                position: "absolute",
                fontSize: 24,
                pointerEvents: "all",
                ...{
                    "start-outside": { textAlign: "start" as const },
                    start: { textAlign: "start" as const },
                    center: { textAlign: "center" as const },
                    end: { textAlign: "end" as const },
                    "end-outside": { textAlign: "end" as const },
                }[textAlignment],
                ...({
                    content: {
                        whiteSpace: "pre",
                        overflow: "visible",
                    },
                    fixed: {
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-all",
                        width,
                    },
                }[sizingMode] as CSSObject),

                h1: {
                    marginTop: "1em",
                    marginBottom: 0,
                    "&:first-child": {
                        marginTop: 0,
                    },
                },
                h2: {
                    marginTop: "1em",
                    marginBottom: 0,
                    "&:first-child": {
                        marginTop: 0,
                    },
                },
                h3: {
                    marginTop: "1em",
                    marginBottom: 0,
                    "&:first-child": {
                        marginTop: 0,
                    },
                },
            }}
        >
            {editing ? (
                <textarea
                    autoFocus={true}
                    autoComplete="off"
                    css={{
                        display: "block",
                        fieldSizing: "content",
                        border: "none",
                        background: "none",
                        font: "inherit",
                        letterSpacing: "inherit",
                        lineHeight: "inherit",
                        outline: "none",
                        resize: "none",
                        textAlign: "inherit",
                        pointerEvents: "all",
                        whiteSpace: "inherit",
                        padding: 0,
                    }}
                    onFocus={(ev) => {
                        ev.target.setSelectionRange(0, ev.target.value.length);
                    }}
                    onChange={(ev) =>
                        app.canvas.edit((builder) => {
                            builder.updateProperty(
                                [shapeId],
                                PROPERTY_KEY_CONTENT,
                                ev.target.value,
                            );
                        })
                    }
                    onPointerDown={(ev) => ev.stopPropagation()}
                    value={content}
                />
            ) : (
                <MathJax>{renderContent(addPostFix(content))}</MathJax>
            )}
        </div>
    );
});

const ZERO_WIDTH_SPACE = "\u200b";

function addPostFix(text: string) {
    if (text.endsWith("\n") || text.endsWith("\r")) {
        return text + ZERO_WIDTH_SPACE;
    }
    return text;
}

function renderContent(text: string): ReactNode {
    const lines = text.split("\n");
    const nodes: ReactNode[] = [];
    const buffer: string[] = [];

    for (const [i, line] of Object.entries(lines)) {
        if (line.startsWith("###")) {
            if (buffer.length > 0) {
                nodes.push(buffer.join("\n"));
                buffer.length = 0;
            }
            nodes.push(<h3 key={i}>{line}</h3>);
        } else if (line.startsWith("##")) {
            if (buffer.length > 0) {
                nodes.push(buffer.join("\n"));
                buffer.length = 0;
            }
            nodes.push(<h2 key={i}>{line}</h2>);
        } else if (line.startsWith("#")) {
            if (buffer.length > 0) {
                nodes.push(buffer.join("\n"));
                buffer.length = 0;
            }
            nodes.push(<h1 key={i}>{line}</h1>);
        } else {
            buffer.push(line);
        }
    }
    if (buffer.length > 0) {
        nodes.push(buffer.join("\n"));
        buffer.length = 0;
    }

    return nodes;
}
