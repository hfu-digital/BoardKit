import type { Element, ShapeElement } from '@hfu.digital/boardkit-core';
import { shape, text, line, group } from './elements';

export interface PresetTool {
    id: string;
    label: string;
    description: string;
    create(pageId: string, userId: string, x: number, y: number): Element[];
}
const colors = { purple: '#f3e8ff', blue: '#dbeafe', green: '#dcfce7', yellow: '#fef3c7', pink: '#fce7f3' };
function box(pageId: string, userId: string, x: number, y: number, w: number, h: number, label: string, fill = colors.purple, kind: ShapeElement['data']['shapeType'] = 'rectangle'): Element[] {
    const node = shape(pageId, userId, x, y, w, h, kind);
    node.data.style.fill = { type: 'solid', color: fill, opacity: 1 };
    node.data.style.cornerRadius = kind === 'rectangle' ? 10 : 0;
    const title = text(pageId, userId, x + 16, y + 16, label, w - 32);
    title.data.style.fontSize = 16;
    const children: Element[] = [node, title];
    return [...children, group(children)];
}
function tool(id: string, label: string, description: string, create: PresetTool['create']): PresetTool { return { id, label, description, create }; }
function node(id: string, label: string, content: string, fill = colors.purple, kind: ShapeElement['data']['shapeType'] = 'rectangle', w = 200, h = 120): PresetTool {
    return tool(id, label, `Insert ${label.toLowerCase()}`, (p, u, x, y) => box(p,u,x,y,w,h,content,fill,kind));
}
function relation(id: string, label: string, content: string, dashed = false): PresetTool {
    return tool(id,label,`Connect diagram elements with ${label.toLowerCase()}`, (p,u,x,y) => {
        const edge = line(p,u,[{x,y:y+30},{x:x+200,y:y+30}],true);
        edge.data.style.pattern = dashed ? 'dashed' : 'solid';
        return [edge,text(p,u,x+30,y,content,170)];
    });
}
function umlClass(p:string,u:string,x:number,y:number):Element[] {
    const els = box(p,u,x,y,230,160,'ClassName\n\n+ attribute: Type\n\n+ method(): void',colors.blue);
    els.splice(els.length-1,0,line(p,u,[{x,y:y+45},{x:x+230,y:y+45}]),line(p,u,[{x,y:y+93},{x:x+230,y:y+93}]));
    const content=els.filter(e=>e.type!=='group');
    return [...content,group(content)];
}
function kanbanColumn(p:string,u:string,x:number,y:number,label='To do'):Element[] {
    const els = box(p,u,x,y,280,550,label,colors.blue);
    const column=els.find(e=>e.type==='shape')!;
    column.data.specialized={kind:'kanban-column'};
    // Columns are independently movable frames, not grouped with all future cards.
    return els.filter(e=>e.type!=='group');
}
function kanbanCard(p:string,u:string,x:number,y:number):Element[] {
    const els=box(p,u,x,y,248,110,'Task title\nAdd a description',colors.yellow);
    const cardGroup=els.find(e=>e.type==='group')!;
    cardGroup.data.specialized={kind:'kanban-card'};
    return els;
}
function sticky(p:string,u:string,x:number,y:number):Element[] {
    const els=box(p,u,x,y,190,150,'Your idea here',colors.yellow);
    const card=els.find(e=>e.type==='group')!;
    card.data.specialized={kind:'brainstorm-note'};
    return els;
}
function actor(p:string,u:string,x:number,y:number):Element[] {
    const head=shape(p,u,x+30,y,40,40,'ellipse');
    const body=line(p,u,[{x:x+50,y:y+40},{x:x+50,y:y+105}]);
    const arms=line(p,u,[{x:x+10,y:y+60},{x:x+90,y:y+60}]);
    const legs=line(p,u,[{x:x+15,y:y+145},{x:x+50,y:y+105},{x:x+85,y:y+145}]);
    const els:Element[]=[head,body,arms,legs,text(p,u,x,y+155,'Actor',100)];
    return [...els,group(els)];
}
function pageFrame(p:string,u:string,x:number,y:number):Element[] {
    const border=shape(p,u,x,y,595,842); border.data.style.fill={type:'solid',color:'#ffffff',opacity:1};
    border.data.specialized={kind:'lecture-page'};
    return [border,text(p,u,x+40,y+30,'Lecture title',515)];
}
function ruledPage(p:string,u:string,x:number,y:number):Element[] {
    const els=pageFrame(p,u,x,y);
    for(let n=0;n<21;n++) els.push(line(p,u,[{x:x+35,y:y+110+n*30},{x:x+560,y:y+110+n*30}]));
    return els;
}
export const presetTools: Record<string, PresetTool[]> = {
    standard: [],
    uml: [tool('class','Class','Class with attributes and operations compartments',umlClass), node('interface','Interface','«interface»\nService\n\n+ execute(): void',colors.green),tool('actor','Actor','Use-case actor',actor),node('use-case','Use case','Use case',colors.purple,'ellipse',210,90),relation('association','Association','association'),relation('implements','Realization','«implements»',true)],
    er: [node('entity','Entity','Entity\n────────────\nPK id: UUID\nname: string\nFK owner_id',colors.blue,'rectangle',230,160),node('attribute','Attribute','attribute',colors.yellow,'ellipse',150,70),node('relationship','Relationship','has',colors.purple,'diamond',150,100),relation('one-many','One to many','1                          N'),relation('many-many','Many to many','N                          M')],
    flowchart: [node('process','Process','Process',colors.blue),node('decision','Decision','Condition?',colors.yellow,'diamond',190,130),node('terminal','Start / End','Start / End',colors.green,'ellipse',160,70),node('input','Input / Output','Input / Output',colors.pink),relation('flow','Flow','next')],
    automata: [node('state','State','q0',colors.blue,'ellipse',100,100),tool('accept','Accept state','Double-circle accepting state',(p,u,x,y)=>{const outer=shape(p,u,x,y,100,100,'ellipse');const inner=shape(p,u,x+7,y+7,86,86,'ellipse');const els:Element[]=[outer,inner,text(p,u,x+32,y+35,'qf',70)];return [...els,group(els)];}),relation('transition','Transition','a, b'),tool('loop','Self-loop','Loop transition',(p,u,x,y)=>[line(p,u,[{x:x+30,y:y+70},{x,y:y+20},{x:x+80,y:y+20},{x:x+55,y:y+70}],true),text(p,u,x+25,y-10,'a',80)])],
    network: [node('server','Server','▤ Server\n10.0.0.10',colors.blue),node('router','Router','Router\nGateway',colors.purple,'ellipse',180,100),node('client','Client','Client\nWorkstation',colors.green),node('cloud','Cloud','Cloud / Internet',colors.blue,'ellipse',220,100),relation('link','Network link','1 Gbit/s')],
    'mind-map': [node('topic','Central topic','Central topic',colors.purple,'ellipse',230,110),node('branch','Branch','New branch',colors.blue,'rectangle',190,85),node('idea','Idea','Supporting idea',colors.yellow,'rectangle',180,85),relation('branch-link','Branch link','')],
    wireframe: [tool('browser','Browser frame','Desktop layout frame',(p,u,x,y)=>{const els=box(p,u,x,y,640,440,'● ● ●       example.com',colors.blue);const content=els.filter(e=>e.type!=='group');content.push(line(p,u,[{x,y:y+50},{x:x+640,y:y+50}]));return [...content,group(content)];}),node('mobile','Mobile frame','9:41\n\nMobile screen',colors.blue,'rectangle',240,480),node('button','Button','Button',colors.purple,'rectangle',170,60),node('input','Text input','Enter text…',colors.blue,'rectangle',270,60),node('image','Image placeholder','╳   Image',colors.yellow,'rectangle',250,150),node('text-block','Text block','Heading\nBody text goes here.\nA second line of content.',colors.green,'rectangle',320,130)],
    kanban: [tool('column','Column','A column that cards snap inside',(p,u,x,y)=>kanbanColumn(p,u,x,y)),tool('card','Task card','Drag into a column to snap',kanbanCard)],
    brainstorm: [tool('sticky','Sticky note','An idea that collaborators can vote on',sticky),node('cluster','Theme','Theme / cluster',colors.purple,'rectangle',300,220),node('question','Prompt','How might we…?',colors.blue,'rectangle',400,90)],
    'lecture-notes': [tool('page','Page frame','A4 page for notes',pageFrame),tool('ruled-page','Ruled page','Lined page for handwritten notes',ruledPage),node('definition','Definition','Definition\n\nKey concept and explanation',colors.blue,'rectangle',350,150),node('theorem','Theorem','Theorem\n\nStatement\n\nProof:',colors.purple,'rectangle',350,220),node('summary','Summary','Summary\n• Key takeaway\n• Follow-up question',colors.yellow,'rectangle',350,160)],
    math: [], circuit: [],
};

