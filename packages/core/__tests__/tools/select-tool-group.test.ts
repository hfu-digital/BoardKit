import {describe,it,expect} from 'vitest';
import { SelectTool } from '../../src/tools/select.tool';
import { loadElements } from '../../src/scene/scene-graph';
import { DEFAULT_SHAPE_STYLE } from '../../src/constants';
import type {Element,InputEvent,ShapeElement,GroupElement} from '../../src/index';
const base={pageId:'p1',zIndex:0,createdBy:'user',createdAt:'',updatedAt:''};
function rect(id:string,x:number):ShapeElement{return {...base,id,type:'shape',data:{shapeType:'rectangle',position:{x,y:0},size:{width:100,height:80},rotation:0,bounds:{x,y:0,width:100,height:80},style:DEFAULT_SHAPE_STYLE}};}
function group(id:string,childIds:string[],x=0,width=220):GroupElement{return {...base,id,type:'group',data:{childIds,bounds:{x,y:0,width,height:80}}};}
function event(type:InputEvent['type'],x:number,y:number,shift=false):InputEvent{return {type,position:{x,y},button:0,modifiers:{shift,meta:true,ctrl:false,alt:false},timestamp:0};}
function setup(elements:Element[]){const tool=new SelectTool();tool.setPageId('p1');return {tool,scene:loadElements(elements)};}
describe('group selection',()=>{
 it('promotes clicked children and moves the whole group',()=>{
  const {tool,scene}=setup([rect('a',0),rect('b',120),group('g',['a','b'])]);
  const down=tool.onPointerDown(event('pointerDown',50,0),scene);
  expect([...down.selection!].sort()).toEqual(['a','b','g']);
  tool.onPointerMove(event('pointerMove',80,30),scene);
  const up=tool.onPointerUp(event('pointerUp',80,30),scene);
  expect(up.mutations?.length).toBe(3);
  const a=up.mutations!.find(m=>m.elementId==='a')!.data as ShapeElement;
  expect(a.data.position).toEqual({x:30,y:30});
 });
 it('expands a programmatic group selection for resizing',()=>{
  const {tool,scene}=setup([rect('a',0),rect('b',120),group('g',['a','b'])]);
  tool.setCurrentSelection(new Set(['g']));
  tool.onPointerDown(event('pointerDown',220,80),scene);
  const up=tool.onPointerUp(event('pointerUp',440,160),scene);
  expect(up.mutations?.length).toBe(3);
  const a=up.mutations!.find(m=>m.elementId==='a')!.data as ShapeElement;
  expect(a.data.size).toEqual({width:200,height:160});
 });
 it('expands nested groups with cycle protection',()=>{
  const {tool,scene}=setup([rect('a',0),group('inner',['a','outer']),group('outer',['inner'])]);
  const result=tool.onPointerDown(event('pointerDown',20,0),scene);
  expect(result.selection?.size).toBe(3);
 });
 it('shift deselects all members together',()=>{
  const {tool,scene}=setup([rect('a',0),rect('b',120),group('g',['a','b'])]);
  tool.setCurrentSelection(new Set(['g','a','b']));
  const result=tool.onPointerDown(event('pointerDown',50,0,true),scene);
  expect(result.selection?.size).toBe(0);
 });
});
