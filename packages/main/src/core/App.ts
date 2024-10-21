import type { ComponentType } from "react";
import { assert } from "../lib/assert";
import { Point } from "../lib/geo/Point";
import { AppStateStore } from "./AppStateStore";
import { CanvasStateStore } from "./CanvasStateStore";
import { ClipboardService } from "./ClipboardService";
import { DefaultPropertyStore } from "./DefaultPropertyStore";
import type { Entity } from "./Entity";
import { type EntityConverter, EntityConverterMap } from "./EntityConverter";
import { GestureRecognizer } from "./GestureRecognizer";
import { HistoryManager } from "./HistoryManager";
import { KeyboardManager } from "./KeyboardManager";
import type { Mode, ModeChangeEvent, ModeController } from "./ModeController";
import {
    SelectEntityModeController,
    createSelectEntityMode,
    getSelectedEntityIds,
} from "./SelectEntityModeController";
import { SelectPathModeController } from "./SelectPathModeController";
import { SnapGuideStore } from "./SnapGuideStore";
import { ViewportStore } from "./ViewportStore";

export class App {
    readonly entityConverter = new EntityConverterMap();
    readonly clipboardService = new ClipboardService(this.entityConverter);
    readonly canvasStateStore = new CanvasStateStore(this);
    readonly viewportStore = new ViewportStore();
    readonly gestureRecognizer = new GestureRecognizer(this);
    readonly appStateStore = new AppStateStore();
    readonly historyManager = new HistoryManager(this);
    readonly defaultPropertyStore = new DefaultPropertyStore();
    readonly keyboard = new KeyboardManager(this);
    private readonly modeControllers = new Map<string, ModeController>();
    private readonly entityViewMap = new Map<
        string,
        ComponentType<{ entity: Entity }>
    >();
    private readonly defaultModeController = new SelectEntityModeController();

    // TODO: Move to SelectMode package
    readonly snapGuideStore = new SnapGuideStore();

    constructor() {
        this.addModeController("select-entity", this.defaultModeController);
        this.addModeController("select-path", new SelectPathModeController());

        this.keyboard.addBinding({
            key: "z",
            metaKey: true,
            shiftKey: false,
            action: () => this.historyManager.undo(),
        });
        this.keyboard.addBinding({
            key: "z",
            metaKey: true,
            shiftKey: true,
            action: () => this.historyManager.redo(),
        });
        this.keyboard.addBinding({
            key: "x",
            metaKey: true,
            action: () => this.cut(),
        });
        this.keyboard.addBinding({
            key: "c",
            metaKey: true,
            action: () => this.copy(),
        });
        this.keyboard.addBinding({
            key: "v",
            metaKey: true,
            action: () => this.paste(),
        });

        this.keyboard.addBinding({
            key: "z",
            ctrlKey: true,
            shiftKey: false,
            action: () => this.historyManager.undo(),
        });
        this.keyboard.addBinding({
            key: "z",
            ctrlKey: true,
            shiftKey: true,
            action: () => this.historyManager.redo(),
        });
        this.keyboard.addBinding({
            key: "x",
            ctrlKey: true,
            action: () => this.cut(),
        });
        this.keyboard.addBinding({
            key: "c",
            ctrlKey: true,
            action: () => this.copy(),
        });
        this.keyboard.addBinding({
            key: "v",
            ctrlKey: true,
            action: () => this.paste(),
        });
    }

    addModeController(type: string, controller: ModeController): App {
        assert(
            !this.modeControllers.has(type),
            `Mode ${type} is already registered`,
        );
        this.modeControllers.set(type, controller);
        controller.onRegistered(this);
        return this;
    }

    getModeController(): ModeController {
        return (
            this.getModeControllerByType(
                this.appStateStore.getState().mode.type,
            ) ?? this.defaultModeController
        );
    }

    getModeControllerByType(type: string): ModeController | null {
        return this.modeControllers.get(type) ?? null;
    }

