import { isLineOverlapWithLine, isLineOverlapWithPoint } from "../geo/Line";
import {
	isRectOverlapWithLine,
	isRectOverlapWithPoint,
	isRectOverlapWithRect,
} from "../geo/Rect";
import { type StateProvider, Store } from "../lib/Store";
import { assert } from "../lib/assert";
import { isNotNullish } from "../lib/isNullish";
import { CanvasState } from "../model/CanvasState";
import type { ColorId } from "../model/Colors";
import type { FillMode } from "../model/FillMode";
import type { Mode } from "../model/Mode";
import { Page } from "../model/Page";
import {
	type SerializedPage,
	deserializePage,
	serializePage,
} from "../model/SerializedPage";
import type { TextAlignment } from "../model/TextAlignment";
import type { Viewport } from "../model/Viewport";
import { type LineObject, createLineObject } from "../model/obj/LineObject";
import type { Obj } from "../model/obj/Obj";
import { type PointObject, createPointObject } from "../model/obj/PointObject";
import {
	type ShapeObject,
	createShapeObject,
	getRectanglePath,
} from "../model/obj/ShapeObject";
import { ClipboardService } from "../service/ClipboardService";
import { type HoverStateStore, getNearestPoint } from "./HoverStateStore";
import type { ViewportStore } from "./ViewportStore";

// CanvasStateStore -> HighlightPointStore

export class CanvasStateStore extends Store<CanvasState> {
	private hoverStateProvider: StateProvider<HoverStateStore> | null = null;
	private viewportProvider: StateProvider<ViewportStore> | null = null;

	constructor() {
		super(
			new CanvasState({
				page: Page.create(),
				mode: "select",
				selectedObjectIds: [],
				dragType: { type: "none" },
				dragging: false,
				dragStartX: 0,
				dragStartY: 0,
				dragCurrentX: 0,
				dragCurrentY: 0,
				defaultColorId: 0,
				defaultFillMode: "mono",
				defaultTextAlignX: "center",
				defaultTextAlignY: "center",
			}),
		);

		this.loadFromLocalStorage();

		setInterval(() => {
			this.saveToLocalStorage();
		}, 1000);
	}

	setHoverStateProvider(provider: StateProvider<HoverStateStore>) {
		this.hoverStateProvider = provider;
	}

	setViewportProvider(provider: StateProvider<ViewportStore>) {
		this.viewportProvider = provider;
	}

	addPoints(...points: PointObject[]) {
		const newPoints = new Map(this.state.page.points);
		const newObjects = new Map(this.state.page.objects);

		for (const point of points) {
			newPoints.set(point.id, point);

			if (point.parent !== null) {
				const parent = newObjects.get(point.parent.id);
				assert(parent !== undefined, `Parent not found:${point.parent.id}`);
				assert(parent.type === "line", "Parent is not a line");

				const newParent = { ...parent, children: { ...parent.children } };
				newParent.children[point.id] = {
					relativePosition: point.parent.relativePosition,
				};
				newObjects.set(newParent.id, newParent);
			}
		}

		this.setState(
			this.state.setPage({
				...this.state.page,
				points: newPoints,
				objects: newObjects,
			}),
		);
	}

	addObjects(...objects: Obj[]) {
		const newObjects = new Map(this.state.page.objects);
		const newObjectIds = this.state.page.objectIds.slice();
		for (const object of objects) {
			assert(object.type !== "line", "Cannot add a line object directly");

			newObjects.set(object.id, object);
			newObjectIds.push(object.id);
		}

		this.setState(
			this.state.setPage({
				...this.state.page,
				objects: newObjects,
				objectIds: newObjectIds,
			}),
		);
	}

	addLine(p1Id: string, p2Id: string, options: { colorId: ColorId }) {
		const p1 = this.state.page.points.get(p1Id);
		assert(p1 !== undefined, "Cannot find p1");

		const p2 = this.state.page.points.get(p2Id);
		assert(p2 !== undefined, "Cannot find p2");

		const line = createLineObject(p1, p2, options.colorId);

		const newPoints = new Map(this.state.page.points);
		const newObjects = new Map(this.state.page.objects);

		newPoints.set(p1.id, {
			...p1,
			children: new Set([...p1.children, line.id]),
		});
		newPoints.set(p2.id, {
			...p2,
			children: new Set([...p2.children, line.id]),
		});
		newObjects.set(line.id, line);

		this.setState(
			this.state.setPage({
				...this.state.page,
				objects: newObjects,
				points: newPoints,
				objectIds: [...this.state.page.objectIds, line.id],
			}),
		);
	}

