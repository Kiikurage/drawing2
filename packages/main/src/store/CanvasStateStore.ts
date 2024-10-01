import { isLineOverlapWithLine } from "../geo/Line";
import { isRectOverlapWithLine, isRectOverlapWithRect } from "../geo/Rect";
import { Store } from "../lib/Store";
import { assert } from "../lib/assert";
import { isNotNullish } from "../lib/isNullish";
import { CanvasState } from "../model/CanvasState";
import type { ColorId } from "../model/Colors";
import type { FillMode } from "../model/FillMode";
import type { Mode } from "../model/Mode";
import { type Obj, Page, isShape } from "../model/Page";
import type { TextAlignment } from "../model/TextAlignment";
import type { Viewport } from "../model/Viewport";
import { type LineObject, createLineObject } from "../model/obj/LineObject";
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

	addObject(object: Obj) {
		const newObjects = new Map(this.state.page.objects);
		newObjects.set(object.id, object);

		this.setState(
			this.state.copy({
				page: {
					...this.state.page,
					objects: newObjects,
					objectIds: [...this.state.page.objectIds, object.id],
				},
			}),
		);
	}

	deleteObject(ids: string[]) {
		const idSet = new Set(ids);
		const newObjects = new Map(this.state.page.objects);
		for (const id of idSet) {
			newObjects.delete(id);
		}

		this.setState(
			this.state.copy({
				page: {
					...this.state.page,
					objects: newObjects,
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

		for (const original of objects) {
			if (isShape(original)) {
				newObjects.set(original.id, {
					...original,
					x: original.x + deltaX,
					y: original.y + deltaY,
				});
			} else {
				newObjects.set(original.id, {
					...original,
					x1: original.x1 + deltaX,
					y1: original.y1 + deltaY,
					x2: original.x2 + deltaX,
					y2: original.y2 + deltaY,
				});
			}
		}

		this.setState(
			this.state.copy({
				page: {
					...this.state.page,
					objects: newObjects,
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

		for (const original of objects) {
			if (isShape(original)) {
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
			} else {
				newObjects.set(original.id, {
					...original,
					x1: (original.x1 - originX) * scaleX + originX,
					y1: (original.y1 - originY) * scaleY + originY,
					x2: (original.x2 - originX) * scaleX + originX,
					y2: (original.y2 - originY) * scaleY + originY,
				});
			}
		}

		this.setState(
			this.state.copy({
				page: {
					...this.state.page,
					objects: newObjects,
				},
			}),
		);
	}

	updateLinePoint(id: string, point: 1 | 2, x: number, y: number) {
		const obj = this.state.page.objects.get(id);
		if (obj === undefined) return;
		if (isShape(obj)) return;

		const newObjects = new Map(this.state.page.objects);

		if (point === 1) {
			newObjects.set(id, { ...obj, x1: x, y1: y });
		} else {
			newObjects.set(id, { ...obj, x2: x, y2: y });
		}

		this.setState(
			this.state.copy({
				page: {
					...this.state.page,
					objects: newObjects,
				},
			}),
		);
	}

	setLabel(id: string, label: string) {
		const obj = this.state.page.objects.get(id);
		if (obj === undefined) return;
		if (!isShape(obj)) return;

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
			if (!isShape(obj)) continue;

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
			newObjects.set(obj.id, { ...obj, colorId });
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
			if (!isShape(obj)) continue;

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
			this.addObject(obj);
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
							if (isShape(obj)) {
								if (isRectOverlapWithRect(selectionRect, obj)) {
									selectedObjectIds.push(obj.id);
								}
							} else {
								if (isRectOverlapWithLine(selectionRect, obj)) {
									selectedObjectIds.push(obj.id);
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
				this.addObject(shape);
				this.setMode("select");
				this.select(shape.id);
				break;
			}
			case "line": {
				const line = createLineObject(
					this.state.dragStartX,
					this.state.dragStartY,
					this.state.dragCurrentX,
					this.state.dragCurrentY,
					this.state.defaultColorId,
				);
				this.addObject(line);
				this.setMode("select");
				this.select(line.id);
			}
		}
	}

	private saveToLocalStorage() {
		const serializedPage: SerializedPage = {
			objects: this.state.page.objectIds
				.map((id) => this.state.page.objects.get(id))
				.filter(isNotNullish),
		};

		localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(serializedPage));
	}

	private loadFromLocalStorage() {
		try {
			const data = localStorage.getItem(LOCAL_STORAGE_KEY);
			if (data === null) return;

			const serializedPage: SerializedPage = JSON.parse(data);

			const objects = new Map<string, Obj>();
			for (const object of serializedPage.objects) {
				objects.set(object.id, object);
			}

			const objectIds = serializedPage.objects.map((object) => object.id);

			this.setState(
				this.state.copy({
					page: {
						objects,
						objectIds,
					},
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
	obj1: ShapeObject | LineObject,
	obj2: ShapeObject | LineObject,
): boolean {
	if ("width" in obj1) {
		const rect1 = {
			x: obj1.x,
			y: obj1.y,
			width: obj1.width,
			height: obj1.height,
		};

		if ("width" in obj2) {
			return isRectOverlapWithRect(rect1, obj2);
		} else {
			return isRectOverlapWithLine(rect1, obj2);
		}
	} else {
		if ("width" in obj2) {
			const rect2 = {
				x: obj2.x,
				y: obj2.y,
				width: obj2.width,
				height: obj2.height,
			};
			return isRectOverlapWithLine(rect2, obj1);
		} else {
			return isLineOverlapWithLine(obj1, obj2);
		}
	}
}

const LOCAL_STORAGE_KEY = "LocalCanvasStateStore.state.page";
interface SerializedPage {
	objects: Obj[];
}

export async function initializeCanvasStateStore(): Promise<CanvasStateStore> {
	return Promise.resolve(new CanvasStateStore(getRestoreViewportService()));
}
