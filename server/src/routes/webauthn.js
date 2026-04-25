const router = require('express').Router();
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require('@simplewebauthn/server');
const WebAuthnCredential = require('../models/WebAuthnCredential');
const { auth } = require('../middleware/auth');

const RP_NAME = 'KronosPortal';
const RP_ID = process.env.RP_ID || 'localhost';
const ORIGIN = process.env.RP_ORIGIN || `http://localhost:5173`;

// Temporary in-memory challenge store (per user, short-lived)
const challenges = new Map();

// ── Registration ───────────────────────────────────────────────────────────

// GET /webauthn/register-options — generate registration options
router.get('/register-options', auth, async (req, res) => {
  try {
    const existing = await WebAuthnCredential.find({ user: req.user._id });
    const excludeCredentials = existing.map((c) => ({
      id: c.credentialID,
      type: 'public-key',
      transports: c.transports,
    }));

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userID: req.user._id.toString(),
      userName: req.user.email,
      userDisplayName: req.user.name,
      attestation: 'none',
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
      excludeCredentials,
    });

    challenges.set(req.user._id.toString(), { challenge: options.challenge, expires: Date.now() + 120000 });

    res.json(options);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /webauthn/register — verify and save credential
router.post('/register', auth, async (req, res) => {
  try {
    const entry = challenges.get(req.user._id.toString());
    if (!entry || Date.now() > entry.expires) {
      return res.status(400).json({ message: 'Challenge expired. Please try again.' });
    }
    challenges.delete(req.user._id.toString());

    const verification = await verifyRegistrationResponse({
      response: req.body,
      expectedChallenge: entry.challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      requireUserVerification: false,
    });

    if (!verification.verified) {
      return res.status(400).json({ message: 'Registration verification failed.' });
    }

    const { credentialID, credentialPublicKey, counter, credentialDeviceType, credentialBackedUp } =
      verification.registrationInfo;

    await WebAuthnCredential.create({
      user: req.user._id,
      credentialID: Buffer.from(credentialID).toString('base64url'),
      credentialPublicKey: Buffer.from(credentialPublicKey).toString('base64url'),
      counter,
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      transports: req.body.response?.transports ?? [],
    });

    res.json({ verified: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Authentication ─────────────────────────────────────────────────────────

// GET /webauthn/auth-options — generate authentication options
router.get('/auth-options', auth, async (req, res) => {
  try {
    const credentials = await WebAuthnCredential.find({ user: req.user._id });
    const allowCredentials = credentials.map((c) => ({
      id: c.credentialID,
      type: 'public-key',
      transports: c.transports,
    }));

    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      allowCredentials,
      userVerification: 'preferred',
    });

    challenges.set(req.user._id.toString(), { challenge: options.challenge, expires: Date.now() + 120000 });

    res.json(options);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /webauthn/verify — verify authentication assertion
router.post('/verify', auth, async (req, res) => {
  try {
    const entry = challenges.get(req.user._id.toString());
    if (!entry || Date.now() > entry.expires) {
      return res.status(400).json({ message: 'Challenge expired. Please try again.' });
    }
    challenges.delete(req.user._id.toString());

    const credentialID = req.body.id;
    const cred = await WebAuthnCredential.findOne({
      user: req.user._id,
      credentialID,
    });
    if (!cred) return res.status(400).json({ message: 'Credential not found.' });

    const verification = await verifyAuthenticationResponse({
      response: req.body,
      expectedChallenge: entry.challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      authenticator: {
        credentialID: Buffer.from(cred.credentialID, 'base64url'),
        credentialPublicKey: Buffer.from(cred.credentialPublicKey, 'base64url'),
        counter: cred.counter,
        transports: cred.transports,
      },
      requireUserVerification: false,
    });

    if (!verification.verified) {
      return res.status(400).json({ message: 'Authentication verification failed.' });
    }

    await WebAuthnCredential.findByIdAndUpdate(cred._id, {
      counter: verification.authenticationInfo.newCounter,
    });

    res.json({ verified: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /webauthn/credentials — list registered passkeys for current user
router.get('/credentials', auth, async (req, res) => {
  try {
    const creds = await WebAuthnCredential.find({ user: req.user._id }).select('credentialID deviceType backedUp createdAt transports');
    res.json(creds);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /webauthn/credentials/:id — remove a passkey
router.delete('/credentials/:id', auth, async (req, res) => {
  try {
    await WebAuthnCredential.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    res.json({ message: 'Credential removed.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
