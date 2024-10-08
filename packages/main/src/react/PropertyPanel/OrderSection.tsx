import { CardSection } from "../Card";
import { useController } from "../ControllerProvider";
import { PropertyPanelButton } from "./PropertyPanelButton";

export function OrderSection() {
    const controller = useController();

    return (
        <CardSection
            css={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "stretch",
                gap: 4,
                pointerEvents: "all",
            }}
            onPointerDown={(ev) => {
                ev.stopPropagation();
            }}
        >
            <PropertyPanelButton
                onPointerDown={(ev) => {
                    ev.stopPropagation();
                    controller.bringSelectedBlocksToFront();
                }}
            >
                最前面へ
            </PropertyPanelButton>
            <PropertyPanelButton
                onPointerDown={(ev) => {
                    ev.stopPropagation();
                    controller.bringSelectedBlocksForward();
                }}
            >
                ひとつ前へ
            </PropertyPanelButton>
            <PropertyPanelButton
                onPointerDown={(ev) => {
                    ev.stopPropagation();
                    controller.sendSelectedBlocksBackward();
                }}
            >
                ひとつ後ろへ
            </PropertyPanelButton>
            <PropertyPanelButton
                onPointerDown={(ev) => {
                    ev.stopPropagation();
                    controller.sendSelectedBlocksToBack();
                }}
            >
                最背面へ
            </PropertyPanelButton>
        </CardSection>
    );
}