	deleteObject(ids: string[]) {
		const idSet = new Set(ids);
		const newObjects = new Map(this.state.page.objects);
		const newPoints = new Map(this.state.page.points);

		for (const id of idSet) {
			const object = this.state.page.objects.get(id);
			assert(object !== undefined, "Cannot find the object to delete");

			switch (object.type) {
				case "shape": {
					break;
				}
				case "line": {
					const p1 = newPoints.get(object.p1Id);
					assert(p1 !== undefined, "Cannot find p1");

					const p2 = newPoints.get(object.p2Id);
					assert(p2 !== undefined, "Cannot find p2");

					const newChildren1 = new Set(p1.children);
					newChildren1.delete(object.id);
					if (newChildren1.size === 0) {
						newPoints.delete(p1.id);
					} else {
						newPoints.set(p1.id, { ...p1, children: newChildren1 });
					}

					const newChildren2 = new Set(p2.children);
					newChildren2.delete(object.id);
					if (newChildren2.size === 0) {
						newPoints.delete(p2.id);
					} else {
						newPoints.set(p2.id, { ...p2, children: newChildren2 });
					}

					break;
				}
			}

			newObjects.delete(id);
		}

		this.setState(
			this.state.setPage({
				...this.state.page,
				objects: newObjects,
				points: newPoints,
				objectIds: this.state.page.objectIds.filter((id) => !idSet.has(id)),
			}),
		);
	}

	deleteSelectedObjects() {
		this.deleteObject(this.state.selectedObjectIds);
	}

	updateZIndex(currentIndex: number, newIndex: number) {
		const newObjectIds = this.state.page.objectIds.slice();
		const [id] = newObjectIds.splice(currentIndex, 1);
		newObjectIds.splice(newIndex, 0, id);

		this.setState(
			this.state.setPage({
				...this.state.page,
				objectIds: newObjectIds,
			}),
		);
	}

	// Command or Pageをスタックで管理
	undo() {}

	redo() {}

	moveObjects(deltaX: number, deltaY: number, objects: Obj[]) {
		const newObjects = new Map(this.state.page.objects);
		const newPoints = new Map(this.state.page.points);

		for (const original of objects) {
			if (original.type === "shape") {
				newObjects.set(original.id, {
					...original,
					x: original.x + deltaX,
					y: original.y + deltaY,
				});
			} else if (original.type === "line") {
				const p1 = this.state.page.points.get(original.p1Id);
				assert(p1 !== undefined, "Cannot find p1");

				const p2 = this.state.page.points.get(original.p2Id);
				assert(p2 !== undefined, "Cannot find p2");

				const newX1 = original.x1 + deltaX;
				const newY1 = original.y1 + deltaY;
				const newX2 = original.x2 + deltaX;
				const newY2 = original.y2 + deltaY;

				this.updatePoint(newPoints, newObjects, p1.id, newX1, newY1);
				this.updatePoint(newPoints, newObjects, p2.id, newX2, newY2);

				this.updateChildrenOfObject(original.id, newObjects, newPoints);
			}
		}

		this.setState(
			this.state.setPage({
				...this.state.page,
				objects: newObjects,
				points: newPoints,
			}),
		);
	}

	updateChildrenOfPoint(
		pointId: string,
		newObjects: Map<string, Obj>,
		newPoints: Map<string, PointObject>,
		visitedIds: Set<string> = new Set(),
	) {
		if (visitedIds.has(pointId)) return;
		visitedIds.add(pointId);

		const point = this.state.page.points.get(pointId);
		assert(point !== undefined, `Point not found: ${pointId}`);

		for (const childId of point.children) {
			const child = newObjects.get(childId);
			assert(child !== undefined, `Child not found: ${childId}`);
			assert(child.type === "line", "Child is not a line");

			newObjects.set(child.id, {
				...child,
				x1: child.p1Id === point.id ? point.x : child.x1,
				y1: child.p1Id === point.id ? point.y : child.y1,
				x2: child.p2Id === point.id ? point.x : child.x2,
				y2: child.p2Id === point.id ? point.y : child.y2,
			});

			this.updateChildrenOfObject(child.id, newObjects, newPoints, visitedIds);
		}
	}

