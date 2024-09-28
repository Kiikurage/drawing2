import { type MouseEventHandler, useCallback } from "react";
import {
	cssVarBackgroundColor,
	cssVarBaseColor,
} from "../../model/ColorPaletteBase";
import type { FillMode } from "../../model/FillMode";
import { CardSection } from "../Card";
import { useCanvasEventHandler, useCanvasState } from "../StoreProvider";

export function FillModeSection() {
	return (
		<CardSection
			css={{ display: "flex", flexDirection: "row", justifyContent: "center" }}
		>
			<div
				css={{
					position: "relative",
					display: "grid",
					gap: 4,
					gridTemplateColumns: "repeat(3, 1fr)",
				}}
			>
				<ColorButton fillMode="none" title="透明" />
				<ColorButton fillMode="mono" title="モノクロで塗りつぶし" />
				<ColorButton fillMode="color" title="同系色で塗りつぶし" />
			</div>
		</CardSection>
	);
}

function ColorButton({
	fillMode,
	title,
}: { fillMode: FillMode; title: string }) {
	const state = useCanvasState();
	const propertyPanelState = state.propertyPanelState;
	const handlers = useCanvasEventHandler();
	const selected = propertyPanelState.fillMode === fillMode;

	const handleClick: MouseEventHandler = useCallback(
		(ev) => {
			ev.stopPropagation();
			handlers.handleFillModeButtonClick(fillMode);
		},
		[handlers, fillMode],
	);

	const colorId = propertyPanelState.colorId ?? state.defaultColorId;

	return (
		<button
			onClick={handleClick}
			type="button"
			title={title}
			aria-selected={selected}
			css={{
				position: "relative",
				border: "none",
				background: "none",
				width: "32px",
				height: "32px",
				borderRadius: 8,
				transition: "background 0.2s",
				cursor: "pointer",

				"&:hover": {
					transition: "background 0.1s",
					background: "#f2f2f2",
				},

				"&::after": {
					content: '""',
					position: "absolute",
					inset: "8px",
					borderRadius: "50%",
					border: "2px solid",
					borderColor: cssVarBaseColor(colorId),
					...{
						none: { borderStyle: "dashed", opacity: 0.3 },
						mono: { background: "#fff" },
						color: { background: cssVarBackgroundColor(colorId) },
					}[fillMode],
				},

				"&[aria-selected='true']": {
					background: "#f2f2f2",
				},
			}}
		/>
	);
}