import type { AxiosInstance } from 'axios';

type ResultEncryptionSessionResponse = {
  version: 1;
  algorithm: string;
  keyId: string;
  recipientId: string;
  serverPublicKey: JsonWebKey;
  salt: string;
  expiresAt: string;
};

export type EncryptedResultEnvelope = {
  encrypted: true;
  algorithm: 'AES-256-GCM';
  context: {
    version: 1;
    keyId: string;
    userId: string;
    orderId: string;
    clientNonce: string;
    issuedAt: string;
    expiresAt: string;
  };
  iv: string;
  ciphertext: string;
};

type LocalSession = {
  keyId: string;
  key: CryptoKey;
  expiresAt: number;
};

const HKDF_INFO_PREFIX = 'random-box/result-envelope/v1';
const CLOCK_SKEW_MS = 30_000;
let session: LocalSession | null = null;
let sessionPromise: Promise<LocalSession> | null = null;

const decodeBase64Url = (value: string) => {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = window.atob(base64);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
};

const serializeContext = (context: EncryptedResultEnvelope['context']) => JSON.stringify({
  version: context.version,
  keyId: context.keyId,
  userId: context.userId,
  orderId: context.orderId,
  clientNonce: context.clientNonce,
  issuedAt: context.issuedAt,
  expiresAt: context.expiresAt,
});

const createSession = async (api: AxiosInstance): Promise<LocalSession> => {
  if (!window.isSecureContext || !window.crypto?.subtle) {
    throw new Error('당첨 결과 보호를 위해 HTTPS 보안 연결이 필요합니다.');
  }
  const clientKeyPair = await window.crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits'],
  );
  const clientPublicKey = await window.crypto.subtle.exportKey('jwk', clientKeyPair.publicKey);
  const { data } = await api.post<ResultEncryptionSessionResponse>(
    '/orders/result-security/session',
    { clientPublicKey },
  );
  const serverPublicKey = await window.crypto.subtle.importKey(
    'jwk',
    data.serverPublicKey,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );
  const sharedBits = await window.crypto.subtle.deriveBits(
    { name: 'ECDH', public: serverPublicKey },
    clientKeyPair.privateKey,
    256,
  );
  const hkdfKey = await window.crypto.subtle.importKey('raw', sharedBits, 'HKDF', false, ['deriveKey']);
  const key = await window.crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: decodeBase64Url(data.salt),
      info: new TextEncoder().encode(`${HKDF_INFO_PREFIX}:${data.keyId}:${data.recipientId}`),
    },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );
  return { keyId: data.keyId, key, expiresAt: Date.parse(data.expiresAt) };
};

export const getResultEncryptionSession = async (api: AxiosInstance) => {
  if (session && session.expiresAt > Date.now() + CLOCK_SKEW_MS) return session;
  session = null;
  sessionPromise ??= createSession(api)
    .then(created => {
      session = created;
      return created;
    })
    .finally(() => { sessionPromise = null; });
  return sessionPromise;
};

export const clearResultEncryptionSession = () => {
  session = null;
  sessionPromise = null;
};

export const decryptResultEnvelope = async <T>(
  envelope: EncryptedResultEnvelope,
  localSession: LocalSession,
  expected: { orderId: string; clientNonce: string },
): Promise<T> => {
  if (!envelope.encrypted || envelope.algorithm !== 'AES-256-GCM'
    || envelope.context.keyId !== localSession.keyId
    || envelope.context.orderId !== String(expected.orderId)
    || envelope.context.clientNonce !== expected.clientNonce) {
    throw new Error('당첨 결과의 보안 정보를 확인할 수 없습니다.');
  }
  if (Date.parse(envelope.context.expiresAt) <= Date.now() - CLOCK_SKEW_MS) {
    throw new Error('당첨 결과의 보안 유효시간이 만료되었습니다.');
  }
  const plaintext = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: decodeBase64Url(envelope.iv),
      additionalData: new TextEncoder().encode(serializeContext(envelope.context)),
      tagLength: 128,
    },
    localSession.key,
    decodeBase64Url(envelope.ciphertext),
  );
  return JSON.parse(new TextDecoder().decode(plaintext)) as T;
};
