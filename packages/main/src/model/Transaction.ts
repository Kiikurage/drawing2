import { assert } from "../lib/assert";
import { randomId } from "../lib/randomId";
import type {
    BlockToPointDependency,
    Dependency,
    PointOnLineDependency,
    PointOnShapeDependency,
} from "./Dependency";
import type { DependencyCollection } from "./DependencyCollection";
import { type Block, type Page, type PointEntity, PointKey } from "./Page";

interface CommandBase<T extends string> {
    type: T;
}
interface InsertBlocksCommand extends CommandBase<"INSERT_BLOCKS"> {
    blocks: Block[];
}
interface InsertPointsCommand extends CommandBase<"INSERT_POINTS"> {
    points: PointEntity[];
}
interface DeleteBlocksCommand extends CommandBase<"DELETE_BLOCKS"> {
    blockIds: string[];
}
interface ScaleBlocksCommand extends CommandBase<"SCALE_BLOCKS"> {
    blockIds: string[];
    cx: number;
    cy: number;
    scaleX: number;
    scaleY: number;
}
interface MoveBlocksCommand extends CommandBase<"MOVE_BLOCKS"> {
    blockIds: string[];
    dx: number;
    dy: number;
}
interface SetPointPositionCommand extends CommandBase<"SET_POINT_POSITION"> {
    pointId: string;
    x: number;
    y: number;
}

/**
 * Merge the point `from` into the point `to`. The point `from` will be deleted.
 */
interface MergePointsCommand extends CommandBase<"MERGE_POINTS"> {
    from: string;
    to: string;
}
interface UpdateBlockPropertyCommand
    extends CommandBase<"UPDATE_BLOCK_PROPERTY"> {
    blockIds: string[];
    updater: (block: Readonly<Block>) => Block;
}
interface AddDependencyCommand extends CommandBase<"ADD_DEPENDENCY"> {
    dependency: Dependency;
}
interface DeleteDependenciesCommand extends CommandBase<"DELETE_DEPENDENCIES"> {
    dependencyIds: string[];
}

type Command =
    | InsertBlocksCommand
    | InsertPointsCommand
    | DeleteBlocksCommand
    | ScaleBlocksCommand
    | MoveBlocksCommand
    | SetPointPositionCommand
    | MergePointsCommand
    | UpdateBlockPropertyCommand
    | AddDependencyCommand
    | DeleteDependenciesCommand;

export class Transaction {
    private commands: Command[] = [];

    constructor(private readonly page: Page) {}

    insertBlocks(blocks: Block[]): this {
        this.commands.push({ type: "INSERT_BLOCKS", blocks });
        return this;
    }

    insertPoints(points: PointEntity[]): this {
        this.commands.push({ type: "INSERT_POINTS", points });
        return this;
    }

    deleteBlocks(blockIds: string[]): this {
        this.commands.push({ type: "DELETE_BLOCKS", blockIds });
        return this;
    }

    scaleBlocks(
        blockIds: string[],
        cx: number,
        cy: number,
        scaleX: number,
        scaleY: number,
    ): this {
        this.commands.push({
            type: "SCALE_BLOCKS",
            blockIds,
            cx,
            cy,
            scaleX,
            scaleY,
        });
        return this;
    }

    moveBlocks(blockIds: string[], dx: number, dy: number): this {
        this.commands.push({ type: "MOVE_BLOCKS", blockIds, dx, dy });
        return this;
    }

    setPointPosition(pointId: string, x: number, y: number): this {
        this.commands.push({ type: "SET_POINT_POSITION", pointId, x, y });
        return this;
    }

    mergePoints(from: string, to: string): this {
        this.commands.push({ type: "MERGE_POINTS", from, to });
        return this;
    }

    updateProperty(
        blockIds: string[],
        updater: (block: Readonly<Block>) => Block,
    ): this {
        this.commands.push({
            type: "UPDATE_BLOCK_PROPERTY",
            blockIds,
            updater,
        });
        return this;
    }

    addDependency(dependency: Dependency): this {
        this.commands.push({ type: "ADD_DEPENDENCY", dependency });
        return this;
    }

    deleteDependencies(dependencyIds: string[]): this {
        this.commands.push({ type: "DELETE_DEPENDENCIES", dependencyIds });
        return this;
    }

