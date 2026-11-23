// Single-process entrypoint: API + BullMQ worker together.
// Used by hosts without a separate worker service (e.g. Render free tier).
import "./index";
import "./worker";