	updateChildrenOfObject(
		objectId: string,
		newObjects: Map<string, Obj>,
		newPoints: Map<string, PointObject>,
		visitedIds: Set<string> = new Set(),
	) {
		if (visitedIds.has(objectId)) return;
		visitedIds.add(objectId);

		const object = this.state.page.objects.get(objectId);
		assert(object !== undefined, `Object not found: ${objectId}`);
		assert(object.type === "line", "Object is not a line");

		for (const [childId, { relativePosition }] of Object.entries(
			object.children,
		)) {
			const child = newPoints.get(childId);
			assert(child !== undefined, `Point not found: ${childId}`);

			newPoints.set(child.id, {
				...child,
				x: object.x1 * (1 - relativePosition) + object.x2 * relativePosition,
				y: object.y1 * (1 - relativePosition) + object.y2 * relativePosition,
			});

			this.updateChildrenOfPoint(child.id, newObjects, newPoints, visitedIds);
		}
	}

	scaleObjects(
		scaleX: number,
		scaleY: number,
		originX: number,
		originY: number,
		objects: Obj[],
	) {
		const newObjects = new Map(this.state.page.objects);
		const newPoints = new Map(this.state.page.points);

		for (const original of objects) {
			if (original.type === "shape") {
				let x = (original.x - originX) * scaleX + originX;
				let y = (original.y - originY) * scaleY + originY;
				let width = original.width * scaleX;
				let height = original.height * scaleY;
				if (width < 0) {
					x += width;
					width = -width;
				}
				if (height < 0) {
					y += height;
					height = -height;
				}

				newObjects.set(original.id, { ...original, x, y, width, height });
			} else if (original.type === "line") {
				const p1 = this.state.page.points.get(original.p1Id);
				assert(p1 !== undefined, "Cannot find p1");

				const p2 = this.state.page.points.get(original.p2Id);
				assert(p2 !== undefined, "Cannot find p2");

				this.updatePoint(
					newPoints,
					newObjects,
					p1.id,
					(original.x1 - originX) * scaleX + originX,
					(original.y1 - originY) * scaleY + originY,
				);
				this.updatePoint(
					newPoints,
					newObjects,
					p2.id,
					(original.x2 - originX) * scaleX + originX,
					(original.y2 - originY) * scaleY + originY,
				);

				this.updateChildrenOfObject(original.id, newObjects, newPoints);
			}
		}

		this.setState(
			this.state.setPage({
				...this.state.page,
				objects: newObjects,
				points: newPoints,
			}),
		);
	}

	updatePoint(
		newPoints: Map<string, PointObject>,
		newObjects: Map<string, Obj>,
		id: string,
		x: number,
		y: number,
	) {
		const point = this.state.page.points.get(id);
		assert(point !== undefined, `Cannot find the point object ${id}`);

		const newPoint = { ...point, x, y };
		newPoints.set(newPoint.id, newPoint);

		this.updateChildrenOfPoint(point.id, newObjects, newPoints);

		this.setState(
			this.state.setPage({
				...this.state.page,
				objects: newObjects,
				points: newPoints,
			}),
		);
	}

	updatePointParent(id: string, parentId: string, relativePosition: number) {
		const point = this.state.page.points.get(id);
		assert(point !== undefined, `Cannot find the point object ${id}`);

		const parent = this.state.page.objects.get(parentId);
		assert(parent !== undefined, `Cannot find the line object ${parentId}`);
		assert(parent.type === "line", "Parent is not a line");

		const newPoints = new Map(this.state.page.points);
		const newObjects = new Map(this.state.page.objects);

		newObjects.set(parent.id, {
			...parent,
			children: {
				...parent.children,
				[point.id]: { relativePosition },
			},
		});
		newPoints.set(point.id, {
			...point,
			x: parent.x1 * (1 - relativePosition) + parent.x2 * relativePosition,
			y: parent.y1 * (1 - relativePosition) + parent.y2 * relativePosition,
			parent: {
				id: parent.id,
				relativePosition,
			},
		});

		this.setState(
			this.state.setPage({
				...this.state.page,
				objects: newObjects,
				points: newPoints,
			}),
		);
	}

	updatePointAndSave(id: string, x: number, y: number) {
		const newObjects = new Map(this.state.page.objects);
		const newPoints = new Map(this.state.page.points);

		this.updatePoint(newPoints, newObjects, id, x, y);

		this.setState(
			this.state.setPage({
				...this.state.page,
				objects: newObjects,
				points: newPoints,
			}),
		);
	}