    commit(): Page {
        const draft: PageDraft = {
            blocks: { ...this.page.blocks },
            points: { ...this.page.points },
            blockIds: [...this.page.blockIds],
            dependencies: this.page.dependencies,
            dirtyEntityIds: [],
        };

        for (const command of this.commands) {
            switch (command.type) {
                case "INSERT_BLOCKS": {
                    insertBlocks(command, draft);
                    break;
                }
                case "INSERT_POINTS": {
                    insertPoints(command, draft);
                    break;
                }
                case "DELETE_BLOCKS": {
                    deleteBlocks(command, draft);
                    break;
                }
                case "SCALE_BLOCKS": {
                    scaleBlocks(command, draft);
                    break;
                }
                case "MOVE_BLOCKS": {
                    moveBlocks(command, draft);
                    break;
                }
                case "SET_POINT_POSITION": {
                    setPointPosition(command, draft);
                    break;
                }
                case "MERGE_POINTS": {
                    mergePoints(command, draft);
                    break;
                }
                case "UPDATE_BLOCK_PROPERTY": {
                    updateShapeProperty(command, draft);
                    break;
                }
                case "ADD_DEPENDENCY": {
                    addDependency(command, draft);
                    break;
                }
                case "DELETE_DEPENDENCIES": {
                    deleteDependencies(command, draft);
                    break;
                }
            }
        }

        for (const dependency of draft.dependencies.collectDependencies(
            draft.dirtyEntityIds,
        )) {
            switch (dependency.type) {
                case "blockToPoint": {
                    recomputeBlockToPointDependency(dependency, draft);
                    break;
                }
                case "pointOnLine": {
                    recomputePointOnLineDependency(dependency, draft);
                    break;
                }
                case "pointOnShape": {
                    recomputePointOnShapeDependency(dependency, draft);
                    break;
                }
            }
        }

        return {
            blocks: draft.blocks,
            points: draft.points,
            blockIds: draft.blockIds,
            dependencies: draft.dependencies,
        };
    }
}

interface PageDraft {
    blocks: Record<string, Block>;
    points: Record<string, PointEntity>;
    blockIds: string[];
    dependencies: DependencyCollection;
    dirtyEntityIds: string[];
}

function insertBlocks(command: InsertBlocksCommand, draft: PageDraft) {
    for (const block of command.blocks) {
        draft.blocks[block.id] = block;
        draft.blockIds.push(block.id);
        draft.dirtyEntityIds.push(block.id);
    }
}

function insertPoints(command: InsertPointsCommand, draft: PageDraft) {
    for (const point of command.points) {
        draft.points[point.id] = point;
        draft.dirtyEntityIds.push(point.id);
    }
}

function deleteBlocks(command: DeleteBlocksCommand, draft: PageDraft) {
    for (const blockId of command.blockIds) {
        const deps = draft.dependencies.getByToEntityId(blockId);

        delete draft.blocks[blockId];

        const index = draft.blockIds.indexOf(blockId);
        assert(index !== -1, `Block not found: ${blockId}`);
        draft.blockIds.splice(index, 1);

        draft.dependencies.deleteByEntityId(blockId);

        // Clean up points with no more dependencies
        for (const dep of deps) {
            if (dep.type !== "blockToPoint") continue;
            const pointId = dep.from;
            if (draft.dependencies.getByFromEntityId(pointId).length === 0) {
                deletePoint(pointId, draft);
            }
        }
    }
}

function deletePoint(pointId: string, draft: PageDraft) {
    delete draft.points[pointId];
    draft.dependencies.deleteByEntityId(pointId);
}

function scaleBlocks(command: ScaleBlocksCommand, draft: PageDraft) {
    const pointIds = new Set<string>();
    for (const blockId of command.blockIds) {
        for (const dep of draft.dependencies
            .getByToEntityId(blockId)
            .filter((dep) => dep.type === "blockToPoint")) {
            pointIds.add(dep.from);
        }
    }
    for (const pointId of pointIds) {
        const point = draft.points[pointId];
        draft.points[pointId] = {
            ...point,
            x: (point.x - command.cx) * command.scaleX + command.cx,
            y: (point.y - command.cy) * command.scaleY + command.cy,
        };
        draft.dirtyEntityIds.push(pointId);
    }
}

function moveBlocks(command: MoveBlocksCommand, draft: PageDraft) {
    const pointIds = new Set<string>();
    for (const blockId of command.blockIds) {
        for (const dep of draft.dependencies
            .getByToEntityId(blockId)
            .filter((dep) => dep.type === "blockToPoint")) {
            pointIds.add(dep.from);
        }
    }
    for (const pointId of pointIds) {
        const point = draft.points[pointId];
        draft.points[pointId] = {
            ...point,
            x: point.x + command.dx,
            y: point.y + command.dy,
        };
        draft.dirtyEntityIds.push(pointId);
    }
}

