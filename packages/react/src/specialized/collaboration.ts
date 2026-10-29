import type { Element, ElementMutation, GroupElement, TextElement } from '@hfu.digital/boardkit-core';
import { moveElements } from '@hfu.digital/boardkit-core';
import { text } from './elements';

/** Snap only cards touched by the completed drag; other users' cards stay put. */
export function snapKanbanCards(elements: Element[], movedIds: Set<string>): ElementMutation[] {
    const columns=elements.filter(e=>e.data.specialized?.kind==='kanban-column');
    const mutations:ElementMutation[]=[];
    for(const card of elements){
        if(card.type!=='group'||card.data.specialized?.kind!=='kanban-card')continue;
        if(!movedIds.has(card.id)&&!card.data.childIds.some(id=>movedIds.has(id)))continue;
        const children=elements.filter(e=>card.data.childIds.includes(e.id));
        if(!children.length)continue;
        // Group bounds may lag behind a drag, so derive the live card bounds.
        const x=Math.min(...children.map(e=>e.data.bounds.x));
        const y=Math.min(...children.map(e=>e.data.bounds.y));
        const right=Math.max(...children.map(e=>e.data.bounds.x+e.data.bounds.width));
        const bottom=Math.max(...children.map(e=>e.data.bounds.y+e.data.bounds.height));
        const width=right-x,height=bottom-y;
        const center={x:x+width/2,y:y+height/2};
        const column=columns.find(e=>{const b=e.data.bounds;return center.x>=b.x&&center.x<=b.x+b.width&&center.y>=b.y&&center.y<=b.y+b.height;});
        if(!column)continue;
        const bounds=column.data.bounds;
        const nextX=bounds.x+Math.max(0,(bounds.width-width)/2);
        const nextY=Math.max(bounds.y+62,Math.min(y,bounds.y+bounds.height-height-16));
        if(Math.abs(nextX-x)<0.1&&Math.abs(nextY-y)<0.1)continue;
        const liveCard:GroupElement={...card,data:{...card.data,bounds:{x,y,width,height}}};
        const moved=moveElements([...children,liveCard],{x:nextX-x,y:nextY-y});
        for(const element of moved)mutations.push({type:'update',elementId:element.id,pageId:element.pageId,data:element,timestamp:Date.now()});
    }
    return mutations;
}

/** Each user owns a distinct vote element, avoiding shared vote-counter races. */
export function createVote(elements:Element[],targetId:string,userId:string,pageId:string):Element[] {
    if(!userId)throw new Error('Sign in to vote');
    const selected=elements.find(e=>e.id===targetId);
    const target=selected?.data.specialized?.kind==='brainstorm-note'?selected:elements.find(e=>e.type==='group'&&e.data.specialized?.kind==='brainstorm-note'&&e.data.childIds.includes(targetId));
    if(!target)throw new Error('Select an idea note to vote');
    if(elements.some(e=>e.data.specialized?.kind==='brainstorm-vote'&&e.data.specialized.targetId===target.id&&e.data.specialized.userId===userId))return [];
    const b=target.data.bounds;
    const vote=text(pageId,userId,b.x+12,b.y+b.height-28,'●',22);
    // Deterministic per-user ID makes repeated clicks idempotent even before sync.
    vote.id=`vote:${target.id}:${userId}`;
    vote.data.style.color='#9B2D9B';
    vote.data.specialized={kind:'brainstorm-vote',targetId:target.id,userId};
    return [vote];
}
export function countVotes(elements:Element[],targetId:string):number {
    const target=elements.find(e=>e.id===targetId);
    const noteId=target?.data.specialized?.kind==='brainstorm-note'?targetId:elements.find(e=>e.type==='group'&&e.data.specialized?.kind==='brainstorm-note'&&e.data.childIds.includes(targetId))?.id??targetId;
    return new Set(elements.filter(e=>e.data.specialized?.kind==='brainstorm-vote'&&e.data.specialized.targetId===noteId).map(e=>e.data.specialized!.userId)).size;
}
export function createTimer(pageId:string,userId:string,deadline:number,x=80,y=80):TextElement {
    if(!Number.isFinite(deadline))throw new Error('Invalid timer deadline');
    const timer=text(pageId,userId,x,y,`Brainstorm timer\nEnds ${new Date(deadline).toISOString()}`,440);
    timer.data.specialized={kind:'brainstorm-timer',deadline};
    return timer;
}
export function remainingSeconds(timer:Element,now=Date.now()):number {
    const deadline=timer.data.specialized?.deadline;
    return typeof deadline==='number'?Math.max(0,Math.ceil((deadline-now)/1000)):0;
}