	mergePoints(fromId: string, toId: string) {
		const fromPoint = this.state.page.points.get(fromId);
		assert(fromPoint !== undefined, `Point not found: ${fromId}`);
		const newFromPoint = { ...fromPoint };

		const toPoint = this.state.page.points.get(toId);
		assert(toPoint !== undefined, `Point not found: ${toId}`);
		const newToPointChildren = new Set(toPoint.children);

		const newObjects = new Map(this.state.page.objects);
		const newPoints = new Map(this.state.page.points);

		for (const childId of newFromPoint.children) {
			const child = newObjects.get(childId);
			assert(child !== undefined, `Child not found: ${childId}`);
			assert(child.type === "line", "Child is not a line");

			newObjects.set(child.id, {
				...child,
				p1Id: child.p1Id === fromId ? toId : child.p1Id,
				p2Id: child.p2Id === fromId ? toId : child.p2Id,
			});
			newToPointChildren.add(child.id);
		}

		newPoints.delete(fromId);
		newPoints.set(toId, { ...toPoint, children: newToPointChildren });

		this.updateChildrenOfPoint(toId, newObjects, newPoints);

		this.setState(
			this.state.setPage({
				...this.state.page,
				objects: newObjects,
				points: newPoints,
			}),
		);
	}

	setLabel(id: string, label: string) {
		const obj = this.state.page.objects.get(id);
		if (obj === undefined) return;
		if (obj.type !== "shape") return;

		const newObjects = new Map(this.state.page.objects);
		newObjects.set(id, { ...obj, label });

		this.setState(
			this.state.setPage({
				...this.state.page,
				objects: newObjects,
			}),
		);
	}

	setTextAlign(textAlignX: TextAlignment, textAlignY: TextAlignment) {
		const newObjects = new Map(this.state.page.objects);
		for (const obj of this.state.getSelectedObjects()) {
			if (obj.type !== "shape") continue;

			newObjects.set(obj.id, { ...obj, textAlignX, textAlignY });
		}

		this.setState(
			this.state
				.setPage({
					...this.state.page,
					objects: newObjects,
				})
				.copy({
					defaultTextAlignX: textAlignX,
					defaultTextAlignY: textAlignY,
				}),
		);
	}

	setColor(colorId: ColorId) {
		const newObjects = new Map(this.state.page.objects);
		for (const obj of this.state.getSelectedObjects()) {
			if (obj.type === "shape" || obj.type === "line") {
				newObjects.set(obj.id, { ...obj, colorId });
			}
		}

		this.setState(
			this.state
				.setPage({
					...this.state.page,
					objects: newObjects,
				})
				.copy({
					defaultColorId: colorId,
				}),
		);
	}

	setFillMode(fillMode: FillMode) {
		const newObjects = new Map(this.state.page.objects);
		for (const obj of this.state.getSelectedObjects()) {
			if (obj.type !== "shape") continue;

			newObjects.set(obj.id, { ...obj, fillMode });
		}

		this.setState(
			this.state
				.setPage({
					...this.state.page,
					objects: newObjects,
				})
				.copy({
					defaultFillMode: fillMode,
				}),
		);
	}

	bringToFront() {
		this.bringForwardOf(this.state.page.objectIds.length - 1);
	}

	bringForward() {
		const selectedIdSet = new Set(this.state.selectedObjectIds);

		let mostBackwardResult = null;
		for (const selectedId of selectedIdSet) {
			const result = this.findForwardOverlappedObject(
				selectedId,
				selectedIdSet,
			);
			if (result === null) continue;
			if (mostBackwardResult === null) {
				mostBackwardResult = result;
			} else {
				if (result.globalIndex < mostBackwardResult.globalIndex) {
					mostBackwardResult = result;
				}
			}
		}
		if (mostBackwardResult === null) {
			// selected objects are already at the front
			return;
		}

		this.bringForwardOf(mostBackwardResult.globalIndex + 1);
	}

	sendToBack() {
		this.sendBackwardOf(0);
	}

	sendBackward() {
		const selectedIdSet = new Set(this.state.selectedObjectIds);

		let mostForwardResult = null;
		for (const selectedId of selectedIdSet) {
			const result = this.findBackwardOverlappedObject(
				selectedId,
				selectedIdSet,
			);
			if (result === null) continue;
			if (mostForwardResult === null) {
				mostForwardResult = result;
			} else {
				if (result.globalIndex > mostForwardResult.globalIndex) {
					mostForwardResult = result;
				}
			}
		}
		if (mostForwardResult === null) {
			// selected objects are already at the front
			return;
		}

		this.sendBackwardOf(mostForwardResult.globalIndex);
	}

