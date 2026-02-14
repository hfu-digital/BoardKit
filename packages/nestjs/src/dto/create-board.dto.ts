export class CreateBoardDto {
    name!: string;
    sessionType?: 'ephemeral' | 'persistent';
}
