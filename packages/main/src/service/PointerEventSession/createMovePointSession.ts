import type { StateProvider } from "../../lib/Store";
import type { PointEntity } from "../../model/Page";
import type { CanvasStateStore } from "../../store/CanvasStateStore";
import type { ViewportStore } from "../../store/ViewportStore";
import type { HistoryManager } from "../HistoryManager";
import type { PointerEventHandlers } from "./PointerEventSession";

export function createMovePointSession(
    originalPoint: PointEntity,
    canvasStateStore: CanvasStateStore,
    viewportProvider: StateProvider<ViewportStore>,
    historyManager: HistoryManager,
): PointerEventHandlers {
    throw new Error("Not Implemented");
    // const ignoreEntityIds = new Set([originalPoint.id]);
    // const page = canvasStateStore.getState().page;
    // const connectedLineIds = page.dependencies
    //     .getByFromEntityId(originalPoint.id)
    //     .map((dep) => dep.to);
    // for (const lineId of connectedLineIds) {
    //     ignoreEntityIds.add(lineId);
    // }
    //
    // const dependenciesToPoint = canvasStateStore
    //     .getState()
    //     .page.dependencies.getByToEntityId(originalPoint.id)
    //     .filter(
    //         (dep) => dep.type === "pointOnShape" || dep.type === "pointOnLine",
    //     );
    //
    // let otherPoint: PointEntity | undefined;
    // if (connectedLineIds.length === 1) {
    //     const lineId = connectedLineIds[0];
    //     const otherPointId = page.dependencies
    //         .getByToEntityId(lineId)
    //         .filter((dep) => dep.type === "blockToPoint")
    //         .map((dep) => dep.from)
    //         .find((pointId) => pointId !== originalPoint.id);
    //
    //     if (otherPointId !== undefined) {
    //         otherPoint = page.points[otherPointId];
    //         assert(otherPoint !== undefined, `Point ${otherPointId} not found`);
    //     }
    // }
    // historyManager.pause();
    //
    // return {
    //     onPointerMove: (data) => {
    //         let x = originalPoint.x + (data.newX - data.startX);
    //         let y = originalPoint.y + (data.newY - data.startY);
    //
    //         if (data.shiftKey && otherPoint !== undefined) {
    //             [x, y] = adjustAngle(
    //                 otherPoint.x,
    //                 otherPoint.y,
    //                 x,
    //                 y,
    //                 0,
    //                 Math.PI / 12,
    //             );
    //         }
    //
    //         const hitTestResult = testHitEntities(
    //             canvasStateStore.getState().page,
    //             x,
    //             y,
    //             viewportProvider.getState().scale,
    //             0,
    //         );
    //
    //         const hitPointEntry = hitTestResult.points.filter(
    //             (item) => !ignoreEntityIds.has(item.target.id),
    //         )[0];
    //         const hitBlockEntry = hitTestResult.blocks.filter(
    //             (item) => !ignoreEntityIds.has(item.target.id),
    //         )[0];
    //         const hitEntry = hitPointEntry ?? hitBlockEntry;
    //
    //         x = hitEntry?.point.x ?? x;
    //         y = hitEntry?.point.y ?? y;
    //
    //         canvasStateStore.setPage(
    //             new Transaction(canvasStateStore.getState().page)
    //                 .setPointPosition(originalPoint.id, x, y)
    //                 .commit(),
    //         );
    //     },
    //     onPointerUp: (data) => {
    //         const transaction = new Transaction(
    //             canvasStateStore.getState().page,
    //         );
    //         transaction.deleteDependencies(
    //             dependenciesToPoint.map((dep) => dep.id),
    //         );
    //
    //         const hitTestResult = testHitEntities(
    //             canvasStateStore.getState().page,
    //             data.newX,
    //             data.newY,
    //             viewportProvider.getState().scale,
    //             0,
    //         );
    //
    //         const hitPointEntry = hitTestResult.points.filter(
    //             (item) => !ignoreEntityIds.has(item.target.id),
    //         )[0];
    //         const hitBlockEntry = hitTestResult.blocks.filter(
    //             (item) => !ignoreEntityIds.has(item.target.id),
    //         )[0];
    //
    //         if (hitPointEntry !== undefined) {
    //             transaction.mergePoints(
    //                 originalPoint.id,
    //                 hitPointEntry.target.id,
    //             );
    //         } else {
    //             switch (hitBlockEntry?.target.type) {
    //                 case "line": {
    //                     const width =
    //                         hitBlockEntry.target.x2 - hitBlockEntry.target.x1;
    //                     const height =
    //                         hitBlockEntry.target.y2 - hitBlockEntry.target.y1;
    //
    //                     const r =
    //                         width > height
    //                             ? (hitBlockEntry.point.x -
    //                                   hitBlockEntry.target.x1) /
    //                               width
    //                             : (hitBlockEntry.point.y -
    //                                   hitBlockEntry.target.y1) /
    //                               height;
    //
    //                     transaction.addDependencies([
    //                         {
    //                             id: randomId(),
    //                             type: "pointOnLine",
    //                             from: hitBlockEntry.target.id,
    //                             to: originalPoint.id,
    //                             r: r,
    //                         },
    //                     ]);
    //                     break;
    //                 }
    //                 case "shape": {
    //                     const rx =
    //                         (hitBlockEntry.point.x - hitBlockEntry.target.x) /
    //                         hitBlockEntry.target.width;
    //                     const ry =
    //                         (hitBlockEntry.point.y - hitBlockEntry.target.y) /
    //                         hitBlockEntry.target.height;
    //
    //                     transaction.addDependencies([
    //                         {
    //                             id: randomId(),
    //                             type: "pointOnShape",
    //                             from: hitBlockEntry.target.id,
    //                             to: originalPoint.id,
    //                             rx,
    //                             ry,
    //                         },
    //                     ]);
    //                     break;
    //                 }
    //             }
    //         }
    //
    //         canvasStateStore.setPage(transaction.commit());
    //         historyManager.resume();
    //     },
    // };
}
