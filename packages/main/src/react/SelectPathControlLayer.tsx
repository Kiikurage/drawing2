import type { ReactNode } from "react";
import { SelectPathModeController } from "../core/mode/SelectPathModeController";
import { Variables } from "./Variables";
import { useApp } from "./hooks/useApp";
import { useCell } from "./hooks/useCell";

export function SelectPathControlLayer() {
    const app = useApp();
    const mode = useCell(app.mode);
    if (mode !== SelectPathModeController.type) return null;

    return <SelectPathControlLayerInner />;
}

export function SelectPathControlLayerInner() {
    const app = useApp();
    const modeController = app.getModeControllerByClass(
        SelectPathModeController,
    );
    const pointerPosition = useCell(app.pointerPosition);
    const viewport = useCell(app.viewport);
    const selectedEdgeIds = useCell(modeController.selectedEdgeIds);
    const selectedNodeIds = useCell(modeController.selectedNodeIds);

    const { edges, nodes, highlightedItemIds, highlightCenterOfEdgeHandle } =
        SelectPathModeController.computeControlLayerData(app, pointerPosition);

    return (
        <svg
            viewBox="0 0 1 1"
            css={{
                position: "absolute",
                left: 0,
                top: 0,
                width: 1,
                height: 1,
                overflow: "visible",
            }}
        >
            {edges.map((edge) => {
                const highlighted = highlightedItemIds.has(edge.id);
                const selected = selectedEdgeIds.has(edge.id);

                const p1 = viewport.transform.apply(edge.p1);
                const p2 = viewport.transform.apply(edge.p2);

                const nodes: ReactNode[] = [];
                nodes.push(
                    <line
                        key={`${edge.p1.id}-${edge.p2.id}`}
                        x1={p1.x}
                        y1={p1.y}
                        x2={p2.x}
                        y2={p2.y}
                        css={{
                            strokeWidth: 1,
                            stroke: Variables.color.control.border,

                            ...(highlighted && {
                                strokeWidth: 1,
                                stroke: Variables.color.control.borderHover,
                            }),
                            ...(selected && {
                                strokeWidth: 3,
                                stroke: Variables.color.control.borderSelected,
                            }),
                        }}
                    />,
                );

                if (highlighted && highlightCenterOfEdgeHandle) {
                    nodes.push(
                        <circle
                            key={`${edge.p1.id}-${edge.p2.id}-center`}
                            cx={(p1.x + p2.x) / 2}
                            cy={(p1.y + p2.y) / 2}
                            r={5}
                            css={{
                                strokeWidth: 1,
                                stroke: Variables.color.control.borderHover,
                                fill: Variables.color.control.background,
                            }}
                        />,
                    );
                }

                return nodes;
            })}
            {nodes.map((node) => {
                const point = viewport.transform.apply(node);
                const highlighted = highlightedItemIds.has(node.id);
                const selected = selectedNodeIds.has(node.id);

                return (
                    <circle
                        key={node.id}
                        cx={point.x}
                        cy={point.y}
                        r={5}
                        css={{
                            strokeWidth: 1,
                            stroke: Variables.color.control.border,
                            fill: Variables.color.control.background,

                            ...(highlighted && {
                                strokeWidth: 1,
                                stroke: Variables.color.control.borderHover,
                                fill: Variables.color.control.background,
                            }),
                            ...(selected && {
                                strokeWidth: 2,
                                fill: Variables.color.control.border,
                                stroke: Variables.color.control.background,
                            }),
                        }}
                    />
                );
            })}
        </svg>
    );
}
