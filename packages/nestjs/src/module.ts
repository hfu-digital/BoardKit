import { Module, type DynamicModule, type Provider } from '@nestjs/common';
import { BoardStorage } from './interfaces/board-storage.interface';
import { AssetStorage } from './interfaces/asset-storage.interface';
import { EventLogStorage } from './interfaces/event-log-storage.interface';
import { BoardAuthGuard } from './interfaces/auth-guard.interface';
import { RealtimeTransport } from './interfaces/realtime-transport.interface';
import { BoardService } from './domain/board.service';
import { PermissionService } from './domain/permission.service';
import { AssetService } from './domain/asset.service';
import { ExportService } from './domain/export.service';
import { BoardController } from './controllers/board.controller';
import { PageController } from './controllers/page.controller';
import { AssetController } from './controllers/asset.controller';
import { ExportController } from './controllers/export.controller';
import { ShareController } from './controllers/share.controller';

export interface BoardModuleOptions {
    // Required
    storage: BoardStorage;
    assetStorage: AssetStorage;
    eventLogStorage: EventLogStorage;
    authGuard: BoardAuthGuard;

    // Optional — realtime transport override
    realtimeTransport?: RealtimeTransport;

    // Optional — limits
    limits?: Partial<{
        maxElementsPerPage: number;
        maxPagesPerBoard: number;
        maxAssetSizeMb: number;
        maxBoardSizeMb: number;
    }>;

    // Optional — sync tuning
    sync?: Partial<{
        batchPersistIntervalMs: number;
        presenceTtlMs: number;
        reconnectWindowMs: number;
        maxMessageRatePerUser: number;
    }>;

    // Optional — deployment mode
    deployment?: {
        mode: 'self-hosted' | 'managed';
        syncServiceUrl?: string;
    };
}

export const BOARD_MODULE_OPTIONS = 'BOARD_MODULE_OPTIONS';

@Module({})
export class BoardModule {
    static register(options: BoardModuleOptions): DynamicModule {
        const providers: Provider[] = [
            {
                provide: BOARD_MODULE_OPTIONS,
                useValue: options,
            },
            {
                provide: BoardStorage,
                useValue: options.storage,
            },
            {
                provide: AssetStorage,
                useValue: options.assetStorage,
            },
            {
                provide: EventLogStorage,
                useValue: options.eventLogStorage,
            },
            {
                provide: BoardAuthGuard,
                useValue: options.authGuard,
            },
            BoardService,
            PermissionService,
            {
                provide: AssetService,
                useFactory: () =>
                    new AssetService(options.assetStorage, {
                        maxAssetSizeMb: options.limits?.maxAssetSizeMb,
                        maxBoardSizeMb: options.limits?.maxBoardSizeMb,
                    }),
            },
            {
                provide: ExportService,
                useFactory: (storage: BoardStorage) => new ExportService(storage),
                inject: [BoardStorage],
            },
        ];

        if (options.realtimeTransport) {
            providers.push({
                provide: RealtimeTransport,
                useValue: options.realtimeTransport,
            });
        }

        const controllers = [
            BoardController,
            PageController,
            AssetController,
            ExportController,
            ShareController,
        ];

        return {
            module: BoardModule,
            providers,
            controllers,
            exports: [
                BoardService,
                PermissionService,
                AssetService,
                ExportService,
                BoardStorage,
                AssetStorage,
                EventLogStorage,
                BoardAuthGuard,
            ],
        };
    }
}
