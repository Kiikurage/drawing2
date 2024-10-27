import { assert } from "../lib/assert";
import { randomId } from "../lib/randomId";
import type { Entity } from "./Entity";
import type { EntityConverter, SerializedEntity } from "./EntityConverter";
import type { JSONObject } from "./JSONObject";
import type { Page } from "./Page";
import { translate } from "./geo/TransformMatrix";

interface ClipboardData extends JSONObject {
    entities: SerializedEntity[];
}

export class ClipboardService {
    constructor(private readonly entityConverter: EntityConverter) {}

    copy(page: Page, entityIds: ReadonlySet<string>): Promise<void> {
        const entitiesInOrder: Entity[] = [];

        for (const entityId of page.entityIds) {
            if (!entityIds.has(entityId)) continue;
            const entity = page.entities.get(entityId);
            assert(entity !== undefined, `Entity ${entityId} not found`);

            entitiesInOrder.push(entity);
        }

        const data: ClipboardData = {
            entities: entitiesInOrder.map((entity) => entity.serialize()),
        };

        return navigator.clipboard.writeText(JSON.stringify(data));
    }

    async paste(): Promise<{
        entities: Entity[];
    }> {
        try {
            const json = await navigator.clipboard.readText();
            const data = JSON.parse(json) as ClipboardData;

            const idMap = new Map<string, string>();

            const entities = data.entities
                .map((data) => this.entityConverter.deserialize(data))
                .map((entity) => {
                    // Renew IDs
                    const newId = randomId();
                    idMap.set(entity.props.id, newId);
                    entity.props.id = newId;

                    // Move entities a little bit to avoid overlapping with copy sources
                    return entity.transform(translate(10, 10));
                });

            return {
                entities,
            };
        } catch {
            return {
                entities: [],
            };
        }
    }
}
