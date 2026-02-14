export class ElementMutationDto {
    type!: 'create' | 'update' | 'delete';
    elementId!: string;
    pageId!: string;
    data?: Record<string, unknown>;
    timestamp!: number;
}

export class BatchMutationDto {
    mutations!: ElementMutationDto[];
    requestId!: string;
}
