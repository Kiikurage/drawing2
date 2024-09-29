import styled from "@emotion/styled";
import { isNotNullish } from "../lib/isNullish";
import { useCanvasEventHandler, useCanvasState } from "./StoreProvider";

export function SelectionRect() {
	const state = useCanvasState();
	const handlers = useCanvasEventHandler();
	const selectionRect = state.selectionRect;
	if (selectionRect === null) return null;

	const { x, y, width, height } = selectionRect;
	const shapes = state.selectedShapeIds
		.map((id) => state.page.shapes.get(id))
		.filter(isNotNullish);
	const lines = state.selectedShapeIds
		.map((id) => state.page.lines.get(id))
		.filter(isNotNullish);
	const isSingleLineMode = shapes.length === 0 && lines.length === 1;

	return (
		<div
			css={{
				position: "absolute",
				left: (x - state.viewport.x) * state.viewport.scale,
				top: (y - state.viewport.y) * state.viewport.scale,
				width: width * state.viewport.scale,
				height: height * state.viewport.scale,
				pointerEvents: "none",
			}}
		>
			<svg
				viewBox="0 0 1 1"
				width={1}
				height={1}
				css={{
					position: "absolute",
					inset: 0,
					overflow: "visible",
				}}
			>
				{!isSingleLineMode && (
					<rect
						css={{
							stroke: "var(--color-selection)",
							fill: "none",
						}}
						x={0}
						y={0}
						width={width * state.viewport.scale}
						height={height * state.viewport.scale}
						strokeWidth={3}
					/>
				)}
				{shapes.map((shape) => (
					<rect
						key={shape.id}
						css={{
							stroke: "var(--color-selection)",
							fill: "none",
						}}
						x={(shape.x - x) * state.viewport.scale}
						y={(shape.y - y) * state.viewport.scale}
						width={shape.width * state.viewport.scale}
						height={shape.height * state.viewport.scale}
						strokeWidth={1}
					/>
				))}
				{lines.map((line) => (
					<line
						key={line.id}
						css={{
							stroke: "var(--color-selection)",
							fill: "none",
						}}
						x1={(line.x1 - x) * state.viewport.scale}
						y1={(line.y1 - y) * state.viewport.scale}
						x2={(line.x2 - x) * state.viewport.scale}
						y2={(line.y2 - y) * state.viewport.scale}
						strokeWidth={1}
					/>
				))}
			</svg>
			{isSingleLineMode && state.mode === "select" && (
				<>
					<ResizeHandle
						css={{
							left: (lines[0].x1 - x) * state.viewport.scale,
							top: (lines[0].y1 - y) * state.viewport.scale,
							cursor: "grab",
						}}
						onMouseDown={(ev) => {
							ev.stopPropagation();
							ev.preventDefault();
							handlers.handleSelectionLineHandleMouseDown(
								ev.clientX,
								ev.clientY,
								ev.button,
								1,
							);
						}}
					>
						<LineEditHandle />
					</ResizeHandle>
					<ResizeHandle
						css={{
							left: (lines[0].x2 - x) * state.viewport.scale,
							top: (lines[0].y2 - y) * state.viewport.scale,
							cursor: "grab",
						}}
						onMouseDown={(ev) => {
							ev.stopPropagation();
							ev.preventDefault();
							handlers.handleSelectionLineHandleMouseDown(
								ev.clientX,
								ev.clientY,
								ev.button,
								2,
							);
						}}
					>
						<LineEditHandle />
					</ResizeHandle>
				</>
			)}
			{!isSingleLineMode && state.mode === "select" && (
				<>
					<ResizeHandle
						css={{ top: "0%", left: "0%", width: "100%", cursor: "ns-resize" }}
						onMouseDown={(ev) => {
							ev.stopPropagation();
							ev.preventDefault();
							handlers.handleSelectionRectHandleMouseDown(
								ev.clientX,
								ev.clientY,
								ev.button,
								"top",
							);
						}}
					/>
					<ResizeHandle
						css={{
							top: "0%",
							left: "100%",
							height: "100%",
							cursor: "ew-resize",
						}}
						onMouseDown={(ev) => {
							ev.stopPropagation();
							ev.preventDefault();
							handlers.handleSelectionRectHandleMouseDown(
								ev.clientX,
								ev.clientY,
								ev.button,
								"right",
							);
						}}
					/>
					<ResizeHandle
						css={{
							top: "100%",
							left: "0%",
							width: "100%",
							cursor: "ns-resize",
						}}
						onMouseDown={(ev) => {
							ev.stopPropagation();
							ev.preventDefault();
							handlers.handleSelectionRectHandleMouseDown(
								ev.clientX,
								ev.clientY,
								ev.button,
								"bottom",
							);
						}}
					/>
					<ResizeHandle
						css={{ top: "0%", left: "0%", height: "100%", cursor: "ew-resize" }}
						onMouseDown={(ev) => {
							ev.stopPropagation();
							ev.preventDefault();
							handlers.handleSelectionRectHandleMouseDown(
								ev.clientX,
								ev.clientY,
								ev.button,
								"left",
							);
						}}
					/>

					<ResizeHandle
						css={{ top: "0%", left: "0%", cursor: "nwse-resize" }}
						onMouseDown={(ev) => {
							ev.stopPropagation();
							ev.preventDefault();
							handlers.handleSelectionRectHandleMouseDown(
								ev.clientX,
								ev.clientY,
								ev.button,
								"topLeft",
							);
						}}
					>
						<CornerResizeHandle />
					</ResizeHandle>
					<ResizeHandle
						css={{ top: "0%", left: "100%", cursor: "nesw-resize" }}
						onMouseDown={(ev) => {
							ev.stopPropagation();
							ev.preventDefault();
							handlers.handleSelectionRectHandleMouseDown(
								ev.clientX,
								ev.clientY,
								ev.button,
								"topRight",
							);
						}}
					>
						<CornerResizeHandle />
					</ResizeHandle>
					<ResizeHandle
						css={{ top: "100%", left: "100%", cursor: "nwse-resize" }}
						onMouseDown={(ev) => {
							ev.stopPropagation();
							ev.preventDefault();
							handlers.handleSelectionRectHandleMouseDown(
								ev.clientX,
								ev.clientY,
								ev.button,
								"bottomRight",
							);
						}}
					>
						<CornerResizeHandle />
					</ResizeHandle>
					<ResizeHandle
						css={{ top: "100%", left: "0%", cursor: "nesw-resize" }}
						onMouseDown={(ev) => {
							ev.stopPropagation();
							ev.preventDefault();
							handlers.handleSelectionRectHandleMouseDown(
								ev.clientX,
								ev.clientY,
								ev.button,
								"bottomLeft",
							);
						}}
					>
						<CornerResizeHandle />
					</ResizeHandle>
				</>
			)}
		</div>
	);
}

const ResizeHandle = styled.div({
	position: "absolute",
	transform: "translate(-8px, -8px)",
	minWidth: "16px",
	minHeight: "16px",
	pointerEvents: "all",
});
const CornerResizeHandle = styled.div({
	background: "#fff",
	outline: "2px solid var(--color-selection)",
	boxSizing: "border-box",
	position: "absolute",
	transform: "translate(-50%, -50%)",
	top: "50%",
	left: "50%",
	minWidth: "8px",
	minHeight: "8px",
	pointerEvents: "all",
});
const LineEditHandle = styled.div({
	background: "#fff",
	outline: "2px solid var(--color-selection)",
	borderRadius: "50%",
	boxSizing: "border-box",
	position: "absolute",
	transform: "translate(-50%, -50%)",
	top: "50%",
	left: "50%",
	minWidth: "8px",
	minHeight: "8px",
	pointerEvents: "all",
});
