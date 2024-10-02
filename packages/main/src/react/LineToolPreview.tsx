import { assert } from "../lib/assert";
import { createLineObject } from "../model/obj/LineObject";
import { createPointObject } from "../model/obj/PointObject";
import { useCanvasState } from "./CanvasStateStoreProvider";
import { LineView } from "./LineView";

export function LineToolPreview() {
	const state = useCanvasState();
	assert(
		state.mode === "line",
		"LineToolPreview must be rendered in line mode",
	);
	assert(state.dragging, "LineToolPreview must be rendered while dragging");

	const p1 = createPointObject(state.dragStartX, state.dragStartY, null);
	const p2 = createPointObject(state.dragCurrentX, state.dragCurrentY, null);
	const line = createLineObject(p1, p2, state.defaultColorId);

	return <LineView line={line} />;
}