    setMode(newMode: Mode) {
        let aborted = false;
        const ev: ModeChangeEvent = {
            oldMode: this.appStateStore.getState().mode,
            newMode,
            abort: () => {
                aborted = true;
            },
        };

        const oldModeController = this.getModeController();
        const newModeController = this.getModeControllerByType(newMode.type);
        if (newModeController === null) {
            return;
        }

        newModeController.onBeforeEnterMode(this, ev);
        if (aborted) return;

        oldModeController.onBeforeExitMode(this, ev);
        if (aborted) return;

        this.appStateStore.setMode(newMode);
        ev.abort = () => {
            throw new Error("Abort is called after mode change");
        };

        oldModeController.onAfterExitMode(this, ev);

        newModeController.onAfterEnterMode(this, ev);
    }

    registerEntityConverter<T extends string>(
        type: string,
        converter: EntityConverter<T>,
    ): App {
        this.entityConverter.register(type, converter);
        return this;
    }

    registerEntityView<E extends Entity>(
        type: string,
        component: ComponentType<{ entity: E }>,
    ): App {
        this.entityViewMap.set(
            type,
            component as ComponentType<{ entity: Entity }>,
        );
        return this;
    }

    getEntityView<E extends Entity>(entity: E): ComponentType<{ entity: E }> {
        const view = this.entityViewMap.get(entity.type);
        assert(
            view !== undefined,
            `No view found for entity type ${entity.constructor.name}`,
        );
        return view as ComponentType<{ entity: E }>;
    }

    // Edit

    deleteSelectedEntities() {
        const selectedEntityIds = getSelectedEntityIds(
            this.appStateStore.getState().mode,
        );
        if (selectedEntityIds.size === 0) return;

        this.canvasStateStore.edit((draft) => {
            draft.deleteEntities(selectedEntityIds);
        });
    }

    updateProperty(key: string, value: unknown) {
        const selectedEntityIds = getSelectedEntityIds(
            this.appStateStore.getState().mode,
        );
        if (selectedEntityIds.size === 0) {
            return;
        }
        this.canvasStateStore.edit((draft) => {
            draft.updateProperty([...selectedEntityIds], key, value);
        });
    }

    // Ordering

    bringToFront() {
        const selectedEntityIds = getSelectedEntityIds(
            this.appStateStore.getState().mode,
        );
        if (selectedEntityIds.size === 0) return;

        this.canvasStateStore.edit((draft) =>
            draft.bringToFront(selectedEntityIds),
        );
    }

    bringForward() {
        const selectedEntityIds = getSelectedEntityIds(
            this.appStateStore.getState().mode,
        );
        if (selectedEntityIds.size === 0) return;

        this.canvasStateStore.edit((draft) =>
            draft.bringForward(selectedEntityIds),
        );
    }

    sendBackward() {
        const selectedEntityIds = getSelectedEntityIds(
            this.appStateStore.getState().mode,
        );
        if (selectedEntityIds.size === 0) return;

        this.canvasStateStore.edit((draft) =>
            draft.sendBackward(selectedEntityIds),
        );
    }

    sendToBack() {
        const selectedEntityIds = getSelectedEntityIds(
            this.appStateStore.getState().mode,
        );
        if (selectedEntityIds.size === 0) return;

        this.canvasStateStore.edit((draft) =>
            draft.sendToBack(selectedEntityIds),
        );
    }

    // Selection

    select(entityId: string) {
        const entityIds = new Set(
            getSelectedEntityIds(this.appStateStore.getState().mode),
        );
        entityIds.add(entityId);
        return this.setMode(createSelectEntityMode(entityIds));
    }

    unselect(entityId: string) {
        const entityIds = new Set(
            getSelectedEntityIds(this.appStateStore.getState().mode),
        );
        if (!entityIds.has(entityId)) return;
        entityIds.delete(entityId);
        return this.setMode(createSelectEntityMode(entityIds));
    }

