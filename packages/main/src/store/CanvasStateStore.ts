import { isLineOverlapWithLine, isLineOverlapWithPoint } from "../geo/Line";
import {
	isRectOverlapWithLine,
	isRectOverlapWithPoint,
	isRectOverlapWithRect,
} from "../geo/Rect";
import { Store } from "../lib/Store";
import { assert } from "../lib/assert";
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
import {
	type RestoreViewportService,
	getRestoreViewportService,
} from "../service/RestoreViewportService";

export class CanvasStateStore extends Store<CanvasState> {
	constructor(
		protected readonly restoreViewportService: RestoreViewportService,
	) {
		super(
			new CanvasState({
				page: Page.create(),
				mode: "select",
				viewport: {
					x: 0,
					y: 0,
					scale: 1,
				},
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

		this.restoreViewportService.restore().then((viewport) => {
			if (viewport !== null) {
				this.setState(this.state.copy({ viewport }));
			}
		});
		this.loadFromLocalStorage();

		setInterval(() => {
			this.saveToLocalStorage();
		}, 1000);
	}

	addPoints(...points: PointObject[]) {
		const newPoints = new Map(this.state.page.points);
		for (const point of points) {
			newPoints.set(point.id, point);
		}

		this.setState(
			this.state.copy({
				page: {
					...this.state.page,
					points: newPoints,
				},
			}),
		);
	}

	addObjects(...objects: Obj[]) {
		const newObjects = new Map(this.state.page.objects);
		const newObjectIds = this.state.page.objectIds.slice();
		for (const object of objects) {
			newObjects.set(object.id, object);
			newObjectIds.push(object.id);
		}

		this.setState(
			this.state.copy({
				page: {
					...this.state.page,
					objects: newObjects,
					objectIds: newObjectIds,
				},
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
			this.state.copy({
				page: {
					...this.state.page,
					objects: newObjects,
					points: newPoints,
					objectIds: this.state.page.objectIds.filter((id) => !idSet.has(id)),
				},
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
			this.state.copy({
				page: {
					...this.state.page,
					objectIds: newObjectIds,
				},
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

				this.updatePoint(
					newPoints,
					newObjects,
					p1,
					p1.x + deltaX,
					p1.y + deltaY,
				);
				this.updatePoint(
					newPoints,
					newObjects,
					p2,
					p2.x + deltaX,
					p2.y + deltaY,
				);
			}
		}

		this.setState(
			this.state.copy({
				page: {
					...this.state.page,
					objects: newObjects,
					points: newPoints,
				},
			}),
		);
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
					p1,
					(p1.x - originX) * scaleX + originX,
					(p1.y - originY) * scaleY + originY,
				);
				this.updatePoint(
					newPoints,
					newObjects,
					p2,
					(p2.x - originX) * scaleX + originX,
					(p2.y - originY) * scaleY + originY,
				);
			}
		}

		this.setState(
			this.state.copy({
				page: {
					...this.state.page,
					objects: newObjects,
					points: newPoints,
				},
			}),
		);
	}

	updateLinePoint(id: string, point: 1 | 2, x: number, y: number) {
		const obj = this.state.page.objects.get(id);
		if (obj === undefined) return;
		if (obj.type !== "line") return;

		const newObjects = new Map(this.state.page.objects);
		const newPoints = new Map(this.state.page.points);

		const original = this.state.page.points.get(
			point === 1 ? obj.p1Id : obj.p2Id,
		);
		assert(original !== undefined, "Cannot find the original point object");

		this.updatePoint(newPoints, newObjects, original, x, y);

		this.setState(
			this.state.copy({
				page: {
					...this.state.page,
					objects: newObjects,
					points: newPoints,
				},
			}),
		);
	}

	private updatePoint(
		newPoints: Map<string, PointObject>,
		newObjects: Map<String, Obj>,
		original: PointObject,
		x: number,
		y: number,
	) {
		const newObject = { ...original, x, y };
		newPoints.set(original.id, newObject);

		// Move children
		for (const childId of original.children) {
			const child = newObjects.get(childId);
			if (child === undefined) continue;

			if (child.type === "line") {
				newObjects.set(child.id, {
					...child,
					x1: child.p1Id === newObject.id ? newObject.x : child.x1,
					y1: child.p1Id === newObject.id ? newObject.y : child.y1,
					x2: child.p2Id === newObject.id ? newObject.x : child.x2,
					y2: child.p2Id === newObject.id ? newObject.y : child.y2,
				});
			}
		}
	}

	setLabel(id: string, label: string) {
		const obj = this.state.page.objects.get(id);
		if (obj === undefined) return;
		if (obj.type !== "shape") return;

		const newObjects = new Map(this.state.page.objects);
		newObjects.set(id, { ...obj, label });

		this.setState(
			this.state.copy({
				page: {
					...this.state.page,
					objects: newObjects,
				},
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
			this.state.copy({
				page: {
					...this.state.page,
					objects: newObjects,
				},
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
			this.state.copy({
				page: {
					...this.state.page,
					objects: newObjects,
				},
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
			this.state.copy({
				page: {
					...this.state.page,
					objects: newObjects,
				},
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

	moveViewportPosition(deltaCanvasX: number, deltaCanvasY: number) {
		this.setState(
			this.state.copy({
				viewport: {
					...this.state.viewport,
					x: this.state.viewport.x + deltaCanvasX / this.state.viewport.scale,
					y: this.state.viewport.y + deltaCanvasY / this.state.viewport.scale,
				},
			}),
		);
		this.restoreViewportService.save(this.state.viewport);
	}

	setViewportScale(
		newScale: number,
		centerCanvasX: number,
		centerCanvasY: number,
	) {
		this.setState(
			this.state.copy({
				viewport: {
					x:
						centerCanvasX / this.state.viewport.scale -
						centerCanvasX / newScale +
						this.state.viewport.x,
					y:
						centerCanvasY / this.state.viewport.scale -
						centerCanvasY / newScale +
						this.state.viewport.y,
					scale: newScale,
				},
			}),
		);
		this.restoreViewportService.save(this.state.viewport);
	}

	select(id: string) {
		this.setState(
			this.state.copy({
				selectedObjectIds: [...this.state.selectedObjectIds, id],
			}),
		);
	}

	selectAll() {
		this.setSelectedObjectIds(this.state.page.objectIds);
	}

	unselect(id: string) {
		this.setState(
			this.state.copy({
				selectedObjectIds: this.state.selectedObjectIds.filter((i) => i !== id),
			}),
		);
	}

	unselectAll() {
		this.setSelectedObjectIds([]);
	}

	toggleSelect(id: string) {
		if (this.state.selectedObjectIds.includes(id)) {
			this.unselect(id);
		} else {
			this.select(id);
		}
	}

	private setSelectedObjectIds(ids: string[]) {
		this.setState(
			this.state.copy({
				selectedObjectIds: ids,
			}),
		);
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
		const { objects } = await ClipboardService.paste();
		if (objects.length === 0) return;

		for (const obj of objects) {
			this.addObjects(obj);
		}

		this.setSelectedObjectIds(objects.map((obj) => obj.id));
	}

	startDrag(startCanvasX: number, startCanvasY: number, type: DragType) {
		assert(!this.getState().dragging, "Cannot start dragging while dragging");

		const [startX, startY] = fromCanvasCoordinate(
			startCanvasX,
			startCanvasY,
			this.getState().viewport,
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
			this.getState().viewport,
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
						const { point, line } = this.state.dragType;
						if (point === 1) {
							this.updateLinePoint(
								line.id,
								1,
								line.x1 + currentX - this.state.dragStartX,
								line.y1 + currentY - this.state.dragStartY,
							);
						} else {
							this.updateLinePoint(
								line.id,
								2,
								line.x2 + currentX - this.state.dragStartX,
								line.y2 + currentY - this.state.dragStartY,
							);
						}
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

		this.setState(
			this.state.copy({
				dragging: false,
				dragType: { type: "none" },
			}),
		);

		switch (this.state.mode) {
			case "select": {
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
				// TODO
				const _p1 =
					Array.from(this.state.page.points.values())[0] ??
					createPointObject(this.state.dragStartX, this.state.dragStartY);

				const [p1, p2, line] = createLineObject(
					_p1,
					createPointObject(this.state.dragCurrentX, this.state.dragCurrentY),
					this.state.defaultColorId,
				);
				this.addPoints(p1, p2);
				this.addObjects(line);
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
				this.state.copy({
					page,
					selectedObjectIds: [],
				}),
			);
		} catch {}
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
	| { type: "select"; originalSelectedObjectIds: string[] }
	| {
			type: "move"; // moving multiple objects
			objects: Obj[];
	  }
	| {
			type: "move-point"; // moving a point in a path
			line: LineObject;
			point: 1 | 2;
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
	return Promise.resolve(new CanvasStateStore(getRestoreViewportService()));
}
