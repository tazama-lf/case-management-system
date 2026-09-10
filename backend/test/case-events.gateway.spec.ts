import { Test, TestingModule } from '@nestjs/testing';
import type { Server, Socket } from 'socket.io';

import { CaseEventsGateway } from '../src/modules/case-events/case-events.gateway';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../src/modules/shared/redis.service';
import { TazamaClaims } from '../src/decorators/auth.decorator';

// Mock validateTazamaToken so we don't need real JWTs
jest.mock('../src/guards/tazama-token-validator', () => ({
    validateTazamaToken: jest.fn(),
}));

const { validateTazamaToken } = require('../src/guards/tazama-token-validator') as {
    validateTazamaToken: jest.Mock;
};

/**
 * Creates a minimal mock Socket with the handshake.auth.token and the
 * per-connection data bag that socket.io provides.
 */
function createMockSocket(token?: string): Socket {
    return {
        id: `socket-${Math.random().toString(36).slice(2)}`,
        handshake: { auth: { token } } as unknown as Socket['handshake'],
        data: {},
        emit: jest.fn(),
        disconnect: jest.fn(),
        join: jest.fn(),
        leave: jest.fn(),
        to: jest.fn().mockReturnThis(),
        on: jest.fn(),
        once: jest.fn(),
        off: jest.fn(),
        removeAllListeners: jest.fn(),
        send: jest.fn(),
        close: jest.fn(),
        conn: {} as Socket['conn'],
        rooms: new Set<string>(),
        volatile: {} as Socket['volatile'],
        local: {} as Socket['local'],
        timeout: jest.fn().mockReturnThis(),
        compress: jest.fn().mockReturnThis(),
        listenersAny: jest.fn().mockReturnValue([]),
        listenersAnyOutgoing: jest.fn().mockReturnValue([]),
        onAny: jest.fn().mockReturnThis(),
        onAnyOutgoing: jest.fn().mockReturnThis(),
        offAny: jest.fn().mockReturnThis(),
        offAnyOutgoing: jest.fn().mockReturnThis(),
        prependAny: jest.fn().mockReturnThis(),
        prependAnyOutgoing: jest.fn().mockReturnThis(),
        listeners: jest.fn().mockReturnValue([]),
        rawListeners: jest.fn().mockReturnValue([]),
        eventNames: jest.fn().mockReturnValue([]),
        addListener: jest.fn().mockReturnThis(),
        removeListener: jest.fn().mockReturnThis(),
        setMaxListeners: jest.fn().mockReturnThis(),
        getMaxListeners: jest.fn().mockReturnValue(10),
    } as unknown as Socket;
}

