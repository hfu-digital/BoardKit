export class CreateShareLinkDto {
    permission!: 'view' | 'edit';
    expiresAt?: string;
}