    selectAll() {
        return this.setMode(
            createSelectEntityMode(
                new Set(this.canvasStateStore.getState().entityIds),
            ),
        );
    }

    unselectAll() {
        if (this.appStateStore.getState().mode.type !== "select-entity") return;

        return this.setMode(createSelectEntityMode(new Set()));
    }

    setSelectedEntityIds(entityIds: Iterable<string>) {
        return this.setMode(createSelectEntityMode(new Set(entityIds)));
    }

    // Clipboard

    copy() {
        const selectedEntityIds = getSelectedEntityIds(
            this.appStateStore.getState().mode,
        );
        if (selectedEntityIds.size === 0) return;

        this.clipboardService.copy(
            this.canvasStateStore.getState(),
            selectedEntityIds,
        );
    }

    async cut() {
        this.copy();
        this.deleteSelectedEntities();
    }

    async paste(): Promise<void> {
        const { entities } = await this.clipboardService.paste();

        this.canvasStateStore.edit((draft) => {
            draft.setEntities(entities);
            // draft.addDependencies(dependencies);
        });
        this.setSelectedEntityIds(entities.map((entity) => entity.props.id));

        // Copy pasted entities so that next paste operation will
        // create a new copy of entities in different position
        this.copy();
    }

    // Event handlers

    /**
     * Handle native `pointerdown` events
     * @internal
     */
    handlePointerDown(ev: PointerEvent) {
        this.gestureRecognizer.handlePointerDown(ev);

        this.getModeController().onCanvasPointerDown(this, {
            pointerId: ev.pointerId,
            point: this.viewportStore
                .getState()
                .fromCanvasCoordinateTransform.apply(
                    new Point(ev.clientX, ev.clientY),
                ),
            shiftKey: ev.shiftKey,
            metaKey: ev.metaKey,
            ctrlKey: ev.ctrlKey,
            preventDefault: () => ev.preventDefault(),
        });
    }

    /**
     * Handle native `pointermove` events
     * @internal
     */
    handlePointerMove(ev: PointerEvent) {
        this.gestureRecognizer.handlePointerMove(ev);

        const point = this.viewportStore
            .getState()
            .fromCanvasCoordinateTransform.apply(
                new Point(ev.clientX, ev.clientY),
            );
        this.getModeController().onMouseMove(this, point);
    }

    /**
     * Handle native `pointerup` events
     * @internal
     */
    handlePointerUp(ev: PointerEvent) {
        this.gestureRecognizer.handlePointerUp(ev);
    }

    /**
     * Handle native `doubleclick` events
     * @internal
     */
    handleDoubleClick(ev: MouseEvent) {
        this.getModeController().onCanvasDoubleClick(this, {
            pointerId: -1,
            point: this.viewportStore
                .getState()
                .fromCanvasCoordinateTransform.apply(
                    new Point(ev.clientX, ev.clientY),
                ),
            shiftKey: ev.shiftKey,
            metaKey: ev.metaKey,
            ctrlKey: ev.ctrlKey,
            preventDefault: () => ev.preventDefault(),
        });
    }

    handleScroll(deltaCanvasX: number, deltaCanvasY: number) {
        this.viewportStore.movePosition(deltaCanvasX, deltaCanvasY);
    }

    handleScale(
        newScale: number,
        centerCanvasX: number,
        centerCanvasY: number,
    ) {
        this.viewportStore.setScale(newScale, centerCanvasX, centerCanvasY);
    }

    /**
     * Handle native `keydown` events
     * @internal
     */
    handleKeyDown(ev: KeyboardEvent) {
        this.keyboard.handleKeyDown(ev);
    }

    handleEntityResize(entityId: string, width: number, height: number) {
        const entity = this.canvasStateStore.getState().entities.get(entityId);
        assert(entity !== undefined, `Entity ${entityId} is not found`);

        entity.onViewResize(this, width, height);
    }
}