function setPointPosition(command: SetPointPositionCommand, draft: PageDraft) {
    const point = draft.points[command.pointId];
    draft.points[command.pointId] = {
        ...point,
        x: command.x,
        y: command.y,
    };
    draft.dirtyEntityIds.push(command.pointId);
}

function mergePoints(command: MergePointsCommand, draft: PageDraft) {
    for (const oldDependency of draft.dependencies.getByFromEntityId(
        command.from,
    )) {
        draft.dependencies.add({
            ...oldDependency,
            id: randomId(),
            from: command.to,
        });
    }
    draft.dependencies.deleteByEntityId(command.from);
    delete draft.points[command.from];

    draft.dirtyEntityIds.push(command.to);
}

function updateShapeProperty(
    command: UpdateBlockPropertyCommand,
    draft: PageDraft,
) {
    for (const id of command.blockIds) {
        draft.blocks[id] = command.updater(draft.blocks[id]);
        draft.dirtyEntityIds.push(id);
    }
}

function addDependency(command: AddDependencyCommand, draft: PageDraft) {
    draft.dependencies.add(command.dependency);
    draft.dirtyEntityIds.push(command.dependency.from);
}

function deleteDependencies(
    command: DeleteDependenciesCommand,
    draft: PageDraft,
) {
    for (const id of command.dependencyIds) {
        draft.dependencies.deleteById(id);
    }
}

function recomputeBlockToPointDependency(
    dependency: BlockToPointDependency,
    draft: PageDraft,
) {
    const point = draft.points[dependency.from];
    const block = draft.blocks[dependency.to];
    switch (dependency.pointKey) {
        case PointKey.LINE_P1: {
            assert(
                block.type === "line",
                `Invalid block type: ${block.type} !== line`,
            );
            draft.blocks[block.id] = {
                ...block,
                x1: point.x,
                y1: point.y,
            };
            break;
        }
        case PointKey.LINE_P2: {
            assert(
                block.type === "line",
                `Invalid block type: ${block.type} !== line`,
            );
            draft.blocks[block.id] = {
                ...block,
                x2: point.x,
                y2: point.y,
            };
            break;
        }
        case PointKey.SHAPE_P1: {
            assert(
                block.type === "shape",
                `Invalid block type: ${block.type} !== shape`,
            );

            const x1 = point.x;
            const x2 = block.x2;
            const y1 = point.y;
            const y2 = block.y2;
            const x = Math.min(x1, x2);
            const y = Math.min(y1, y2);
            const width = Math.abs(x1 - x2);
            const height = Math.abs(y1 - y2);

            draft.blocks[block.id] = {
                ...block,
                x,
                y,
                width,
                height,
                x1,
                x2,
                y1,
                y2,
            };
            break;
        }
        case PointKey.SHAPE_P2: {
            assert(
                block.type === "shape",
                `Invalid block type: ${block.type} !== shape`,
            );

            const x1 = block.x1;
            const x2 = point.x;
            const y1 = block.y1;
            const y2 = point.y;
            const x = Math.min(x1, x2);
            const y = Math.min(y1, y2);
            const width = Math.abs(x1 - x2);
            const height = Math.abs(y1 - y2);

            draft.blocks[block.id] = {
                ...block,
                x,
                y,
                width,
                height,
                x1,
                x2,
                y1,
                y2,
            };
            break;
        }
    }
}

function recomputePointOnLineDependency(
    dependency: PointOnLineDependency,
    draft: PageDraft,
) {
    const r = dependency.r;

    const line = draft.blocks[dependency.from];
    assert(line.type === "line", `Invalid block type: ${line.type}`);

    const point = draft.points[dependency.to];

    draft.points[point.id] = {
        ...point,
        x: (1 - r) * line.x1 + r * line.x2,
        y: (1 - r) * line.y1 + r * line.y2,
    };
}

function recomputePointOnShapeDependency(
    dependency: PointOnShapeDependency,
    draft: PageDraft,
) {
    const { rx, ry } = dependency;

    const shape = draft.blocks[dependency.from];
    assert(shape.type === "shape", `Invalid block type: ${shape.type}`);

    const point = draft.points[dependency.to];
    draft.points[point.id] = {
        ...point,
        x: shape.x + rx * shape.width,
        y: shape.y + ry * shape.height,
    };
}
