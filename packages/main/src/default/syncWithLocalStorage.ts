import type { App } from "../core/App";
import { Color } from "../core/Color";
import type { EntityHandleMap } from "../core/Entity";
import { Page, type SerializedPage } from "../core/Page";
import { PageBuilder } from "../core/PageBuilder";
import { assert } from "../lib/assert";

const DEBOUNCE_INTERVAL_IN_MS = 1000;

export function syncWithLocalStorage(app: App) {
    let debounceTimerId: ReturnType<typeof setTimeout> | null = null;

    app.canvas.page.addListener(() => {
        if (debounceTimerId !== null) {
            clearTimeout(debounceTimerId);
            debounceTimerId = null;
        }

        debounceTimerId = setTimeout(() => {
            const serializedPage = app.canvas.page.get().serialize();
            localStorage.setItem(
                LOCAL_STORAGE_KEY,
                JSON.stringify(serializedPage),
            );
        }, DEBOUNCE_INTERVAL_IN_MS);
    });

    const page = upgradeSchemaVersion(loadFromLocalStorage(), app.entityHandle);

    if (page !== null) {
        app.canvas.setPage(page);
        app.canvas.unselectAll();

        restoreColorHistory(app, page);
    }
}

function loadFromLocalStorage(): Page | null {
    try {
        const data = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (data === null) return null;

        const serializedPage: SerializedPage = JSON.parse(data);
        const page = Page.deserialize(serializedPage);

        return page;
    } catch (e) {
        console.error(e);
        return null;
    }
}

function upgradeSchemaVersion(
    page: Page | null,
    entityHandle: EntityHandleMap,
): Page | null {
    if (page === null) return null;

    const builder = new PageBuilder(page, entityHandle);
    for (let oldEntity of page.entities.values()) {
        const handle = entityHandle.getHandle(oldEntity);

        let newEntity = oldEntity;
        while (true) {
            newEntity = handle.upgradeSchemaVersion(oldEntity);

            if (newEntity === oldEntity) {
                break;
            } else {
                assert(
                    newEntity.schemaVersion !== undefined &&
                        newEntity.schemaVersion >
                            (oldEntity.schemaVersion ?? 0),
                    `Entity schema has been updated while version is not changed: ${oldEntity.type}(${oldEntity.id})`,
                );
                oldEntity = newEntity;
            }
        }

        builder.setEntity(newEntity);
    }

    return builder.build();
}

function restoreColorHistory(app: App, page: Page) {
    const colorMap = new Map<
        string,
        {
            color: Color;
            count: number;
        }
    >();

    for (const entity of page.entities.values()) {
        for (const color of app.entityHandle
            .getHandle(entity)
            .getColors(entity)) {
            const key = Color.stringify(color);
            const entry = colorMap.get(key);
            if (entry === undefined) {
                colorMap.set(key, { color, count: 1 });
            } else {
                entry.count++;
            }
        }
    }

    const colors = Array.from(colorMap.values())
        .sort((a, b) => a.count - b.count)
        .map((entry) => entry.color);

    for (const color of colors) {
        app.addColorHistory(color);
    }
}

const LOCAL_STORAGE_KEY = "LocalCanvasStateStore.state.page";
