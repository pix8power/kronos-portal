import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import { webAuthnAPI } from '../services/api';

export function useWebAuthn() {
  const isSupported = typeof window !== 'undefined' && !!window.PublicKeyCredential;

  async function registerPasskey() {
    const { data: options } = await webAuthnAPI.getRegisterOptions();
    const response = await startRegistration(options);
    await webAuthnAPI.register(response);
  }

  async function authenticatePasskey() {
    const { data: options } = await webAuthnAPI.getAuthOptions();
    const response = await startAuthentication(options);
    await webAuthnAPI.verify(response);
  }

  return { isSupported, registerPasskey, authenticatePasskey };
}
