import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import { roomRouter } from '../src/routes/roomRoutes.js';
import { roomManager } from '../src/roomManager.js';

const app = express();
app.use(express.json());
app.use('/api/rooms', roomRouter);

let server: http.Server;
let baseUrl: string;

const post = async (endpoint: string, body: any): Promise<{ status: number; body: any }> => {
  const res = await fetch(`${baseUrl}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, body: data };
};

describe('Phase 2: Room Creation, Invitations, and Authorization Test Suite', () => {
  before(() => {
    return new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address() as any;
        baseUrl = `http://127.0.0.1:${addr.port}/api/rooms`;
        resolve();
      });
    });
  });

  after(() => {
    return new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('1. Successfully creates a private room with separated credentials', async () => {
    const res = await post('/create', { hostName: 'Arav' });

    assert.equal(res.status, 201, 'Expected 201 Created');
    assert.equal(res.body.success, true);
    assert.ok(res.body.roomId, 'roomId should be defined');
    assert.ok(res.body.hostSecret, 'hostSecret should be defined');
    assert.ok(res.body.inviteSecret, 'inviteSecret should be defined');
    assert.ok(res.body.token, 'LiveKit JWT token should be returned for host');
    assert.equal(res.body.participant.role, 'host');

    // Security check: Verify that hostSecret and inviteSecret are distinct and separate
    assert.notEqual(res.body.hostSecret, res.body.inviteSecret, 'hostSecret and inviteSecret must be distinct');
    assert.notEqual(res.body.inviteSecret, res.body.roomId, 'inviteSecret must not equal roomId');
  });

  it('2. Successfully authorizes guest using valid invitation credential', async () => {
    const createRes = await post('/create', { hostName: 'HostA' });
    const { roomId, inviteSecret } = createRes.body;

    const joinRes = await post('/join', {
      roomId,
      inviteSecret,
      guestName: 'Elena',
    });

    assert.equal(joinRes.status, 200, 'Expected 200 OK for valid invitation');
    assert.equal(joinRes.body.success, true);
    assert.equal(joinRes.body.participant.role, 'guest');
    assert.equal(joinRes.body.participant.name, 'Elena');
    assert.ok(joinRes.body.token, 'LiveKit JWT token must be generated for authorized guest');
  });

  it('3. Rejects join attempts with non-existent or arbitrary room IDs', async () => {
    const joinRes = await post('/join', {
      roomId: 'fake-room-9999',
      inviteSecret: 'randomsecret12345678',
      guestName: 'Intruder',
    });

    assert.equal(joinRes.status, 404, 'Non-existent room must return 404 Not Found');
    assert.match(joinRes.body.error, /not found|expired/i);
  });

  it('4. Rejects join attempts with invalid or manipulated invitation credentials', async () => {
    const createRes = await post('/create', { hostName: 'HostB' });
    const { roomId } = createRes.body;

    const joinRes = await post('/join', {
      roomId,
      inviteSecret: 'incorrect_secret_code_123',
      guestName: 'Intruder',
    });

    assert.equal(joinRes.status, 401, 'Invalid invitation credential must return 401 Unauthorized');
    assert.match(joinRes.body.error, /invalid invitation/i);
  });

  it('5. Strictly rejects a 3rd participant attempt when room is full', async () => {
    const createRes = await post('/create', { hostName: 'HostC' });
    const { roomId, inviteSecret } = createRes.body;

    // Guest joins (seat #2 claimed)
    const guestRes = await post('/join', {
      roomId,
      inviteSecret,
      guestName: 'Elena',
    });
    assert.equal(guestRes.status, 200);

    // 3rd user attempts to join
    const thirdRes = await post('/join', {
      roomId,
      inviteSecret,
      guestName: 'ThirdParty',
    });

    assert.equal(thirdRes.status, 403, '3rd participant attempt must return 403 Forbidden');
    assert.match(thirdRes.body.error, /full|2 participants/i);
  });

  it('6. Prevents simultaneous join race conditions (concurrency check)', async () => {
    const createRes = await post('/create', { hostName: 'HostD' });
    const { roomId, inviteSecret } = createRes.body;

    // Send 10 concurrent requests at the exact same millisecond to claim the 1 guest seat
    const attempts = Array.from({ length: 10 }, (_, i) =>
      post('/join', {
        roomId,
        inviteSecret,
        guestName: `ConcurrentGuest_${i}`,
      })
    );

    const results = await Promise.all(attempts);

    const successes = results.filter((r) => r.status === 200);
    const forbidden = results.filter((r) => r.status === 403);

    assert.equal(successes.length, 1, 'Exactly one concurrent request must win the seat');
    assert.equal(forbidden.length, 9, 'All other 9 concurrent attempts must be rejected with 403');
  });

  it('7. Rejects join attempts if the host revokes the invitation', async () => {
    const createRes = await post('/create', { hostName: 'HostE' });
    const { roomId, hostSecret, inviteSecret } = createRes.body;

    // Host revokes the invitation
    const revokeRes = await post('/revoke-invite', {
      roomId,
      hostSecret,
    });
    assert.equal(revokeRes.status, 200);
    assert.equal(revokeRes.body.success, true);

    // Guest tries to join using revoked secret
    const joinRes = await post('/join', {
      roomId,
      inviteSecret,
      guestName: 'Elena',
    });

    assert.equal(joinRes.status, 403, 'Revoked invitation must return 403 Forbidden');
    assert.match(joinRes.body.error, /revoked/i);
  });

  it('8. Allows joining after host regenerates a fresh invitation', async () => {
    const createRes = await post('/create', { hostName: 'HostF' });
    const { roomId, hostSecret, inviteSecret } = createRes.body;

    // Revoke old invite
    await post('/revoke-invite', { roomId, hostSecret });

    // Host generates new invite
    const regenRes = await post('/regenerate-invite', {
      roomId,
      hostSecret,
    });
    assert.equal(regenRes.status, 200);
    const newInviteSecret = regenRes.body.newInviteSecret;
    assert.ok(newInviteSecret);
    assert.notEqual(newInviteSecret, inviteSecret, 'New invite secret must be fresh');

    // Guest joins using new secret
    const joinRes = await post('/join', {
      roomId,
      inviteSecret: newInviteSecret,
      guestName: 'Elena',
    });
    assert.equal(joinRes.status, 200);
    assert.equal(joinRes.body.participant.name, 'Elena');
  });

  it('9. Rejects join attempts on expired rooms', async () => {
    const createRes = await post('/create', { hostName: 'HostG' });
    const { roomId, inviteSecret } = createRes.body;

    // Simulate expiration
    roomManager._forceExpireRoom(roomId);

    const joinRes = await post('/join', {
      roomId,
      inviteSecret,
      guestName: 'Elena',
    });

    assert.equal(joinRes.status, 410, 'Expired room must return 410 Gone');
    assert.match(joinRes.body.error, /expired/i);
  });

  it('10. Prevents non-hosts from performing administrative actions', async () => {
    const createRes = await post('/create', { hostName: 'HostH' });
    const { roomId, inviteSecret } = createRes.body;

    // Attacker tries to revoke using the guest inviteSecret instead of hostSecret
    const maliciousRevoke = await post('/revoke-invite', {
      roomId,
      hostSecret: inviteSecret, // wrong secret
    });

    assert.equal(maliciousRevoke.status, 403, 'Unauthorized administrative action must return 403 Forbidden');
    assert.match(maliciousRevoke.body.error, /administrative/i);
  });
});
