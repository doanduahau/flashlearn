import { describe, expect, it } from "vitest";

import { urlBase64ToUint8Array } from "@/features/notifications/utils/vapid";

describe("urlBase64ToUint8Array", () => {
  it("converts a valid base64url VAPID public key string to Uint8Array", () => {
    const vapidKey =
      "BBjAvYx8Ur4nE26SIcMLTlIcbO2QBQFp5Bs-QXPoKH8NYRJUZSl0bualUDrosubTuhFAVVDCaMBT_6G5yxcHcdQ";
    const result = urlBase64ToUint8Array(vapidKey);

    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBe(65); // Uncompressed EC Public Key length is 65 bytes
    expect(result[0]).toBe(4); // 0x04 uncompressed point format prefix
  });

  it("handles base64url padding with hyphen and underscore", () => {
    const base64UrlString = "ab-_";
    const result = urlBase64ToUint8Array(base64UrlString);

    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBe(3);
  });
});