	/**
	 * Update the z-index of the selected objects to bring them
	 * forward of the target object
	 * @param targetObjectZIndex
	 */
	private bringForwardOf(targetObjectZIndex: number) {
		const selectedIdSet = new Set(this.state.selectedObjectIds);

		// Current z-index of selected objects
		const currentIndices = [];
		for (let i = 0; i < this.state.page.objectIds.length; i++) {
			if (selectedIdSet.has(this.state.page.objectIds[i])) {
				currentIndices.push(i);
			}
		}

		for (const currentIndex of currentIndices.toReversed()) {
			if (currentIndex >= targetObjectZIndex) continue;

			this.updateZIndex(currentIndex, targetObjectZIndex);
			targetObjectZIndex -= 1;
		}
	}

	/**
	 * Update the z-index of the selected objects to send them
	 * backward of the target object
	 * @param targetObjectZIndex
	 */
	private sendBackwardOf(targetObjectZIndex: number) {
		const selectedIdSet = new Set(this.state.selectedObjectIds);

		// Current z-index of selected objects
		const currentIndices = [];
		for (let i = 0; i < this.state.page.objectIds.length; i++) {
			if (selectedIdSet.has(this.state.page.objectIds[i])) {
				currentIndices.push(i);
			}
		}

		for (const currentIndex of currentIndices) {
			if (currentIndex <= targetObjectZIndex) continue;

			this.updateZIndex(currentIndex, targetObjectZIndex);
			targetObjectZIndex += 1;
		}
	}

	/**
	 * Find the overlapped object with the given object from the objects
	 * located in front of it, and return the most-backward object.
	 */
	private findForwardOverlappedObject(
		objectId: string,
		ignoreObjectIds: Set<string>,
	): { objectId: string; globalIndex: number } | null {
		let globalIndex = 0;
		for (; globalIndex < this.state.page.objectIds.length; globalIndex++) {
			if (this.state.page.objectIds[globalIndex] === objectId) break;
		}

		const refObject = this.state.page.objects.get(objectId);
		assert(refObject !== undefined, "Cannot find the reference object");
		globalIndex++;

		for (; globalIndex < this.state.page.objectIds.length; globalIndex++) {
			const objectId = this.state.page.objectIds[globalIndex];
			if (ignoreObjectIds.has(objectId)) {
				continue;
			}

			const otherObject = this.state.page.objects.get(objectId);

			if (otherObject === undefined) continue;

			if (isOverlapped(refObject, otherObject)) {
				return { objectId, globalIndex };
			}
		}

		return null;
	}

	/**
	 * Find the overlapped object with the given object from the objects
	 * located behind of it, and return the most-forward object.
	 */
	private findBackwardOverlappedObject(
		objectId: string,
		ignoreObjectIds: Set<string>,
	): { objectId: string; globalIndex: number } | null {
		let globalIndex = this.state.page.objectIds.length - 1;
		for (; globalIndex >= 0; globalIndex--) {
			if (this.state.page.objectIds[globalIndex] === objectId) break;
		}

		const refObject = this.state.page.objects.get(objectId);
		assert(refObject !== undefined, "Cannot find the reference object");
		globalIndex--;

		for (; globalIndex >= 0; globalIndex--) {
			const objectId = this.state.page.objectIds[globalIndex];
			if (ignoreObjectIds.has(objectId)) {
				continue;
			}

			const otherObject = this.state.page.objects.get(objectId);

			if (otherObject === undefined) continue;

			if (isOverlapped(refObject, otherObject)) {
				return { objectId, globalIndex };
			}
		}

		return null;
	}

	setMode(mode: Mode) {
		if (this.state.dragging) {
			this.endDrag();
		}

		this.setState(this.state.copy({ mode }));

		if (mode !== "select" && mode !== "text") {
			this.unselectAll();
		}
	}

	select(id: string) {
		this.setState(this.state.select(id));
	}

	selectAll() {
		this.setState(this.state.selectAll());
	}

	unselect(id: string) {
		this.setState(this.state.unselect(id));
	}

	unselectAll() {
		this.setState(this.state.unselectAll());
	}

