import type { App } from "../../core/App";
import type { Entity } from "../../core/Entity";
import { LinkToEdge, LinkToRect } from "../../core/Link";
import {
    type CanvasPointerEvent,
    ModeController,
} from "../../core/ModeController";
import type { Page } from "../../core/Page";
import { SelectEntityModeController } from "../../core/SelectEntityModeController";
import { SelectPathModeController } from "../../core/SelectPathModeController";
import { setupMoveNodesPointerEventHandlers } from "../../core/setupMoveNodesPointerEventHandlers";
import { Graph, GraphNode } from "../../core/shape/Graph";
import { Line } from "../../core/shape/Line";
import { translate } from "../../core/shape/TransformMatrix";
import { randomId } from "../../lib/randomId";
import { testHitEntities } from "../../lib/testHitEntities";
import {
    PROPERTY_KEY_ARROW_HEAD_NODE_IDS,
    PROPERTY_KEY_CORNER_RADIUS,
    PathEntity,
} from "../entity/PathEntity/PathEntity";
import { PROPERTY_KEY_COLOR_ID } from "../property/Colors";
import { PROPERTY_KEY_FILL_STYLE } from "../property/FillStyle";
import { PROPERTY_KEY_STROKE_STYLE } from "../property/StrokeStyle";
import { PROPERTY_KEY_STROKE_WIDTH } from "../property/StrokeWidth";

export class NewPathModeController extends ModeController {
    static readonly MODE_NAME = "new-path";

    onRegistered(app: App) {
        app.keyboard.addBinding({
            key: "a",
            // To avoid conflicts with 'Select All' binding
            metaKey: false,
            ctrlKey: false,
            action: (app, ev) => {
                app.setMode(NewPathModeController.MODE_NAME);
            },
        });
        app.keyboard.addBinding({
            key: "l",
            action: (app, ev) => {
                app.setMode(NewPathModeController.MODE_NAME);
            },
        });
        app.keyboard.addBinding({
            key: "Escape",
            mode: [NewPathModeController.MODE_NAME],
            action: (app, ev) => {
                app.canvasStateStore.unselectAll();
                app.setMode(SelectEntityModeController.MODE_NAME);
            },
        });
    }

    onCanvasPointerDown(app: App, ev: CanvasPointerEvent): void {
        app.historyManager.pause();
        const hit = testHitEntities(
            app.canvasStateStore.page.get(),
            ev.point,
            app.viewportStore.state.get().scale,
        );

        const path = this.insertNewPath(
            app,
            new Line(ev.point, translate(1, 1).apply(ev.point)),
        );

        if (hit.entities.length > 0) {
            const { target } = hit.entities[0];
            registerLinkToRect(app, path, path.getNodes()[0], target);
        }

        app.setMode(SelectPathModeController.MODE_NAME);
        app.canvasStateStore.unselectAll();
        app.canvasStateStore.select(path.props.id);

        setupMoveNodesPointerEventHandlers(app, ev, path, [
            path.getNodes()[1].id,
        ]);
        app.gestureRecognizer.addPointerUpHandler(ev.pointerId, (app, ev) => {
            if (ev.isTap) {
                app.canvasStateStore.edit((draft) => {
                    draft.deleteEntity(path.props.id);
                });
            }
        });
    }

    private insertNewPath(app: App, line: Line): PathEntity {
        const node1 = new GraphNode(randomId(), line.p1);
        const node2 = new GraphNode(randomId(), line.p2);
        const graph = Graph.create();
        graph.addEdge(node1, node2);

        const pathEntity = new PathEntity(
            {
                id: randomId(),
                [PROPERTY_KEY_COLOR_ID]: app.defaultPropertyStore.state
                    .get()
                    .getOrDefault(PROPERTY_KEY_COLOR_ID, 0),
                [PROPERTY_KEY_STROKE_STYLE]: app.defaultPropertyStore.state
                    .get()
                    .getOrDefault(PROPERTY_KEY_STROKE_STYLE, "solid"),
                [PROPERTY_KEY_STROKE_WIDTH]: app.defaultPropertyStore.state
                    .get()
                    .getOrDefault(PROPERTY_KEY_STROKE_WIDTH, 2),
                [PROPERTY_KEY_FILL_STYLE]: app.defaultPropertyStore.state
                    .get()
                    .getOrDefault(PROPERTY_KEY_FILL_STYLE, "none"),
                [PROPERTY_KEY_CORNER_RADIUS]: 0,
                [PROPERTY_KEY_ARROW_HEAD_NODE_IDS]: [],
            },
            graph,
        );

        app.canvasStateStore.edit((draft) => {
            draft.setEntity(pathEntity);
        });
        return pathEntity;
    }
}

export function registerLinkToRect(
    app: App,
    nodeOwner: Entity,
    node: GraphNode,
    target: Entity,
) {
    if (nodeOwner.props.id === target.props.id) {
        return;
    }
    if (isOwnedLabel(app.canvasStateStore.page.get(), nodeOwner, target)) {
        return;
    }

    app.canvasStateStore.edit((draft) =>
        draft.addLink(
            new LinkToRect(
                randomId(),
                nodeOwner.props.id,
                node.id,
                target.props.id,
            ),
        ),
    );
}

function isOwnedLabel(page: Page, nodeOwner: Entity, label: Entity): boolean {
    return page.links
        .getByEntityId(nodeOwner.props.id)
        .some(
            (link) =>
                link instanceof LinkToEdge && link.entityId === label.props.id,
        );
}
