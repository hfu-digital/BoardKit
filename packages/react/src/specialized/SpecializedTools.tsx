import React, { useEffect, useRef, useState } from "react";
import {
  addElement,
  removeElement,
  updateElement,
  type Element,
  type ElementMutation,
} from "@hfu.digital/boardkit-core";
import { useBoardKit } from "../context/BoardKitProvider";
import { useSelection } from "../hooks/useSelection";
import { BOARD_TYPE_LABELS, type BoardType } from "./types";
import { presetTools } from "./presets";
import { createStarterElements } from "./starter-elements";
import {
  snapKanbanCards,
  createVote,
  countVotes,
  createTimer,
  remainingSeconds,
} from "./collaboration";
import { line, connectionNodes } from "./elements";
import type { GateKind } from "./circuit";
import "./specialized.css";

export interface SpecializedToolsProps {
  boardType: BoardType;
  boardId: string;
}
/** All insertions enter the same undo and outbound queues as native drawing tools. */
export function SpecializedTools({
  boardType,
  boardId,
}: SpecializedToolsProps) {
  const { store, config } = useBoardKit();
  const { selectedElements } = useSelection();
  const [expanded, setExpanded] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [formula, setFormula] = useState("\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}"),
    [expression, setExpression] = useState("sin(x)"),
    [gate, setGate] = useState<GateKind>("AND"),
    [circuitStatus, setCircuitStatus] = useState(""),
    [minutes, setMinutes] = useState(5),
    [tick, setTick] = useState(Date.now()),
    [ready, setReady] = useState(!!store.getState().activePageId);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(
    () =>
      store.subscribe("pages", () => setReady(!!store.getState().activePageId)),
    [store],
  );
  useEffect(() => {
    if (boardType === "standard") return;
    store.setGridConfig({
      enabled: true,
      visible: true,
      snapEnabled: boardType !== "brainstorm",
      size: 20,
    });
    return () =>
      store.setGridConfig({
        enabled: false,
        visible: false,
        snapEnabled: false,
      });
  }, [store, boardType]);
  useEffect(() => {
    if (boardType !== "brainstorm") return;
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [boardType]);
  function commit(mutations: ElementMutation[]) {
    if (!mutations.length) return;
    const originals = new Map(store.getState().scene.elements);
    const apply = (ms: ElementMutation[]) => {
      store.updateScene((scene) =>
        ms.reduce(
          (s, m) =>
            m.type === "create"
              ? addElement(s, m.data as Element)
              : m.type === "delete"
                ? removeElement(s, m.elementId)
                : updateElement(s, m.elementId, m.data ?? {}),
          scene,
        ),
      );
      store.enqueueOutboundMutations(ms);
    };
    store.getState().history.push({
      execute: () => mutations.map((m) => ({ ...m, timestamp: Date.now() })),
      undo: () =>
        mutations.map((m) => {
          const old = originals.get(m.elementId);
          return {
            type: old ? "update" : "delete",
            elementId: m.elementId,
            pageId: m.pageId,
            data: old,
            timestamp: Date.now(),
          } as ElementMutation;
        }),
    });
    apply(mutations);
  }
  function insert(elements: Element[]) {
    const top = Math.max(
      0,
      ...Array.from(store.getState().scene.elements.values()).map(
        (e) => e.zIndex,
      ),
    );
    elements.forEach((e, i) => (e.zIndex = top + i + 1));
    commit(
      elements.map((e) => ({
        type: "create",
        elementId: e.id,
        pageId: e.pageId,
        data: e,
        timestamp: Date.now(),
      })),
    );
    store.setSelection(
      new Set(
        elements
          .filter((e) => e.type === "group")
          .map((e) => e.id)
          .concat(
            elements.some((e) => e.type === "group")
              ? []
              : elements.map((e) => e.id),
          ),
      ),
    );
    store.setActiveTool("select");
  }
  async function uploadAsset(
    file: File,
  ): Promise<{ assetId: string; url: string }> {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    const res = await fetch(`${config.apiUrl}/boards/${boardId}/assets`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.authToken
          ? { Authorization: `Bearer ${config.authToken}` }
          : {}),
      },
      body: JSON.stringify({
        file: btoa(binary),
        mimeType: file.type,
        sizeBytes: file.size,
      }),
    });
    if (!res.ok) throw new Error(`Asset upload failed (${res.status})`);
    const asset = await res.json();
    if (!asset.url || !asset.id)
      throw new Error("Asset upload returned an invalid response");
    return {
      assetId: asset.id,
      url: asset.url.startsWith("http")
        ? asset.url
        : `${config.apiUrl.replace(/\/$/, "")}${asset.url}`,
    };
  }
  async function run(
    fn: (
      pageId: string,
      userId: string,
      x: number,
      y: number,
    ) => Element[] | Promise<Element[]>,
  ) {
    setError("");
    setBusy(true);
    try {
      const s = store.getState();
      if (!s.activePageId)
        throw new Error("Wait for the board to finish loading.");
      if (!config.userId) throw new Error("Sign in to edit this board.");
      const x = (220 - s.viewport.offset.x) / s.viewport.zoom,
        y = (180 - s.viewport.offset.y) / s.viewport.zoom;
      const result = await fn(s.activePageId, config.userId, x, y);
      for (const element of result) {
        if (element.type === "image" && element.data.url.startsWith("data:")) {
          const blob = await (await fetch(element.data.url)).blob();
          const asset = await uploadAsset(
            new File([blob], "equation.svg", { type: blob.type }),
          );
          element.data.assetId = asset.assetId;
          element.data.url = asset.url;
        }
      }
      insert(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to add content");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (boardType !== "kanban") return;
    const snap = () => {
      const s = store.getState();
      const changes = snapKanbanCards(
        Array.from(s.scene.elements.values()),
        s.selectedIds,
      );
      if (changes.length) commit(changes);
    };
    window.addEventListener("pointerup", snap);
    return () => window.removeEventListener("pointerup", snap);
  }, [boardType, store]);
  if (boardType === "standard") return null;
  const pageElements = Array.from(
    store.getState().scene.elements.values(),
  ).filter((e) => e.pageId === store.getState().activePageId);
  const timer = pageElements
    .filter((e) => e.data.specialized?.kind === "brainstorm-timer")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const primary =
    selectedElements.find((e) => e.type === "shape") ?? selectedElements[0];
  function connect() {
    run((p, u) => {
      const nodes = connectionNodes(selectedElements, pageElements);
      if (nodes.length !== 2)
        throw new Error("Select two shapes to connect them.");
      const [a, b] = nodes.map((e) => e.data.bounds);
      const connector = line(
        p,
        u,
        [
          { x: a.x + a.width, y: a.y + a.height / 2 },
          { x: b.x, y: b.y + b.height / 2 },
        ],
        true,
      );
      connector.data.startBinding = { elementId: nodes[0].id };
      connector.data.endBinding = { elementId: nodes[1].id };
      return [connector];
    });
  }
  return (
    <section
      className="bk-specialized"
      aria-label={`${BOARD_TYPE_LABELS[boardType]} tools`}
    >
      <div className="bk-specialized-heading">
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {BOARD_TYPE_LABELS[boardType]}{" "}
          <span aria-hidden>{expanded ? "▾" : "▸"}</span>
        </button>
        <span>Adapted tools</span>
      </div>
      {expanded && (
        <div className="bk-specialized-body">
          <div className="bk-specialized-actions">
            <button
              disabled={busy || !ready}
              onClick={() =>
                run(async (p, u, x, y) => {
                  return createStarterElements(boardType, p, u, x, y);
                })
              }
            >
              ＋ Starter template
            </button>
            {(presetTools[boardType] ?? []).map((tool) => (
              <button
                key={tool.id}
                title={tool.description}
                disabled={busy || !ready}
                onClick={() => run(tool.create)}
              >
                {tool.label}
              </button>
            ))}
            {[
              "uml",
              "er",
              "flowchart",
              "automata",
              "network",
              "mind-map",
            ].includes(boardType) && (
              <button disabled={busy || !ready} onClick={connect}>
                Connect selected
              </button>
            )}
          </div>
          {boardType === "math" && (
            <>
              <label>
                LaTeX
                <input
                  value={formula}
                  onChange={(e) => setFormula(e.target.value)}
                />
              </label>
              <button
                disabled={busy || !ready}
                onClick={() =>
                  run(async (p, u, x, y) =>
                    (await import("./math"))
                      .createEquation(p, u, x, y, formula)
                      .map((e) => e),
                  )
                }
              >
                Add equation
              </button>
              <label>
                Function f(x)
                <input
                  value={expression}
                  onChange={(e) => setExpression(e.target.value)}
                  placeholder="sin(x), x^2, sqrt(x)"
                />
              </label>
              <button
                disabled={busy || !ready}
                onClick={() =>
                  run(async (p, u, x, y) =>
                    (await import("./math")).createFunctionPlot(
                      p,
                      u,
                      x,
                      y,
                      expression,
                    ),
                  )
                }
              >
                Plot function
              </button>
            </>
          )}
          {boardType === "circuit" && (
            <>
              <label>
                Logic gate
                <select
                  value={gate}
                  onChange={(e) => setGate(e.target.value as GateKind)}
                >
                  {[
                    "AND",
                    "OR",
                    "NOT",
                    "NAND",
                    "NOR",
                    "XOR",
                    "XNOR",
                    "INPUT",
                    "OUTPUT",
                  ].map((g) => (
                    <option key={g}>{g}</option>
                  ))}
                </select>
              </label>
              <button
                disabled={busy || !ready}
                onClick={() =>
                  run(async (p, u, x, y) =>
                    (await import("./circuit")).createGate(p, u, x, y, gate),
                  )
                }
              >
                Add gate
              </button>
              <button
                disabled={busy || !ready}
                onClick={() =>
                  run(async (p, u, x, y) =>
                    (await import("./circuit")).createTruthTable(
                      p,
                      u,
                      x,
                      y,
                      gate,
                    ),
                  )
                }
              >
                Gate truth table
              </button>
              <button
                disabled={busy || !ready}
                onClick={() =>
                  run(async (p, u) => {
                    const c = await import("./circuit");
                    const gates = selectedElements.filter(
                      (e) => e.data.specialized?.kind === "gate",
                    );
                    if (gates.length !== 2)
                      throw new Error(
                        "Select source and destination gates (two shapes).",
                      );
                    const elements = Array.from(
                      store.getState().scene.elements.values(),
                    );
                    const from = c
                      .getGatePorts(elements, gates[0].id)
                      .find((port) => port.direction === "output");
                    const to = c
                      .getGatePorts(elements, gates[1].id)
                      .find(
                        (port) =>
                          port.direction === "input" &&
                          !elements.some(
                            (e) =>
                              e.data.specialized?.kind === "circuit-wire" &&
                              e.data.specialized?.toGate === port.gateId &&
                              e.data.specialized?.toInput === port.index,
                          ),
                      );
                    if (!from || !to)
                      throw new Error(
                        "Choose a source with output and a destination with a free input.",
                      );
                    return [c.createCircuitWire(p, u, from, to)];
                  })
                }
              >
                Wire selected gates
              </button>
              <button
                disabled={busy || !ready}
                onClick={() =>
                  run(async (p, u, x, y) =>
                    (await import("./circuit")).createCircuitTruthTable(
                      p,
                      u,
                      x,
                      y,
                      pageElements,
                    ),
                  )
                }
              >
                Circuit truth table
              </button>
              <button
                disabled={busy || !ready}
                onClick={() => {
                  const input = selectedElements.find(
                    (e) =>
                      e.data.specialized?.kind === "gate" &&
                      e.data.specialized.gateType === "INPUT",
                  );
                  if (!input) {
                    setError("Select an INPUT gate to toggle.");
                    return;
                  }
                  commit([
                    {
                      type: "update",
                      elementId: input.id,
                      pageId: input.pageId,
                      data: {
                        ...input,
                        data: {
                          ...input.data,
                          specialized: {
                            ...input.data.specialized!,
                            value: !input.data.specialized?.value,
                          },
                        },
                      } as Element,
                      timestamp: Date.now(),
                    },
                  ]);
                }}
              >
                Toggle selected input
              </button>
              <button
                disabled={busy || !ready}
                onClick={async () => {
                  try {
                    const c = await import("./circuit");
                    const values = c.evaluateCircuit(pageElements);
                    setCircuitStatus(
                      pageElements
                        .filter((e) => e.data.specialized?.kind === "gate")
                        .map(
                          (e, i) =>
                            `${e.data.specialized?.gateType} ${i + 1}: ${Number(values.get(e.id))}`,
                        )
                        .join(" · "),
                    );
                    setError("");
                  } catch (e) {
                    setError(
                      e instanceof Error
                        ? e.message
                        : "Cannot evaluate circuit",
                    );
                  }
                }}
              >
                Evaluate circuit
              </button>
              {circuitStatus && <output>{circuitStatus}</output>}
            </>
          )}
          {boardType === "brainstorm" && (
            <>
              <button
                disabled={!primary || busy}
                onClick={() =>
                  run((p, u) => {
                    if (!primary) throw new Error("Select an idea to vote.");
                    return createVote(pageElements, primary.id, u, p);
                  })
                }
              >
                Vote for selected
                {primary ? ` (${countVotes(pageElements, primary.id)})` : ""}
              </button>
              <label>
                Timer (minutes)
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={minutes}
                  onChange={(e) => setMinutes(Number(e.target.value))}
                />
              </label>
              <button
                disabled={busy || !ready}
                onClick={() =>
                  run((p, u, x, y) => {
                    if (
                      !Number.isFinite(minutes) ||
                      minutes < 1 ||
                      minutes > 120
                    )
                      throw new Error("Choose 1–120 minutes.");
                    return [
                      createTimer(p, u, Date.now() + minutes * 60000, x, y),
                    ];
                  })
                }
              >
                Start shared timer
              </button>
              {timer && (
                <output aria-live="off">
                  {Math.floor(remainingSeconds(timer, tick) / 60)}:
                  {String(remainingSeconds(timer, tick) % 60).padStart(2, "0")}{" "}
                  remaining
                </output>
              )}
            </>
          )}
          {boardType === "lecture-notes" && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,.pdf"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file)
                    run(async (p, u, x, y) => {
                      const { importLecturePdf } = await import("./lecture");
                      return importLecturePdf(
                        file,
                        p,
                        u,
                        x,
                        y,
                        async (file) => {
                          const bytes = new Uint8Array(
                            await file.arrayBuffer(),
                          );
                          let binary = "";
                          for (const byte of bytes)
                            binary += String.fromCharCode(byte);
                          const res = await fetch(
                            `${config.apiUrl}/boards/${boardId}/assets`,
                            {
                              method: "POST",
                              headers: {
                                "Content-Type": "application/json",
                                ...(config.authToken
                                  ? {
                                      Authorization: `Bearer ${config.authToken}`,
                                    }
                                  : {}),
                              },
                              body: JSON.stringify({
                                file: btoa(binary),
                                mimeType: file.type,
                                sizeBytes: file.size,
                              }),
                            },
                          );
                          if (!res.ok)
                            throw new Error(
                              `PDF page upload failed (${res.status})`,
                            );
                          const asset = await res.json();
                          return {
                            assetId: asset.id,
                            url: asset.url.startsWith("http")
                              ? asset.url
                              : `${config.apiUrl.replace(/\/$/, "")}${asset.url}`,
                          };
                        },
                      );
                    });
                }}
              />
              <button
                disabled={busy || !ready}
                onClick={() => fileRef.current?.click()}
              >
                Import PDF pages
              </button>
            </>
          )}
          {busy && <p role="status">Adding content…</p>}
          {error && (
            <p role="alert" className="bk-specialized-error">
              {error}
            </p>
          )}
          <p className="bk-specialized-hint">
            Select to move and resize. Double-click text to edit. All drawing
            tools remain available.
          </p>
        </div>
      )}
    </section>
  );
}