/** Explicit, additive starter templates; never overwrites an existing scene. */
function buildStarterTemplate(boardType:string,pageId:string,userId:string,x=80,y=80):Element[] {
    const p=pageId,u=userId;
    const take=(id:string,dx:number,dy:number)=>presetTools[boardType]?.find(t=>t.id===id)?.create(p,u,x+dx,y+dy)??[];
    const connect=(ax:number,ay:number,bx:number,by:number)=>line(p,u,[{x:x+ax,y:y+ay},{x:x+bx,y:y+by}],true);
    switch(boardType){
        case 'uml':return [...take('class',0,0),...take('interface',360,0),connect(230,65,360,65)];
        case 'er':return [...take('entity',0,0),...take('entity',440,0),connect(230,80,440,80),text(p,u,x+270,y+45,'1       N',150)];
        case 'flowchart':return [...take('terminal',90,0),...take('process',70,150),...take('decision',75,350),connect(170,70,170,150),connect(170,270,170,350)];
        case 'automata':return [...take('state',0,0),...take('accept',280,0),connect(100,50,280,50),text(p,u,x+160,y+15,'a, b',100)];
        case 'network':return [...take('cloud',230,0),...take('router',250,210),...take('server',0,420),...take('client',480,420),connect(340,100,340,210),connect(280,310,100,420),connect(400,310,580,420)];
        case 'mind-map':return [...take('topic',250,180),...take('branch',0,0),...take('branch',550,0),...take('idea',0,380),...take('idea',550,380),connect(250,210,190,75),connect(480,210,550,75),connect(250,260,180,405),connect(480,260,550,405)];
        case 'wireframe':return [...take('browser',0,0),...take('text-block',35,80),...take('image',350,80),...take('button',35,270),...take('input',270,270)];
        case 'kanban':return [...kanbanColumn(p,u,x,y,'To do'),...kanbanColumn(p,u,x+310,y,'In progress'),...kanbanColumn(p,u,x+620,y,'Done'),...kanbanCard(p,u,x+16,y+70)];
        case 'brainstorm':return [...take('question',100,0),...take('sticky',0,150),...take('sticky',240,150),...take('sticky',480,150)];
        case 'lecture-notes':return [...ruledPage(p,u,x,y),...take('summary',650,0)];
        default:return [];
    }
}

/** Template connectors stay attached when nodes are dragged or resized. */
export function createStarterTemplate(boardType:string,pageId:string,userId:string,x=80,y=80):Element[] {
    const elements=buildStarterTemplate(boardType,pageId,userId,x,y);
    const shapes=elements.filter((e):e is ShapeElement=>e.type==='shape');
    for(const element of elements){
        if(element.type!=='linear'||!element.data.arrowEnd)continue;
        const endpoints=[element.data.points[0],element.data.points[element.data.points.length-1]];
        endpoints.forEach((point,index)=>{
            const target=shapes.find(node=>{
                const b=node.data.bounds;
                const inside=point.x>=b.x-1&&point.x<=b.x+b.width+1&&point.y>=b.y-1&&point.y<=b.y+b.height+1;
                const edge=Math.min(Math.abs(point.x-b.x),Math.abs(point.x-b.x-b.width),Math.abs(point.y-b.y),Math.abs(point.y-b.y-b.height));
                return inside&&edge<=1;
            });
            if(target){if(index===0)element.data.startBinding={elementId:target.id};else element.data.endBinding={elementId:target.id};}
        });
    }
    return elements;
}
