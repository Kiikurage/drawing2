import type { Rect } from "../../geo/Rect";
import { randomId } from "../../lib/randomId";
import type { ColorId } from "../Colors";
import type { ObjBase } from "./Obj";
import type { PointObject } from "./PointObject";

export interface LineObject extends ObjBase<"line"> {
	p1Id: string;
	x1: number;
	y1: number;
	p2Id: string;
	x2: number;
	y2: number;
	colorId: ColorId;
}

/**
 * Create a LineObject for a given pair of points.
 * This function also returns points updated with the new line Id added.
 *
 * @param p1
 * @param p2
 * @param colorId
 */
export function createLineObject(
	p1: PointObject,
	p2: PointObject,
	colorId: ColorId,
): [p1: PointObject, p2: PointObject, line: LineObject] {
	const line = {
		type: "line",
		id: randomId(),
		p1Id: p1.id,
		x1: p1.x,
		y1: p1.y,
		p2Id: p2.id,
		x2: p2.x,
		y2: p2.y,
		colorId,
	} as const;
	p1 = { ...p1, children: new Set([...Array.from(p1.children), line.id]) };
	p2 = { ...p2, children: new Set([...Array.from(p2.children), line.id]) };

	return [p1, p2, line];
}

export function getBoundingRectOfLineObject(obj: LineObject): Rect {
	return {
		x: Math.min(obj.x1, obj.x2),
		y: Math.min(obj.y1, obj.y2),
		width: Math.abs(obj.x1 - obj.x2),
		height: Math.abs(obj.y1 - obj.y2),
	};
}
