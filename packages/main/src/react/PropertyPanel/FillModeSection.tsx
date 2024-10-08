import { ColorPaletteBackground, Colors } from "../../model/Colors";
import type { FillMode } from "../../model/FillMode";
import { CardSection } from "../Card";
import { useController } from "../ControllerProvider";
import { useStore } from "../hooks/useStore";
import { PropertyPanelButton } from "./PropertyPanelButton";

export function FillModeSection() {
    return (
        <CardSection
            css={{
                display: "flex",
                flexDirection: "row",
                justifyContent: "center",
            }}
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
    const controller = useController();
    const state = useStore(controller.propertyPanelStateStore);
    const appState = useStore(controller.appStateStore);
    const selected = state.fillMode === fillMode;

    const colorId = state.colorId ?? appState.defaultColorId;

    return (
        <PropertyPanelButton
            onPointerDown={(ev) => {
                ev.stopPropagation();
                controller.setFillMode(fillMode);
            }}
            title={title}
            aria-selected={selected}
            css={{
                "&::after": {
                    content: '""',
                    position: "absolute",
                    inset: "8px",
                    borderRadius: "50%",
                    border: "2px solid",
                    borderColor: Colors[colorId],
                    ...{
                        none: { borderStyle: "dashed", opacity: 0.3 },
                        mono: { background: "#fff" },
                        color: { background: ColorPaletteBackground[colorId] },
                    }[fillMode],
                },
            }}
        />
    );
}