	toggleSelect(id: string) {
		if (this.state.selectedObjectIds.includes(id)) {
			this.unselect(id);
		} else {
			this.select(id);
		}
	}

	private setSelectedObjectIds(ids: string[]) {
		this.setState(this.state.setSelectedObjectIds(ids));
	}

	copy() {
		if (this.state.selectedObjectIds.length === 0) return;

		const objects = this.state.getSelectedObjects();

		ClipboardService.copy(objects);
	}

	async cut() {
		this.copy();
		this.deleteSelectedObjects();
	}

	async paste(): Promise<void> {
		const { objects, points } = await ClipboardService.paste();

		this.addPoints(...points);
		this.addObjects(...objects);

		this.setSelectedObjectIds(objects.map((obj) => obj.id));
	}

	startDrag(startCanvasX: number, startCanvasY: number, type: DragType) {
		assert(!this.getState().dragging, "Cannot start dragging while dragging");

		const [startX, startY] = fromCanvasCoordinate(
			startCanvasX,
			startCanvasY,
			this.viewportProvider?.getState() ?? { x: 0, y: 0, scale: 1 },
		);

		this.setState(
			this.getState().copy({
				dragType: type,
				dragging: true,
				dragStartX: startX,
				dragStartY: startY,
				dragCurrentX: startX,
				dragCurrentY: startY,
			}),
		);
	}

	updateDrag(currentCanvasX: number, currentCanvasY: number) {
		assert(this.getState().dragging, "Cannot move drag while not dragging");

		const [currentX, currentY] = fromCanvasCoordinate(
			currentCanvasX,
			currentCanvasY,
			this.viewportProvider?.getState() ?? { x: 0, y: 0, scale: 1 },
		);

		this.setState(
			this.getState().copy({
				dragCurrentX: currentX,
				dragCurrentY: currentY,
			}),
		);

		switch (this.state.mode) {
			case "select": {
				switch (this.state.dragType.type) {
					case "select": {
						const selectionRect = this.state.getSelectorRect();
						assert(selectionRect !== null, "Cannot select without a selection");
						const selectedObjectIds =
							this.state.dragType.originalSelectedObjectIds.slice();

						for (const obj of this.state.page.objects.values()) {
							switch (obj.type) {
								case "shape": {
									if (isRectOverlapWithRect(selectionRect, obj)) {
										selectedObjectIds.push(obj.id);
									}
									break;
								}
								case "line": {
									if (isRectOverlapWithLine(selectionRect, obj)) {
										selectedObjectIds.push(obj.id);
									}
									break;
								}
							}
						}
						this.setSelectedObjectIds(selectedObjectIds);
						break;
					}
					case "move": {
						this.moveObjects(
							this.state.dragCurrentX - this.state.dragStartX,
							this.state.dragCurrentY - this.state.dragStartY,
							this.state.dragType.objects,
						);
						break;
					}
					case "move-point": {
						const { originalPoint } = this.state.dragType;
						const nearestPoint = getNearestPoint(
							this.state.page,
							this.state.dragCurrentX,
							this.state.dragCurrentY,
							this.viewportProvider?.getState()?.scale ?? 1,
							[originalPoint.id],
						);

						const x =
							nearestPoint?.x ??
							originalPoint.x +
								(this.state.dragCurrentX - this.state.dragStartX);
						const y =
							nearestPoint?.y ??
							originalPoint.y +
								(this.state.dragCurrentY - this.state.dragStartY);

						this.updatePointAndSave(originalPoint.id, x, y);
						break;
					}
					case "nwse-resize":
					case "nesw-resize": {
						this.scaleObjects(
							(this.state.dragCurrentX - this.state.dragType.originX) /
								(this.state.dragStartX - this.state.dragType.originX),
							(this.state.dragCurrentY - this.state.dragType.originY) /
								(this.state.dragStartY - this.state.dragType.originY),
							this.state.dragType.originX,
							this.state.dragType.originY,
							this.state.dragType.objects,
						);
						break;
					}
					case "ns-resize": {
						this.scaleObjects(
							1,
							(this.state.dragCurrentY - this.state.dragType.originY) /
								(this.state.dragStartY - this.state.dragType.originY),
							0,
							this.state.dragType.originY,
							this.state.dragType.objects,
						);
						break;
					}
					case "ew-resize": {
						this.scaleObjects(
							(this.state.dragCurrentX - this.state.dragType.originX) /
								(this.state.dragStartX - this.state.dragType.originX),
							1,
							this.state.dragType.originX,
							0,
							this.state.dragType.objects,
						);
						break;
					}
				}
				break;
			}
		}
	}

