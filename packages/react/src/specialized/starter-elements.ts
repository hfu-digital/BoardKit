import type { Element } from '@hfu.digital/boardkit-core';
import { createStarterTemplate } from './presets';

/** Shared async factory for all twelve specialized board types. */
export async function createStarterElements(boardType: string, p: string, u: string, x = 80, y = 80): Promise<Element[]> {
                  if (boardType === "math") {
                    const m = await import("./math");
                    return [
                      ...m.createEquation(p, u, x, y, "y = \\sin(x)"),
                      ...m.createFunctionPlot(p, u, x, y + 100, "sin(x)"),
                    ];
                  }
                  if (boardType === "circuit") {
                    const c = await import("./circuit");
                    const a = c.createGate(p, u, x, y, "INPUT"),
                      b = c.createGate(p, u, x, y + 180, "INPUT"),
                      and = c.createGate(p, u, x + 260, y + 80, "AND"),
                      output = c.createGate(p, u, x + 520, y + 80, "OUTPUT");
                    const els = [...a, ...b, ...and, ...output];
                    const gateId = (es: Element[]) =>
                      es.find((e) => e.data.specialized?.kind === "gate")!.id;
                    const ports = (es: Element[], dir: "input" | "output") =>
                      c
                        .getGatePorts(els, gateId(es))
                        .filter((port) => port.direction === dir);
                    return [
                      ...els,
                      c.createCircuitWire(
                        p,
                        u,
                        ports(a, "output")[0],
                        ports(and, "input")[0],
                      ),
                      c.createCircuitWire(
                        p,
                        u,
                        ports(b, "output")[0],
                        ports(and, "input")[1],
                      ),
                      c.createCircuitWire(
                        p,
                        u,
                        ports(and, "output")[0],
                        ports(output, "input")[0],
                      ),
                    ];
                  }
                  return createStarterTemplate(boardType, p, u, x, y);
}
