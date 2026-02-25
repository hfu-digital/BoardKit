/**
 * Minimal NestJS server demonstrating BoardModule setup.
 *
 * This example uses the in-memory testing adapters so it can run
 * without any database. In production you would implement
 * BoardStorage, AssetStorage, EventLogStorage, and BoardAuthGuard
 * with real persistence (e.g. Prisma, S3, JWT).
 */

import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import {
    BoardModule,
    InMemoryBoardStorage,
    InMemoryAssetStorage,
    InMemoryEventLogStorage,
    MockAuthGuard,
} from '@hfu.digital/boardkit-nestjs';

@Module({
    imports: [
        BoardModule.register({
            storage: new InMemoryBoardStorage(),
            assetStorage: new InMemoryAssetStorage(),
            eventLogStorage: new InMemoryEventLogStorage(),
            authGuard: new MockAuthGuard(),
        }),
    ],
})
class AppModule {}

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    app.enableCors();
    await app.listen(3000);
    console.log('BoardKit server running on http://localhost:3000');
}

bootstrap();