describe('CaseEventsGateway', () => {
    let gateway: CaseEventsGateway;
    let mockFindUnique: jest.Mock;
    let mockGetClient: jest.Mock;
    let mockServer: Server;

    const mockRedisClient = {
        eval: jest.fn(),
        srem: jest.fn(),
        expire: jest.fn(),
    };

    beforeEach(async () => {
        jest.clearAllMocks();

        // Default: Redis is connected, and the atomic register script reports success (1).
        mockRedisClient.eval.mockResolvedValue(1);
        mockRedisClient.srem.mockResolvedValue(1);
        mockRedisClient.expire.mockResolvedValue(1);

        mockFindUnique = jest.fn();
        mockGetClient = jest.fn().mockReturnValue(mockRedisClient);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CaseEventsGateway,
                { provide: PrismaService, useValue: { case: { findUnique: mockFindUnique } } },
                { provide: RedisService, useValue: { getClient: mockGetClient } },
            ],
        }).compile();

        gateway = module.get<CaseEventsGateway>(CaseEventsGateway);

        // Inject a mock Server into the @WebSocketServer property
        mockServer = {
            to: jest.fn().mockReturnThis(),
            emit: jest.fn(),
            in: jest.fn().mockReturnThis(),
            except: jest.fn().mockReturnThis(),
            on: jest.fn(),
            close: jest.fn(),
            engine: {},
            sockets: {} as Server['sockets'],
            adapter: {} as Server['adapter'],
            httpServer: {} as Server['httpServer'],
            attach: jest.fn(),
            bind: jest.fn(),
            listen: jest.fn(),
            use: jest.fn().mockReturnThis(),
            removeAllListeners: jest.fn(),
            listeners: jest.fn().mockReturnValue([]),
            eventNames: jest.fn().mockReturnValue([]),
            addListener: jest.fn().mockReturnThis(),
            removeListener: jest.fn().mockReturnThis(),
            setMaxListeners: jest.fn().mockReturnThis(),
            getMaxListeners: jest.fn().mockReturnValue(10),
            fetchSockets: jest.fn().mockResolvedValue([]),
            sideEffect: jest.fn().mockReturnThis(),
            timeout: jest.fn().mockReturnThis(),
            volatile: {} as Server['volatile'],
            local: {} as Server['local'],
            compress: jest.fn().mockReturnThis(),
            onAny: jest.fn().mockReturnThis(),
            onAnyOutgoing: jest.fn().mockReturnThis(),
            offAny: jest.fn().mockReturnThis(),
            offAnyOutgoing: jest.fn().mockReturnThis(),
            prependAny: jest.fn().mockReturnThis(),
            prependAnyOutgoing: jest.fn().mockReturnThis(),
            listenersAny: jest.fn().mockReturnValue([]),
            listenersAnyOutgoing: jest.fn().mockReturnValue([]),
        } as unknown as Server;

        (gateway as unknown as { server: Server }).server = mockServer;
    });

    // ─── handleConnection ─────────────────────────────────────────────────

    describe('handleConnection', () => {
        it('should accept a valid token and join the tenant room', async () => {
            const socket = createMockSocket('valid-token');
            validateTazamaToken.mockReturnValue({
                userId: 'user-1',
                tenantId: 'tenant-a',
                actorRole: 'CMS_INVESTIGATOR',
            });

            await gateway.handleConnection(socket);

            expect(validateTazamaToken).toHaveBeenCalledWith('valid-token', [], [
                TazamaClaims.CMS_INVESTIGATOR,
                TazamaClaims.CMS_SUPERVISOR,
                TazamaClaims.CMS_COMPLIANCE_OFFICER,
            ]);
            expect(socket.join).toHaveBeenCalledWith('tenant:tenant-a');
            expect(socket.data.userId).toBe('user-1');
            expect(socket.data.trackedViaRedis).toBe(true);
        });

        it('should emit auth_failed and disconnect when no token is provided', async () => {
            const socket = createMockSocket(undefined);

            await gateway.handleConnection(socket);

            expect(socket.emit).toHaveBeenCalledWith('auth_failed');
            expect(socket.disconnect).toHaveBeenCalledWith(true);
        });

        it('should emit auth_failed and disconnect when validateTazamaToken throws', async () => {
            const socket = createMockSocket('bad-token');
            validateTazamaToken.mockImplementation(() => {
                throw new Error('Invalid token');
            });

            await gateway.handleConnection(socket);

            expect(socket.emit).toHaveBeenCalledWith('auth_failed');
            expect(socket.disconnect).toHaveBeenCalledWith(true);
        });

        it('should reject with connection_limit_exceeded when Redis count >= 5', async () => {
            const socket = createMockSocket('valid-token');
            validateTazamaToken.mockReturnValue({
                userId: 'user-1',
                tenantId: 'tenant-a',
                actorRole: 'CMS_INVESTIGATOR',
            });
            mockRedisClient.eval.mockResolvedValue(0);

            await gateway.handleConnection(socket);

            expect(socket.emit).toHaveBeenCalledWith('connection_limit_exceeded');
            expect(socket.disconnect).toHaveBeenCalledWith(true);
            expect(socket.join).not.toHaveBeenCalled();
        });

        it('should track via local Map when Redis client is null', async () => {
            mockGetClient.mockReturnValue(null);
            const socket = createMockSocket('valid-token');
            validateTazamaToken.mockReturnValue({
                userId: 'user-1',
                tenantId: 'tenant-a',
                actorRole: 'CMS_INVESTIGATOR',
            });

            await gateway.handleConnection(socket);

            expect(socket.data.trackedViaRedis).toBe(false);
            expect(socket.join).toHaveBeenCalledWith('tenant:tenant-a');
        });

        it('should reject via local limit when Redis is null and local set is full', async () => {
            mockGetClient.mockReturnValue(null);
            validateTazamaToken.mockReturnValue({
                userId: 'user-1',
                tenantId: 'tenant-a',
                actorRole: 'CMS_INVESTIGATOR',
            });

            // Connect 5 sockets to fill the local limit
            for (let i = 0; i < 5; i++) {
                const s = createMockSocket('valid-token');
                await gateway.handleConnection(s);
            }

            // 6th should be rejected
            const socket = createMockSocket('valid-token');
            await gateway.handleConnection(socket);

            expect(socket.emit).toHaveBeenCalledWith('connection_limit_exceeded');
            expect(socket.disconnect).toHaveBeenCalledWith(true);
        });

        it('should fall back to local tracking when the Redis eval call rejects', async () => {
            mockRedisClient.eval.mockRejectedValue(new Error('Redis connection lost'));
            validateTazamaToken.mockReturnValue({
                userId: 'user-1',
                tenantId: 'tenant-a',
                actorRole: 'CMS_INVESTIGATOR',
            });
            const socket = createMockSocket('valid-token');

            await gateway.handleConnection(socket);

            expect(socket.emit).not.toHaveBeenCalledWith('auth_failed');
            expect(socket.join).toHaveBeenCalledWith('tenant:tenant-a');
            expect(socket.data.trackedViaRedis).toBe(false);
        });
    });

    // ─── handleDisconnect ─────────────────────────────────────────────────

    describe('handleDisconnect', () => {
        it('should remove the socket from Redis when tracked via Redis', async () => {
            const socket = createMockSocket('valid-token');
            socket.data.userId = 'user-1';
            socket.data.trackedViaRedis = true;

            await gateway.handleDisconnect(socket);

            expect(mockRedisClient.srem).toHaveBeenCalledWith('case-events:user-sockets:user-1', socket.id);
        });

        it('should remove the socket from local Map when tracked locally', async () => {
            mockGetClient.mockReturnValue(null);
            // Register a connection locally first
            validateTazamaToken.mockReturnValue({
                userId: 'user-1',
                tenantId: 'tenant-a',
                actorRole: 'CMS_INVESTIGATOR',
            });
            const socket = createMockSocket('valid-token');
            await gateway.handleConnection(socket);

            // Now disconnect
            await gateway.handleDisconnect(socket);

            // Re-register should succeed since the slot was freed
            const socket2 = createMockSocket('valid-token');
            await gateway.handleConnection(socket2);
            expect(socket2.emit).not.toHaveBeenCalledWith('connection_limit_exceeded');
        });

        it('should do nothing when userId is not set (never authenticated)', async () => {
            const socket = createMockSocket('valid-token');
            socket.data = {};

            await gateway.handleDisconnect(socket);

            expect(mockRedisClient.srem).not.toHaveBeenCalled();
        });
    });

    // ─── TTL refresh interval ─────────────────────────────────────────────

    describe('TTL refresh interval', () => {
        const REFRESH_INTERVAL_MS = 15 * 60 * 1000;

        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            gateway.onModuleDestroy();
            jest.useRealTimers();
        });

        it('should start a periodic refresh on module init and stop it on destroy', () => {
            const setIntervalSpy = jest.spyOn(global, 'setInterval');
            const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

            gateway.onModuleInit();

            expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), REFRESH_INTERVAL_MS);

            gateway.onModuleDestroy();

            expect(clearIntervalSpy).toHaveBeenCalled();
        });

        it("should refresh a user's TTL while they still have an open Redis-tracked socket", async () => {
            validateTazamaToken.mockReturnValue({ userId: 'user-1', tenantId: 'tenant-a', actorRole: 'CMS_INVESTIGATOR' });
            await gateway.handleConnection(createMockSocket('valid-token'));

            gateway.onModuleInit();
            await jest.advanceTimersByTimeAsync(REFRESH_INTERVAL_MS);

            expect(mockRedisClient.expire).toHaveBeenCalledWith('case-events:user-sockets:user-1', 60 * 60);
        });

        it('should stop refreshing once the user has no sockets left tracked via Redis', async () => {
            validateTazamaToken.mockReturnValue({ userId: 'user-1', tenantId: 'tenant-a', actorRole: 'CMS_INVESTIGATOR' });
            const socket = createMockSocket('valid-token');
            await gateway.handleConnection(socket);
            await gateway.handleDisconnect(socket);

            gateway.onModuleInit();
            await jest.advanceTimersByTimeAsync(REFRESH_INTERVAL_MS);

            expect(mockRedisClient.expire).not.toHaveBeenCalled();
        });

        it('should skip the refresh entirely when Redis is unavailable', async () => {
            validateTazamaToken.mockReturnValue({ userId: 'user-1', tenantId: 'tenant-a', actorRole: 'CMS_INVESTIGATOR' });
            await gateway.handleConnection(createMockSocket('valid-token'));
            mockGetClient.mockReturnValue(null);

            gateway.onModuleInit();
            await jest.advanceTimersByTimeAsync(REFRESH_INTERVAL_MS);

            expect(mockRedisClient.expire).not.toHaveBeenCalled();
        });

        it('should log and continue when an EXPIRE call rejects', async () => {
            validateTazamaToken.mockReturnValue({ userId: 'user-1', tenantId: 'tenant-a', actorRole: 'CMS_INVESTIGATOR' });
            await gateway.handleConnection(createMockSocket('valid-token'));
            mockRedisClient.expire.mockRejectedValue(new Error('Redis down'));

            gateway.onModuleInit();

            await expect(jest.advanceTimersByTimeAsync(REFRESH_INTERVAL_MS)).resolves.toBeUndefined();
        });
    });

    // ─── handleCaseCreatedEvent ───────────────────────────────────────────

    describe('handleCaseCreatedEvent', () => {
        it('should broadcast case:changed with type "created" to the tenant room', () => {
            gateway.handleCaseCreatedEvent({ caseId: 42, tenantId: 'tenant-a' });

            expect(mockServer.to).toHaveBeenCalledWith('tenant:tenant-a');
            expect(mockServer.emit).toHaveBeenCalledWith('case:changed', {
                caseId: 42,
                type: 'created',
            });
        });

        it('should not throw when broadcast fails (caught internally)', () => {
            (mockServer.to as jest.Mock).mockImplementation(() => {
                throw new Error('server closed');
            });

            expect(() => gateway.handleCaseCreatedEvent({ caseId: 42, tenantId: 'tenant-a' })).not.toThrow();
        });
    });

    // ─── handleCaseStatusChangedEvent ─────────────────────────────────────

    describe('handleCaseStatusChangedEvent', () => {
        it('should look up the tenant and broadcast case:changed with type "status-changed"', async () => {
            mockFindUnique.mockResolvedValue({ tenant_id: 'tenant-b' });

            await gateway.handleCaseStatusChangedEvent({ caseId: 99 });

            expect(mockFindUnique).toHaveBeenCalledWith({
                where: { case_id: 99 },
                select: { tenant_id: true },
            });
            expect(mockServer.to).toHaveBeenCalledWith('tenant:tenant-b');
            expect(mockServer.emit).toHaveBeenCalledWith('case:changed', {
                caseId: 99,
                type: 'status-changed',
            });
        });

        it('should not broadcast when the case is not found', async () => {
            mockFindUnique.mockResolvedValue(null);

            await gateway.handleCaseStatusChangedEvent({ caseId: 999 });

            expect(mockServer.emit).not.toHaveBeenCalled();
        });

        it('should not throw when prisma throws (caught internally)', async () => {
            mockFindUnique.mockRejectedValue(new Error('DB down'));

            await expect(gateway.handleCaseStatusChangedEvent({ caseId: 99 })).resolves.toBeUndefined();
            expect(mockServer.emit).not.toHaveBeenCalled();
        });
    });
});
