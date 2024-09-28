import { dataclass } from "../lib/dataclass";
import { isNotNullish } from "../lib/isNullish";
import { type DragType, computeUnionRect } from "./CanvasStateStore";
import type { Mode } from "./Mode";
import type { Page } from "./Page";
import type { Rect, RectLike, TextAlignment } from "./Rect";
import type { Viewport } from "./Viewport";

export interface CanvasState {
	page: Page;
	mode: Mode;
	viewport: Viewport;
	selectedShapeIds: string[];
	dragType: DragType;
	dragging: boolean;
	dragStartX: number;
	dragStartY: number;
	dragCurrentX: number;
	dragCurrentY: number;
	selectionRect: {
		x: number;
		y: number;
		width: number;
		height: number;
	} | null;
}

export class CanvasState2 extends dataclass<{
	readonly page: Page;
	readonly mode: Mode;
	readonly viewport: Viewport;
	readonly selectedShapeIds: string[];
	readonly dragType: DragType;
	readonly dragging: boolean;
	readonly dragStartX: number;
	readonly dragStartY: number;
	readonly dragCurrentX: number;
	readonly dragCurrentY: number;
}>() {
	get selectorRect(): RectLike | null {
		if (this.dragType.type !== "select") return null;

		return {
			x: Math.min(this.dragStartX, this.dragCurrentX),
			y: Math.min(this.dragStartY, this.dragCurrentY),
			width: Math.abs(this.dragCurrentX - this.dragStartX),
			height: Math.abs(this.dragCurrentY - this.dragStartY),
		};
	}

	get selectionRect(): RectLike | null {
		const rects = this.selectedShapeIds
			.map((id) => this.page.rects.get(id))
			.filter(isNotNullish);
		const lines = this.selectedShapeIds
			.map((id) => this.page.lines.get(id))
			.filter(isNotNullish);

		return computeUnionRect(rects, lines);
	}

	get selectedShapes(): Rect[] {
		return this.selectedShapeIds
			.map((id) => this.page.rects.get(id))
			.filter(isNotNullish);
	}

	getSelectedShapeTextAlignment():
		| [alignX: TextAlignment, alignY: TextAlignment]
		| null {
		const alignXs = new Set(this.selectedShapes.map((rect) => rect.textAlignX));
		const alignYs = new Set(this.selectedShapes.map((rect) => rect.textAlignY));

		if (alignXs.size !== 1 || alignYs.size !== 1) return null;

		// biome-ignore lint/style/noNonNullAssertion: <explanation>
		return [alignXs.values().next().value!, alignYs.values().next().value!];
	}

	isTextEditing(shapeId: string): boolean {
		return this.mode === "text" && this.selectedShapeIds.includes(shapeId);
	}
}
