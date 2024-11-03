import type { Line } from "./shape/Line";
import type { Point } from "./shape/Point";

export interface SnapGuide {
    points: Point[];
    lines: Line[];
}

export class SnapGuideMap {
    constructor(readonly guides: ReadonlyMap<string, SnapGuide> = new Map()) {}

    setSnapGuide(key: string, guide: SnapGuide) {
        const guides = new Map(this.guides);
        guides.set(key, guide);
        return new SnapGuideMap(guides);
    }

    deleteSnapGuide(key: string) {
        const guides = new Map(this.guides);
        guides.delete(key);
        return new SnapGuideMap(guides);
    }
}
