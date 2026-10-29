import { describe, it, expect } from 'vitest';
import { SelectTool, EraserTool, loadElements, DEFAULT_SHAPE_STYLE, type Element, type InputEvent } from '../../src';
const event = (type: InputEvent['type'], x: number, y: number): InputEvent => ({type,position:{x,y},button:0,modifiers:{shift:false,meta:false,ctrl:false,alt:false},timestamp:0});
const element = (locked: boolean): Element => ({id:'background',pageId:'p',type:'shape',zIndex:1,createdBy:'u',createdAt:'',updatedAt:'',data:{shapeType:'rectangle',position:{x:0,y:0},size:{width:100,height:100},rotation:0,bounds:{x:0,y:0,width:100,height:100},style:DEFAULT_SHAPE_STYLE,specialized:{kind:'pdf-slide',locked}}}) as Element;
describe('locked annotation backgrounds', () => {
    it('skips pointer selection, rubber band and eraser until explicitly unlocked', () => {
        const select = new SelectTool(); select.setPageId('p');
        const scene = loadElements([element(true)]);
        expect(select.onPointerDown(event('pointerDown',0,50),scene).selection?.size).toBe(0);
        select.onPointerDown(event('pointerDown',-10,-10),scene);
        expect(select.onPointerMove(event('pointerMove',120,120),scene).selection?.size).toBe(0);
        const eraser = new EraserTool(); eraser.setPageId('p');
        eraser.onPointerDown(event('pointerDown',50,50),scene);
        expect(eraser.onPointerUp(event('pointerUp',50,50),scene).mutations).toBeUndefined();
        const unlocked = loadElements([element(false)]);
        eraser.onPointerDown(event('pointerDown',50,50),unlocked);
        expect(eraser.onPointerUp(event('pointerUp',50,50),unlocked).mutations).toHaveLength(1);
    });
});
