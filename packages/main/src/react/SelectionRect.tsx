import styled from "@emotion/styled";
import { entityHandleMap, entityViewHandleMap } from "../instance";
import { useController } from "./ControllerProvider";
import { useStore } from "./hooks/useStore";

export function SelectionRect() {
    const controller = useController();
    const appState = useStore(controller.appStateStore);
    const viewport = useStore(controller.viewportStore);
    const canvasState = useStore(controller.canvasStateStore);
    const selectionRect = canvasState.getSelectionRect();
    if (selectionRect === null) return null;

    const entities = canvasState.getSelectedEntities();
    const isSinglePathMode =
        entities.length === 1 && entities[0].type === "path";
    const isSingleTextMode =
        entities.length === 1 && entities[0].type === "text";

    if (appState.mode.type === "edit-text") return null;

    return (
        <div
            css={{
                position: "absolute",
                left:
                    (selectionRect.left - viewport.rect.left) * viewport.scale,
                top: (selectionRect.top - viewport.rect.top) * viewport.scale,
                width: selectionRect.width * viewport.scale,
                height: selectionRect.height * viewport.scale,
            }}
        >
            <svg
                viewBox="0 0 1 1"
                width={1}
                height={1}
                css={{
                    position: "absolute",
                    inset: 0,
                    overflow: "visible",
                }}
            >
                {!isSinglePathMode && (
                    <rect
                        css={{
                            stroke: "var(--color-selection)",
                            fill: "none",
                        }}
                        x={0}
                        y={0}
                        width={selectionRect.width * viewport.scale}
                        height={selectionRect.height * viewport.scale}
                        strokeWidth={3}
                    />
                )}
                {entities.map((entity) => {
                    const d = entityViewHandleMap().getOutline(
                        entity,
                        viewport,
                    );

                    return (
                        <path
                            key={entity.id}
                            css={{
                                stroke: "var(--color-selection)",
                                fill: "none",
                            }}
                            d={d}
                            strokeWidth={1}
                        />
                    );
                })}
            </svg>
            {isSinglePathMode &&
                appState.mode.type === "select" &&
                entityHandleMap()
                    .getNodes(entities[0])
                    .map((node) => (
                        <ResizeHandle
                            key={node.id}
                            css={{
                                left:
                                    (node.point.x - selectionRect.left) *
                                    viewport.scale,
                                top:
                                    (node.point.y - selectionRect.top) *
                                    viewport.scale,
                                cursor: "grab",
                            }}
                        >
                            <PathEditHandle />
                        </ResizeHandle>
                    ))}
            {isSingleTextMode && appState.mode.type === "select" && null}
            {!isSinglePathMode &&
                !isSingleTextMode &&
                appState.mode.type === "select" && (
                    <>
                        <ResizeHandle
                            css={{
                                top: "0%",
                                left: "0%",
                                width: "100%",
                                cursor: "ns-resize",
                            }}
                        />
                        <ResizeHandle
                            css={{
                                top: "0%",
                                left: "100%",
                                height: "100%",
                                cursor: "ew-resize",
                            }}
                        />
                        <ResizeHandle
                            css={{
                                top: "100%",
                                left: "0%",
                                width: "100%",
                                cursor: "ns-resize",
                            }}
                        />
                        <ResizeHandle
                            css={{
                                top: "0%",
                                left: "0%",
                                height: "100%",
                                cursor: "ew-resize",
                            }}
                        />

                        <ResizeHandle
                            css={{
                                top: "0%",
                                left: "0%",
                                cursor: "nwse-resize",
                            }}
                        >
                            <CornerResizeHandle />
                        </ResizeHandle>
                        <ResizeHandle
                            css={{
                                top: "0%",
                                left: "100%",
                                cursor: "nesw-resize",
                            }}
                        >
                            <CornerResizeHandle />
                        </ResizeHandle>
                        <ResizeHandle
                            css={{
                                top: "100%",
                                left: "100%",
                                cursor: "nwse-resize",
                            }}
                        >
                            <CornerResizeHandle />
                        </ResizeHandle>
                        <ResizeHandle
                            css={{
                                top: "100%",
                                left: "0%",
                                cursor: "nesw-resize",
                            }}
                        >
                            <CornerResizeHandle />
                        </ResizeHandle>
                    </>
                )}
        </div>
    );
}

const ResizeHandle = styled.div({
    position: "absolute",
    transform: "translate(-8px, -8px)",
    minWidth: "16px",
    minHeight: "16px",
});
const CornerResizeHandle = styled.div({
    background: "#fff",
    outline: "2px solid var(--color-selection)",
    boxSizing: "border-box",
    position: "absolute",
    transform: "translate(-50%, -50%)",
    top: "50%",
    left: "50%",
    minWidth: "8px",
    minHeight: "8px",
});
const PathEditHandle = styled.div({
    background: "#fff",
    outline: "2px solid var(--color-selection)",
    borderRadius: "50%",
    boxSizing: "border-box",
    position: "absolute",
    transform: "translate(-50%, -50%)",
    top: "50%",
    left: "50%",
    minWidth: "8px",
    minHeight: "8px",
});
