import { Line } from "./Line";
import { Rect } from "./Rect";

export class Point {
    constructor(
        public readonly x: number,
        public readonly y: number,
    ) {}

    equals(other: Point): boolean {
        return this.x === other.x && this.y === other.y;
    }

    getDistance(other: Point): { distance: number; point: Point } {
        return {
            point: this,
            distance: Math.hypot(this.x - other.x, this.y - other.y),
        };
    }

    isOverlappedWith(other: Rect | Line | Point): boolean {
        if (other instanceof Rect) {
            return other.isOverlappedWith(this);
        }
        if (other instanceof Line) {
            return other.isOverlappedWith(this);
        }

        return other.x === this.x && other.y === this.y;
    }
}
