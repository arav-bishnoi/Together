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

describe('Phase 5: Connection Reliability & Network Recovery Test Suite', () => {
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

  it('1. Returns ICE servers (STUN/TURN) in room creation and join responses', async () => {
    const createRes = await post('/create', { hostName: 'HostReliability' });
    assert.equal(createRes.status, 201);
    assert.ok(Array.isArray(createRes.body.iceServers), 'iceServers array must be provided');
    assert.ok(createRes.body.iceServers.length > 0, 'At least 1 default STUN server should be present');

    const joinRes = await post('/join', {
      roomId: createRes.body.roomId,
      inviteSecret: createRes.body.inviteSecret,
      guestName: 'GuestReliability',
    });
    assert.equal(joinRes.status, 200);
    assert.ok(Array.isArray(joinRes.body.iceServers), 'iceServers array must be provided in join response');
  });

  it('2. Successfully reconnects an authorized host using hostSecret after network disruption', async () => {
    const createRes = await post('/create', { hostName: 'HostReconnect' });
    const { roomId, hostSecret } = createRes.body;

    const reconnectRes = await post('/reconnect', {
      roomId,
      role: 'host',
      secret: hostSecret,
    });

    assert.equal(reconnectRes.status, 200, 'Host reconnection should succeed');
    assert.equal(reconnectRes.body.success, true);
    assert.ok(reconnectRes.body.token, 'A fresh LiveKit JWT token must be generated');
    assert.equal(reconnectRes.body.participant.role, 'host');
    assert.equal(reconnectRes.body.participant.name, 'HostReconnect');
  });

  it('3. Rejects host reconnection if an incorrect or forged hostSecret is provided', async () => {
    const createRes = await post('/create', { hostName: 'HostStrict' });
    const { roomId } = createRes.body;

    const reconnectRes = await post('/reconnect', {
      roomId,
      role: 'host',
      secret: 'wrong_forged_secret_123',
    });

    assert.equal(reconnectRes.status, 401, 'Forged host secret must be rejected with 401 Unauthorized');
    assert.match(reconnectRes.body.error, /invalid/i);
  });

  it('4. Successfully reconnects an authorized guest using inviteSecret and participantId', async () => {
    const createRes = await post('/create', { hostName: 'HostGuestTest' });
    const { roomId, inviteSecret } = createRes.body;

    const joinRes = await post('/join', {
      roomId,
      inviteSecret,
      guestName: 'Priya',
    });
    assert.equal(joinRes.status, 200);
    const guestId = joinRes.body.participant.id;

    // Simulate guest reconnecting after brief network drop
    const reconnectRes = await post('/reconnect', {
      roomId,
      role: 'guest',
      secret: inviteSecret,
      participantId: guestId,
      displayName: 'Priya',
    });

    assert.equal(reconnectRes.status, 200, 'Guest reconnection should succeed');
    assert.equal(reconnectRes.body.success, true);
    assert.ok(reconnectRes.body.token, 'A fresh token should be issued for rejoining guest');
    assert.equal(reconnectRes.body.participant.id, guestId);
  });

  it('5. Rejects guest reconnection if invitation has been revoked by host', async () => {
    const createRes = await post('/create', { hostName: 'HostRevoke' });
    const { roomId, hostSecret, inviteSecret } = createRes.body;

    const joinRes = await post('/join', {
      roomId,
      inviteSecret,
      guestName: 'Priya',
    });
    const guestId = joinRes.body.participant.id;

    // Host revokes invitation
    await post('/revoke-invite', { roomId, hostSecret });

    // Guest attempts reconnection
    const reconnectRes = await post('/reconnect', {
      roomId,
      role: 'guest',
      secret: inviteSecret,
      participantId: guestId,
    });

    assert.equal(reconnectRes.status, 403, 'Reconnection on revoked invite must be rejected with 403 Forbidden');
    assert.match(reconnectRes.body.error, /revoked/i);
  });

  it('6. Rejects reconnection on expired rooms', async () => {
    const createRes = await post('/create', { hostName: 'HostExpired' });
    const { roomId, hostSecret } = createRes.body;

    // Force expire room
    roomManager._forceExpireRoom(roomId);

    const reconnectRes = await post('/reconnect', {
      roomId,
      role: 'host',
      secret: hostSecret,
    });

    assert.equal(reconnectRes.status, 401, 'Reconnection on expired room must be rejected');
    assert.match(reconnectRes.body.error, /expired/i);
  });

  it('7. Reconnection never exceeds the 2-participant room boundary', async () => {
    const createRes = await post('/create', { hostName: 'HostBoundary' });
    const { roomId, inviteSecret } = createRes.body;

    // Guest 1 joins
    const guest1 = await post('/join', {
      roomId,
      inviteSecret,
      guestName: 'Guest1',
    });
    assert.equal(guest1.status, 200);

    // Attacker attempts to join or reconnect with arbitrary participantId
    const intruder = await post('/reconnect', {
      roomId,
      role: 'guest',
      secret: inviteSecret,
      participantId: 'intruder-id-999',
    });

    assert.equal(intruder.status, 403, 'Intruder must be rejected with 403 when room is full');
  });
});
