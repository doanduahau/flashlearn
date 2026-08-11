// The SDK counts the initial request as an attempt. Keeping this at one means
// one logical generation/classification request makes at most one provider call.
export const GEMINI_RETRY_ATTEMPTS = 1;
