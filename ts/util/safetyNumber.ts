// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { PublicKey, Fingerprint } from '@signalapp/libsignal-client';
import type { ConversationType } from '../state/ducks/conversations';
import { UUID, UUIDKind } from '../types/UUID';

import { assertDev } from './assert';
import { isNotNil } from './isNotNil';
import { missingCaseError } from './missingCaseError';
import { uuidToBytes } from './uuidToBytes';
import * as log from '../logging/log';
import * as Bytes from '../Bytes';
import type { SafetyNumberType } from '../types/safetyNumber';
import {
  SafetyNumberIdentifierType,
  SafetyNumberMode,
} from '../types/safetyNumber';

const ITERATION_COUNT = 5200;
const E164_VERSION = 1;
const UUID_VERSION = 2;

// Number of digits in a safety number block
const BLOCK_SIZE = 5;

export async function generateSafetyNumbers(
  contact: ConversationType,
  mode: SafetyNumberMode
): Promise<ReadonlyArray<SafetyNumberType>> {
  const logId = `generateSafetyNumbers(${contact.id}, ${mode})`;
  log.info(`${logId}: starting`);

  const { storage } = window.textsecure;
  const ourNumber = storage.user.getNumber();
  const ourAci = storage.user.getCheckedUuid(UUIDKind.ACI);

  const us = storage.protocol.getIdentityRecord(ourAci);
  const ourKeyBuffer = us ? us.publicKey : null;

  const theirAci = contact.pni !== contact.uuid ? contact.uuid : undefined;
  const them = theirAci
    ? await storage.protocol.getOrMigrateIdentityRecord(new UUID(theirAci))
    : undefined;
  const theirKeyBuffer = them?.publicKey;

  if (!ourKeyBuffer) {
    throw new Error('Could not load our key');
  }

  if (!theirKeyBuffer) {
    throw new Error('Could not load their key');
  }

  const ourKey = PublicKey.deserialize(Buffer.from(ourKeyBuffer));
  const theirKey = PublicKey.deserialize(Buffer.from(theirKeyBuffer));

  let identifierTypes: ReadonlyArray<SafetyNumberIdentifierType>;
  if (mode === SafetyNumberMode.ACIAndE164) {
    // Important: order matters, legacy safety number should be displayed first.
    identifierTypes = [
      SafetyNumberIdentifierType.E164Identifier,
      SafetyNumberIdentifierType.ACIIdentifier,
    ];
    // Controlled by 'desktop.safetyNumberAci'
  } else if (mode === SafetyNumberMode.E164) {
    identifierTypes = [SafetyNumberIdentifierType.E164Identifier];
  } else {
    assertDev(mode === SafetyNumberMode.ACI, 'Invalid security number mode');
    identifierTypes = [SafetyNumberIdentifierType.ACIIdentifier];
  }

  return identifierTypes
    .map(identifierType => {
      let fingerprint: Fingerprint;
      if (identifierType === SafetyNumberIdentifierType.E164Identifier) {
        if (!contact.e164) {
          log.error(
            `${logId}: Attempted to generate security number for contact with no e164`
          );
          return undefined;
        }

        assertDev(ourNumber, 'Should have our number');
        fingerprint = Fingerprint.new(
          ITERATION_COUNT,
          E164_VERSION,
          Buffer.from(Bytes.fromString(ourNumber)),
          ourKey,
          Buffer.from(Bytes.fromString(contact.e164)),
          theirKey
        );
      } else if (identifierType === SafetyNumberIdentifierType.ACIIdentifier) {
        assertDev(theirAci, 'Should have their uuid');
        fingerprint = Fingerprint.new(
          ITERATION_COUNT,
          UUID_VERSION,
          Buffer.from(uuidToBytes(ourAci.toString())),
          ourKey,
          Buffer.from(uuidToBytes(theirAci)),
          theirKey
        );
      } else {
        throw missingCaseError(identifierType);
      }

      const securityNumber = fingerprint.displayableFingerprint().toString();

      const numberBlocks = [];
      for (let i = 0; i < securityNumber.length; i += BLOCK_SIZE) {
        numberBlocks.push(securityNumber.substring(i, i + BLOCK_SIZE));
      }

      const qrData = fingerprint.scannableFingerprint().toBuffer();

      return { identifierType, numberBlocks, qrData };
    })
    .filter(isNotNil);
}