	endDrag() {
		assert(this.state.dragging, "Cannot end drag while not dragging");
		const dragType = this.state.dragType;

		this.setState(
			this.state.copy({
				dragging: false,
				dragType: { type: "none" },
			}),
		);

		switch (this.state.mode) {
			case "select": {
				switch (dragType.type) {
					case "move-point": {
						const { originalPoint } = dragType;
						const nearestPoint = getNearestPoint(
							this.state.page,
							this.state.dragCurrentX,
							this.state.dragCurrentY,
							this.viewportProvider?.getState()?.scale ?? 1,
							[originalPoint.id],
						);

						if (isNotNullish(nearestPoint?.pointId)) {
							this.mergePoints(originalPoint.id, nearestPoint.pointId);
						} else if (isNotNullish(nearestPoint?.lineId)) {
							const line = this.state.page.objects.get(nearestPoint.lineId);
							assert(
								line !== undefined,
								`Line not found: ${nearestPoint.lineId}`,
							);
							assert(line.type === "line", "Parent is not a line");

							const width = line.x2 - line.x1;
							const height = line.y2 - line.y1;

							const relativePosition =
								width > height
									? (nearestPoint.x - line.x1) / width
									: (nearestPoint.y - line.y1) / height;

							this.updatePointParent(
								originalPoint.id,
								nearestPoint?.lineId,
								relativePosition,
							);
						}
						break;
					}
				}
				break;
			}
			case "shape": {
				const width = Math.abs(this.state.dragCurrentX - this.state.dragStartX);
				const height = Math.abs(
					this.state.dragCurrentY - this.state.dragStartY,
				);
				if (width === 0 || height === 0) break;

				const x = Math.min(this.state.dragStartX, this.state.dragCurrentX);
				const y = Math.min(this.state.dragStartY, this.state.dragCurrentY);
				const shape = createShapeObject(
					x,
					y,
					width,
					height,
					"",
					this.state.defaultTextAlignX,
					this.state.defaultTextAlignY,
					this.state.defaultColorId,
					this.state.defaultFillMode,
					getRectanglePath(),
				);
				this.addObjects(shape);
				this.setMode("select");
				this.select(shape.id);
				break;
			}
			case "line": {
				assert(dragType.type === "new-line", "Invalid drag type");

				let p1: PointObject;
				const nearestPoint1 = getNearestPoint(
					this.state.page,
					this.state.dragStartX,
					this.state.dragStartY,
					this.viewportProvider?.getState()?.scale ?? 1,
					[],
				);

				if (isNotNullish(nearestPoint1?.pointId)) {
					const _p1 = this.state.page.points.get(nearestPoint1.pointId);
					assert(
						_p1 !== undefined,
						`Cannot find the highlighted point(${nearestPoint1.pointId})`,
					);
					p1 = _p1;
				} else if (isNotNullish(nearestPoint1?.lineId)) {
					const parentLine = this.state.page.objects.get(nearestPoint1.lineId);
					assert(
						parentLine !== undefined,
						`Line not found: ${nearestPoint1.lineId}`,
					);
					assert(parentLine.type === "line", "Parent is not a line");

					const width = parentLine.x2 - parentLine.x1;
					const height = parentLine.y2 - parentLine.y1;
					const relativePosition =
						width > height
							? (nearestPoint1.x - parentLine.x1) / width
							: (nearestPoint1.y - parentLine.y1) / height;
					p1 = createPointObject(nearestPoint1.x, nearestPoint1.y, {
						id: parentLine.id,
						relativePosition,
					});
				} else {
					p1 = createPointObject(
						this.state.dragStartX,
						this.state.dragStartY,
						null,
					);
				}

				let p2: PointObject;
				const nearestPoint2 = getNearestPoint(
					this.state.page,
					this.state.dragCurrentX,
					this.state.dragCurrentY,
					this.viewportProvider?.getState()?.scale ?? 1,
					[],
				);

				if (isNotNullish(nearestPoint2?.pointId)) {
					const _p2 = this.state.page.points.get(nearestPoint2.pointId);
					assert(
						_p2 !== undefined,
						`Cannot find the highlighted point(${nearestPoint2.pointId})`,
					);
					p2 = _p2;
				} else if (isNotNullish(nearestPoint2?.lineId)) {
					const parentLine = this.state.page.objects.get(nearestPoint2.lineId);
					assert(
						parentLine !== undefined,
						`Line not found: ${nearestPoint2.lineId}`,
					);
					assert(parentLine.type === "line", "Parent is not a line");

					const width = parentLine.x2 - parentLine.x1;
					const height = parentLine.y2 - parentLine.y1;
					const relativePosition =
						width > height
							? (nearestPoint2.x - parentLine.x1) / width
							: (nearestPoint2.y - parentLine.y1) / height;
					p2 = createPointObject(nearestPoint2.x, nearestPoint2.y, {
						id: parentLine.id,
						relativePosition,
					});
				} else {
					p2 = createPointObject(
						this.state.dragCurrentX,
						this.state.dragCurrentY,
						null,
					);
				}

				const line = createLineObject(p1, p2, this.state.defaultColorId);
				this.addPoints(p1, p2);
				this.addLine(p1.id, p2.id, {
					colorId: this.state.defaultColorId,
				});
				this.setMode("select");
				this.select(line.id);
			}
		}
	}

