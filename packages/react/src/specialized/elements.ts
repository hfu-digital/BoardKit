import type {
  Element,
  ShapeElement,
  TextElement,
  LinearElement,
  ImageElement,
  GroupElement,
  Point,
} from "@hfu.digital/boardkit-core";

/** One binding target per selected object, including multi-shape grouped nodes. */
export function connectionNodes(selected: Element[], all: Element[]): ShapeElement[] {
  const byId = new Map(all.map(element => [element.id, element]));
  const grouped = new Set<string>();
  const shapesIn = (element: Element): ShapeElement[] => {
    grouped.add(element.id);
    if (element.type === 'shape') return [element];
    if (element.type !== 'group') return [];
    return element.data.childIds.flatMap(id => {
      const child = byId.get(id);
      return child && !grouped.has(id) ? shapesIn(child) : [];
    });
  };
  const nodes: ShapeElement[] = [];
  for (const element of selected.filter(element => element.type === 'group')) {
    if (grouped.has(element.id)) continue;
    const [shape] = shapesIn(element);
    if (shape) nodes.push(shape);
  }
  for (const element of selected) if (element.type === 'shape' && !grouped.has(element.id)) nodes.push(element);
  return nodes;
}
export function base(pageId: string, userId: string) {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    pageId,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
    zIndex: Date.now(),
  };
}
export function shape(
  pageId: string,
  userId: string,
  x: number,
  y: number,
  width: number,
  height: number,
  shapeType: ShapeElement["data"]["shapeType"] = "rectangle",
): ShapeElement {
  return {
    ...base(pageId, userId),
    type: "shape",
    data: {
      shapeType,
      position: { x, y },
      size: { width, height },
      rotation: 0,
      bounds: { x, y, width, height },
      style: {
        stroke: {
          color: "#7c3a93",
          width: 2,
          opacity: 1,
          lineCap: "round",
          lineJoin: "round",
          pattern: "solid",
        },
        fill: { type: "solid", color: "#f3e8ff", opacity: 1 },
        roughness: 0,
        seed: 1,
        cornerRadius: 8,
      },
    },
  };
}
export function text(
  pageId: string,
  userId: string,
  x: number,
  y: number,
  content: string,
  width = 220,
): TextElement {
  const height = Math.max(28, content.split("\n").length * 25);
  return {
    ...base(pageId, userId),
    type: "text",
    data: {
      content,
      position: { x, y },
      size: { width, height },
      rotation: 0,
      bounds: { x, y, width, height },
      style: {
        fontFamily: "sans-serif",
        fontSize: 18,
        fontWeight: "normal",
        fontStyle: "normal",
        color: "#262033",
        textAlign: "left",
        opacity: 1,
      },
    },
  };
}
export function line(
  pageId: string,
  userId: string,
  points: Point[],
  arrowEnd = false,
): LinearElement {
  const xs = points.map((p) => p.x),
    ys = points.map((p) => p.y);
  return {
    ...base(pageId, userId),
    type: "linear",
    data: {
      linearType: arrowEnd ? "arrow" : "line",
      points,
      rotation: 0,
      style: {
        color: "#7c3a93",
        width: 2,
        opacity: 1,
        lineCap: "round",
        lineJoin: "round",
        pattern: "solid",
      },
      roughness: 0,
      seed: 1,
      arrowStart: false,
      arrowEnd,
      bounds: {
        x: Math.min(...xs),
        y: Math.min(...ys),
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys),
      },
    },
  };
}
export function image(
  pageId: string,
  userId: string,
  x: number,
  y: number,
  width: number,
  height: number,
  url: string,
  assetId: string,
): ImageElement {
  return {
    ...base(pageId, userId),
    type: "image",
    data: {
      assetId,
      url,
      position: { x, y },
      size: { width, height },
      rotation: 0,
      bounds: { x, y, width, height },
    },
  };
}
export function group(elements: Element[]): GroupElement {
  if (!elements.length) throw new Error("Cannot group empty elements");
  const bs = elements.map((e) => e.data.bounds),
    x = Math.min(...bs.map((b) => b.x)),
    y = Math.min(...bs.map((b) => b.y));
  return {
    ...base(elements[0].pageId, elements[0].createdBy),
    type: "group",
    data: {
      childIds: elements.map((e) => e.id),
      bounds: {
        x,
        y,
        width: Math.max(...bs.map((b) => b.x + b.width)) - x,
        height: Math.max(...bs.map((b) => b.y + b.height)) - y,
      },
    },
  };
}
