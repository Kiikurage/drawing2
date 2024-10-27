import type { ReactNode } from "react";
import { SelectPathModeController } from "../core/SelectPathModeController";
import { PathEntity } from "../default/entity/PathEntity/PathEntity";
import { assert } from "../lib/assert";
import { useStore } from "./hooks/useStore";
import { useApp } from "./useApp";

export function SelectPathControlLayer() {
    const app = useApp();

    const modeController = app.getModeController();
    if (!(modeController instanceof SelectPathModeController)) return null;

    return <SelectPathControlLayerInner modeController={modeController} />;
}

export function SelectPathControlLayerInner({
    modeController,
}: {
    modeController: SelectPathModeController;
}) {
    const app = useApp();
    const appState = useStore(app.appStateStore);
    const { pointerPosition } = useStore(app.store);
    const canvasState = useStore(app.canvasStateStore);
    const viewport = useStore(app.viewportStore);
    const { highlightedItemIds, highlightCenterOfEdgeHandle } =
        modeController.computeControlLayerData(app, pointerPosition);
    if (appState.mode !== SelectPathModeController.MODE_NAME) return null;

    const entityId = canvasState.selectedEntityIds.values().next().value;
    assert(entityId !== undefined, "Entity not selected");

    const entity = canvasState.page.entities.get(entityId);
    assert(entity !== undefined, `Entity not found: ${entityId}`);
    assert(entity instanceof PathEntity, `Entity is not a path: ${entityId}`);

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
            {entity.getEdges().map((edge) => {
                const highlighted = highlightedItemIds.has(edge.id);

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
                            strokeWidth: highlighted ? 3 : 1,
                            stroke: "var(--color-selection)",
                        }}
                    />,
                );

                if (highlighted) {
                    if (highlightCenterOfEdgeHandle) {
                        nodes.push(
                            <circle
                                key={`${edge.p1.id}-${edge.p2.id}-center`}
                                cx={(p1.x + p2.x) / 2}
                                cy={(p1.y + p2.y) / 2}
                                r={5}
                                css={{
                                    strokeWidth: 2,
                                    stroke: "var(--color-selection)",
                                    fill: "#fff",
                                }}
                            />,
                        );
                    } else {
                        nodes.push(
                            <circle
                                key={`${edge.p1.id}-${edge.p2.id}-center`}
                                cx={(p1.x + p2.x) / 2}
                                cy={(p1.y + p2.y) / 2}
                                r={3}
                                css={{
                                    fill: "var(--color-selection)",
                                }}
                            />,
                        );
                    }
                }

                return nodes;
            })}
            {entity.getNodes().map((node) => {
                const point = viewport.transform.apply(node);
                const highlighted = highlightedItemIds.has(node.id);

                return (
                    <circle
                        key={node.id}
                        cx={point.x}
                        cy={point.y}
                        r={5}
                        css={{
                            strokeWidth: highlighted ? 3 : 1,
                            stroke: "var(--color-selection)",
                            fill: "#fff",
                        }}
                    />
                );
            })}
        </svg>
    );
}
