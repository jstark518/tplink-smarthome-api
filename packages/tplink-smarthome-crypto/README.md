# @jstark/tplink-smarthome-crypto

[![NPM Version](https://img.shields.io/npm/v/@jstark/tplink-smarthome-crypto.svg)](https://www.npmjs.com/package/@jstark/tplink-smarthome-crypto)
[![Build Status](https://github.com/jstark518/tplink-smarthome-api/workflows/CI/badge.svg?branch=main)](https://github.com/jstark518/tplink-smarthome-api/actions?query=workflow%3ACI+branch%3Amain)

Encryption/decryption for TP-Link Smart Home device communication — a maintained, dependency-free fork of [plasticrake/tplink-smarthome-crypto](https://github.com/plasticrake/tplink-smarthome-crypto). Requires Node.js 22+.

TP-Link devices use a simple XOR "autokey" cipher. TCP messages are prefixed with a 4-byte big-endian length header; UDP messages are not.

## Install

```sh
npm install @jstark/tplink-smarthome-crypto
```

## Usage

```javascript
const {
  encrypt,
  decrypt,
  encryptWithHeader,
  decryptWithHeader,
} = require('@jstark/tplink-smarthome-crypto');

const payload = '{"system":{"get_sysinfo":{}}}';

// UDP (no length header)
const udp = encrypt(payload);
decrypt(udp).toString(); // -> original payload

// TCP (4-byte length header)
const tcp = encryptWithHeader(payload);
decryptWithHeader(tcp).toString(); // -> original payload
```

## API

All functions accept a `Buffer` or `string` and return a `Buffer`.

- `encrypt(input, firstKey = 0xab)` — encrypt without a length header (UDP).
- `decrypt(input, firstKey = 0xab)` — decrypt data without a length header (UDP).
- `encryptWithHeader(input, firstKey = 0xab)` — encrypt and prepend a 4-byte length header (TCP).
- `decryptWithHeader(input, firstKey = 0xab)` — strip the 4-byte header and decrypt (TCP).

## Supported Devices

Smart plugs/switches (HS100, HS200, HSxxx, KPxxx) and smart bulbs (LB100, LB200, LBxxx, KLxxx). Note that Tapo devices are not supported.

## Related Projects

- [@jstark/tplink-smarthome-api](https://github.com/jstark518/tplink-smarthome-api) — the smart home API that uses this library (same monorepo)
- [TP-Link Smarthome Device Simulator](https://github.com/plasticrake/tplink-smarthome-simulator) — useful for automated testing
- [TP-Link Smarthome Homebridge Plugin](https://github.com/plasticrake/homebridge-tplink-smarthome)

## Credits

Forked from [plasticrake/tplink-smarthome-crypto](https://github.com/plasticrake/tplink-smarthome-crypto) (MIT). Thanks to George Georgovassilis and Thomas Baust for [figuring out the HS1XX encryption](https://blog.georgovassilis.com/2016/05/07/controlling-the-tp-link-hs100-wi-fi-smart-plug/).
