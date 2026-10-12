import dgram from 'node:dgram';
import dns from 'node:dns/promises';
import crypto from 'node:crypto';
import { config } from '../src/config.js';

interface StunTestResult {
  url: string;
  host: string;
  port: number;
  resolvedIp?: string;
  success: boolean;
  rttMs?: number;
  publicMappedAddress?: string;
  error?: string;
}

/**
 * Builds an RFC 5389 STUN Binding Request packet (20 bytes)
 */
function createStunBindingRequest(): { packet: Buffer; transactionId: Buffer } {
  const packet = Buffer.alloc(20);
  // Message Type: 0x0001 (Binding Request)
  packet.writeUInt16BE(0x0001, 0);
  // Message Length: 0 (No payload attributes required for basic binding)
  packet.writeUInt16BE(0x0000, 2);
  // Magic Cookie: 0x2112A442
  packet.writeUInt32BE(0x2112a442, 4);
  // Transaction ID: 12 cryptographically random bytes
  const transactionId = crypto.randomBytes(12);
  transactionId.copy(packet, 8);
  return { packet, transactionId };
}

/**
 * Parses STUN Binding Response and extracts XOR-MAPPED-ADDRESS
 */
function parseStunResponse(
  msg: Buffer,
  expectedTxId: Buffer
): { success: boolean; mappedAddress?: string } {
  if (msg.length < 20) return { success: false };

  const messageType = msg.readUInt16BE(0);
  const magicCookie = msg.readUInt32BE(4);
  const txId = msg.subarray(8, 20);

  // Check Binding Success (0x0101) and transaction match
  if (messageType !== 0x0101) return { success: false };
  if (magicCookie !== 0x2112a442) return { success: false };
  if (!txId.equals(expectedTxId)) return { success: false };

  // Parse STUN attributes looking for XOR-MAPPED-ADDRESS (0x0020) or MAPPED-ADDRESS (0x0001)
  let offset = 20;
  let mappedAddress: string | undefined;

  while (offset + 4 <= msg.length) {
    const attrType = msg.readUInt16BE(offset);
    const attrLen = msg.readUInt16BE(offset + 2);
    offset += 4;

    if (offset + attrLen > msg.length) break;

    if (attrType === 0x0020 && attrLen >= 8) {
      // XOR-MAPPED-ADDRESS (IPv4)
      const family = msg.readUInt8(offset + 1);
      if (family === 0x01) {
        const xPort = msg.readUInt16BE(offset + 2) ^ 0x2112;
        const xIp = msg.readUInt32BE(offset + 4) ^ 0x2112a442;
        const ipStr = [
          (xIp >>> 24) & 255,
          (xIp >>> 16) & 255,
          (xIp >>> 8) & 255,
          xIp & 255,
        ].join('.');
        mappedAddress = `${ipStr}:${xPort}`;
      }
    }
    offset += attrLen + ((4 - (attrLen % 4)) % 4); // 4-byte alignment padding
  }

  return { success: true, mappedAddress };
}

/**
 * Probes a STUN or TURN UDP endpoint
 */
async function testUdpEndpoint(urlStr: string, timeoutMs = 3500): Promise<StunTestResult> {
  const cleanUrl = urlStr.replace(/^turn:|^stun:/i, '').split('?')[0];
  const [host, portStr] = cleanUrl.split(':');
  const port = parseInt(portStr || '3478', 10);

  const result: StunTestResult = {
    url: urlStr,
    host,
    port,
    success: false,
  };

  try {
    const lookup = await dns.lookup(host, { family: 4 });
    result.resolvedIp = lookup.address;
  } catch (err: any) {
    result.error = `DNS resolution failed: ${err.message}`;
    return result;
  }

  return new Promise((resolve) => {
    const socket = dgram.createSocket('udp4');
    const { packet, transactionId } = createStunBindingRequest();
    const startTime = Date.now();

    const timer = setTimeout(() => {
      try {
        socket.close();
      } catch {}
      result.error = `Request timed out after ${timeoutMs}ms (server unreachable or UDP port blocked by firewall).`;
      resolve(result);
    }, timeoutMs);

    socket.on('message', (msg) => {
      const parsed = parseStunResponse(msg, transactionId);
      if (parsed.success) {
        clearTimeout(timer);
        result.success = true;
        result.rttMs = Date.now() - startTime;
        result.publicMappedAddress = parsed.mappedAddress;
        try {
          socket.close();
        } catch {}
        resolve(result);
      }
    });

    socket.on('error', (err) => {
      clearTimeout(timer);
      try {
        socket.close();
      } catch {}
      result.error = `Socket error: ${err.message}`;
      resolve(result);
    });

    socket.send(packet, port, result.resolvedIp, (err) => {
      if (err) {
        clearTimeout(timer);
        try {
          socket.close();
        } catch {}
        result.error = `Send error: ${err.message}`;
        resolve(result);
      }
    });
  });
}

/**
 * Main execution runner
 */
async function run() {
  console.log('\n======================================================');
  console.log('📡 Our Watch Party: STUN & TURN Connectivity Tester');
  console.log('======================================================\n');

  console.log(`Configured ICE Servers in Server Config: ${config.iceServers.length}\n`);

  for (const server of config.iceServers) {
    const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
    for (const url of urls) {
      process.stdout.write(`Testing: ${url} ... `);
      const res = await testUdpEndpoint(url);

      if (res.success) {
        console.log(`✅ REACHABLE!`);
        console.log(`   ├─ Host IP:    ${res.resolvedIp}:${res.port}`);
        console.log(`   ├─ Latency:    ${res.rttMs} ms`);
        if (res.publicMappedAddress) {
          console.log(`   └─ Public IP:  ${res.publicMappedAddress} (Discovered NAT mapping)`);
        }
      } else {
        console.log(`❌ FAILED`);
        console.log(`   └─ Error:      ${res.error}`);
      }
      console.log('');
    }
  }

  console.log('------------------------------------------------------');
  if (process.env.TURN_URL) {
    console.log('ℹ️ Custom TURN Server is configured in .env');
  } else {
    console.log('ℹ️ Note: No custom TURN_URL configured. Using Google STUN fallbacks.');
    console.log('   In production across mobile cellular carrier (4G/5G) connections,');
    console.log('   configure TURN_URL in server/.env to guarantee relay traversal.');
  }
  console.log('======================================================\n');
}

run().catch(console.error);
