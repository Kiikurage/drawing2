import { type MouseEventHandler, useCallback } from "react";
import { useCanvasState } from "../CanvasStateStoreProvider";
import { Card } from "../Card";
import { ColorSection } from "./ColorSection";
import { FillModeSection } from "./FillModeSection";
import { OrderSection } from "./OrderSection";
import { TextAlignmentSection } from "./TextAlignmentSection";

export function PropertyPanel() {
    const state = useCanvasState().getPropertyPanelState();
    const handleMouseDown: MouseEventHandler = useCallback((ev) => {
        ev.stopPropagation();
    }, []);

    return (
        <Card onMouseDown={handleMouseDown}>
            {state.colorSectionVisible && <ColorSection />}
            {state.fillModeSectionVisible && <FillModeSection />}
            {state.textAlignSectionVisible && <TextAlignmentSection />}
            {state.orderSectionVisible && <OrderSection />}
        </Card>
    );
}
