import { describe,it,expect } from 'vitest';
import { createStarterTemplate, presetTools } from './presets';
import { snapKanbanCards,createVote,countVotes,createTimer,remainingSeconds } from './collaboration';

describe('specialized board tools',()=>{
 it('has usable presets and starters for all diagram and collaboration types',()=>{
  for(const type of ['uml','er','flowchart','automata','network','mind-map','wireframe','kanban','brainstorm','lecture-notes']){
   expect(presetTools[type].length).toBeGreaterThan(1);
   const elements=createStarterTemplate(type,'page','user');
   expect(elements.length).toBeGreaterThan(2);
   expect(new Set(elements.map(e=>e.id)).size).toBe(elements.length);
   for(const element of elements)expect(element.pageId).toBe('page');
  }
 });
 it('snaps dragged cards without moving untouched cards',()=>{
  const elements=createStarterTemplate('kanban','page','user');
  const card=elements.find(e=>e.data.specialized?.kind==='kanban-card')!;
  expect(snapKanbanCards(elements,new Set())).toEqual([]);
  // Deliberately shift the card content off the centered position.
  if(card.type!=='group')throw new Error('Expected card group');
  for(const child of elements.filter(e=>card.data.childIds.includes(e.id)))child.data.bounds.x+=30;
  const mutations=snapKanbanCards(elements,new Set([card.id]));
  expect(mutations.length).toBeGreaterThan(1);
  expect(mutations.every(m=>m.elementId===card.id||card.data.childIds.includes(m.elementId))).toBe(true);
 });
 it('tracks independent voters and prevents duplicate votes',()=>{
  const elements=createStarterTemplate('brainstorm','page','user');
  const note=elements.find(e=>e.data.specialized?.kind==='brainstorm-note')!;
  const one=createVote(elements,note.id,'alice','page');
  const two=createVote([...elements,...one],note.id,'bob','page');
  expect(one[0].id).not.toBe(two[0].id);
  expect(createVote([...elements,...one],note.id,'alice','page')).toEqual([]);
  expect(countVotes([...one,...two],note.id)).toBe(2);
 });
 it('uses a shared absolute deadline and clamps expired timers',()=>{
  const timer=createTimer('page','user',10000);
  expect(remainingSeconds(timer,5000)).toBe(5);
  expect(remainingSeconds(timer,11000)).toBe(0);
 });
});
