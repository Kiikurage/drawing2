import { useEffect, useRef } from "react";
import type { Viewport } from "../core/Viewport";
import { useApp } from "./hooks/useApp";
import { useCell } from "./hooks/useCell";

const SIZE = 1000; // [ms]

const frameCommitTimingBucket: number[] = [];

function update() {
    const now = performance.now();
    while (
        frameCommitTimingBucket.length > 0 &&
        frameCommitTimingBucket[0] <= now - SIZE
    ) {
        frameCommitTimingBucket.shift();
    }
    frameCommitTimingBucket.push(now);

    requestAnimationFrame(update);
}

export function monitorFPS() {
    requestAnimationFrame(update);
}

export function StatusBar() {
    const app = useApp();
    const mode = useCell(app.mode);
    const viewportRef = useRef<Viewport>(null as never);
    viewportRef.current = useCell(app.viewport);

    const domRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        const timerId = setInterval(() => {
            const viewport = viewportRef.current;

            const dom = domRef.current;
            if (dom === null) return;

            const duration =
                frameCommitTimingBucket.length <= 1
                    ? SIZE
                    : frameCommitTimingBucket[
                          frameCommitTimingBucket.length - 1
                      ] - frameCommitTimingBucket[0];
            const numFrame =
                frameCommitTimingBucket.length <= 1
                    ? frameCommitTimingBucket.length
                    : frameCommitTimingBucket.length - 1;

            const fps = Math.round(numFrame / (duration / 1000));

            dom.innerText = [
                `Version: ${__COMMIT_HASH__}`,
                `Viewport: (x:${viewport.rect.left.toFixed(
                    0,
                )}, y:${viewport.rect.top.toFixed(
                    0,
                )}, w:${viewport.rect.width.toFixed(
                    0,
                )}, h:${viewport.rect.height.toFixed(0)}), ${(
                    viewport.scale * 100
                ).toFixed(0)}%`,
                `Mode: ${JSON.stringify(mode)}`,
                `FPS: ${fps}`,
            ].join("\n");
        }, 200);

        return () => {
            clearInterval(timerId);
        };
    }, [mode]);

    useEffect(() => {
        const dom = document.createElement("div");
        dom.style.pointerEvents = "none";
        dom.style.position = "fixed";
        dom.style.bottom = "10px";
        dom.style.left = "10px";
        dom.style.fontFamily = "monospace";
        dom.style.color = "#505263";
        dom.style.whiteSpace = "pre";

        document.body.appendChild(dom);
        domRef.current = dom;

        return () => {
            dom.remove();
        };
    }, []);

    return <></>;
}

monitorFPS();