	private saveToLocalStorage() {
		const serializedPage = serializePage(this.state.page);

		localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(serializedPage));
	}

	private loadFromLocalStorage() {
		try {
			const data = localStorage.getItem(LOCAL_STORAGE_KEY);
			if (data === null) return;

			const serializedPage: SerializedPage = JSON.parse(data);
			const page = deserializePage(serializedPage);

			this.setState(
				this.state.setPage(page).copy({
					selectedObjectIds: [],
				}),
			);
		} catch {}
	}

	protected setState(newState: CanvasState) {
		newState.validate();
		super.setState(newState);
	}
}

export type SelectionRectHandleType =
	| "center"
	| "topLeft"
	| "top"
	| "topRight"
	| "right"
	| "bottomRight"
	| "bottom"
	| "bottomLeft"
	| "left";

export const MouseButton = {
	Left: 0,
	Middle: 1,
	Right: 2,
};

export type DragType =
	| { type: "none" }
	| { type: "new-line" }
	| { type: "select"; originalSelectedObjectIds: string[] }
	| {
			type: "move"; // moving multiple objects
			objects: Obj[];
	  }
	| {
			type: "move-point"; // moving a point in a path
			originalPoint: PointObject;
	  }
	| {
			type: "nwse-resize";
			originX: number;
			originY: number;
			objects: Obj[];
	  }
	| {
			type: "nesw-resize";
			originX: number;
			originY: number;
			objects: Obj[];
	  }
	| {
			type: "ns-resize";
			originY: number;
			objects: Obj[];
	  }
	| {
			type: "ew-resize";
			originX: number;
			objects: Obj[];
	  };

export function fromCanvasCoordinate(
	canvasX: number,
	canvasY: number,
	viewport: Viewport,
): [x: number, y: number] {
	return [
		canvasX / viewport.scale + viewport.x,
		canvasY / viewport.scale + viewport.y,
	];
}

export function isOverlapped(
	obj1: ShapeObject | LineObject | PointObject,
	obj2: ShapeObject | LineObject | PointObject,
): boolean {
	switch (obj1.type) {
		case "shape": {
			const rect1 = {
				x: obj1.x,
				y: obj1.y,
				width: obj1.width,
				height: obj1.height,
			};

			switch (obj2.type) {
				case "shape": {
					return isRectOverlapWithRect(rect1, obj2);
				}
				case "line": {
					return isRectOverlapWithLine(rect1, obj2);
				}
				case "point": {
					return isRectOverlapWithPoint(rect1, obj2);
				}
			}
			break;
		}
		case "line": {
			switch (obj2.type) {
				case "shape": {
					return isOverlapped(obj2, obj1);
				}
				case "line": {
					return isLineOverlapWithLine(obj1, obj2);
				}
				case "point": {
					return isLineOverlapWithPoint(obj1, obj2);
				}
			}
			break;
		}
		case "point": {
			switch (obj2.type) {
				case "shape":
				case "line": {
					return isOverlapped(obj2, obj1);
				}
				case "point": {
					return obj1.x === obj2.x && obj1.y === obj2.y;
				}
			}
			break;
		}
	}
}

const LOCAL_STORAGE_KEY = "LocalCanvasStateStore.state.page";

export async function initializeCanvasStateStore(): Promise<CanvasStateStore> {
	return Promise.resolve(new CanvasStateStore());
}
