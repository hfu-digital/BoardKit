export class ExportRequestDto {
    format!: 'png' | 'pdf' | 'svg';
    pageIds?: string[];
}
