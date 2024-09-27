import { useCallback, useEffect, useState } from "react";

export interface DragState {
	dragging: boolean;
	startX: number;
	startY: number;
	currentX: number;
	currentY: number;
}

export function useDrag({
	onDragEnd,
}: {
	onDragEnd: (state: DragState) => void;
}): {
	state: DragState;

	/**
	 * CallbackRef for the container element.
	 * @param container The container element.
	 */
	containerRef: (container: HTMLElement | null) => void;
} {
	const [state, setState] = useState(() => ({
		dragging: false,
		startX: 0,
		startY: 0,
		currentX: 0,
		currentY: 0,
	}));

	const handleMouseDown = useCallback((ev: MouseEvent) => {
		setState(() => ({
			dragging: true,
			startX: ev.clientX,
			startY: ev.clientY,
			currentX: ev.clientX,
			currentY: ev.clientY,
		}));
	}, []);

	const handleMouseMove = useCallback(
		(ev: MouseEvent) => {
			if (!state.dragging) return;

			setState((state) => ({
				...state,
				currentX: ev.clientX,
				currentY: ev.clientY,
			}));
		},
		[state.dragging],
	);

	const handleMouseUp = useCallback(() => {
		if (!state.dragging) return;

		onDragEnd?.(state);
		setState((state) => ({ ...state, dragging: false }));
	}, [state, onDragEnd]);

	useEffect(() => {
		window.addEventListener("mousemove", handleMouseMove);
		window.addEventListener("mouseup", handleMouseUp);

		return () => {
			window.removeEventListener("mousemove", handleMouseMove);
			window.removeEventListener("mouseup", handleMouseUp);
		};
	}, [handleMouseMove, handleMouseUp]);

	const containerRef = useCallback(
		(container: HTMLElement | null) => {
			if (container === null) return;

			container.addEventListener("mousedown", handleMouseDown);

			// TODO: CallbackRefにclean upを渡すのは王道ではないかも?
			return () => {
				container.removeEventListener("mousedown", handleMouseDown);
			};
		},
		[handleMouseDown],
	);

	return {
		containerRef,
		state,
	};
}
