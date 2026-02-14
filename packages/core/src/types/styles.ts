export interface StrokeStyle {
    color: string;
    width: number;
    opacity: number;
    lineCap: 'round' | 'butt' | 'square';
    lineJoin: 'round' | 'bevel' | 'miter';
}

export interface FillStyle {
    type: 'solid' | 'none';
    color: string;
    opacity: number;
}

export interface ShapeStyle {
    stroke: StrokeStyle;
    fill: FillStyle;
}

export interface TextStyle {
    fontFamily: string;
    fontSize: number;
    fontWeight: 'normal' | 'bold';
    fontStyle: 'normal' | 'italic';
    color: string;
    textAlign: 'left' | 'center' | 'right';
}
