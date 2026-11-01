/**
 * The admin payloads this portal reads, as JSDoc types, so `npm run typecheck`
 * (`tsc -p jsconfig.json`, checkJs) catches a screen reading a field the admin
 * does not send.
 *
 * Each type names where the admin defines it. Where the admin passes the
 * clinical provider's answer through (health record, labs, messages), the
 * type lists only the fields the portal reads, not the whole payload. When a
 * Resource or response on the admin changes, change it here in the same
 * release: this file is the portal's half of that contract. (Generating these
 * from the admin's OpenAPI, whose patient routes are tagged `Patient Portal`,
 * would remove the hand copy; not done yet.)
 *
 * Types only: nothing here runs, so any file may import it with
 * `import('@/lib/models').Name`.
 */

// ── Envelopes ────────────────────────────────────────────────────────────────

/**
 * adminFetch()'s answer (lib/adminApi.js), server side. `status: 0` is "no
 * answer" (refused, reset, timed out): never an HTTP status.
 *
 * @template [T=any]
 * @typedef {object} AdminResult
 * @property {boolean} ok
 * @property {number} status
 * @property {T | null} data the admin's `data`, unwrapped
 * @property {PageMeta | null} meta
 * @property {string | null} message
 * @property {Record<string, string[]> | null} errors field-keyed, on a 422
 * @property {AdminCode | string | null} code
 * @property {string | null} requestId the admin's correlation id ("Reference")
 * @property {number | null} retryAfter seconds, on a 429
 */

/**
 * portalCall()/apiCall()'s answer (lib/portalClient.js), in the browser: the
 * same fields, plus the raw body for a field outside the envelope.
 *
 * @template [T=any]
 * @typedef {AdminResult<T> & { payload: any }} CallResult
 */

/**
 * The machine-readable codes the admin (and this app's routes) send with a
 * refusal or an unclear answer.
 *
 * @typedef {'two_factor_setup_required' | 'no_linked_chart' | 'module_off' | 'upstream_unreachable'
 *   | 'cross_origin' | 'misconfigured' | 'too_large' | 'unsupported_media_type' | ApprovalOutcomeCode} AdminCode
 */

/**
 * The admin's `meta`: Laravel's page meta on a paginated list
 * (`messages?page=`), and the sign-in history's retention.
 *
 * @typedef {object} PageMeta
 * @property {number} [current_page]
 * @property {number} [last_page]
 * @property {number} [per_page]
 * @property {number} [total]
 * @property {number} [retention_days] `GET /patient/security/events`
 */

// ── Account ──────────────────────────────────────────────────────────────────

/**
 * The signed-in patient. Admin: `App\Data\Patient\PatientResource`.
 *
 * @typedef {object} Patient
 * @property {string} uuid
 * @property {string} email
 * @property {string} first_name
 * @property {string} last_name
 * @property {string | null} phone
 * @property {string | null} date_of_birth `YYYY-MM-DD`
 * @property {boolean} has_prx_chart a medical record is linked
 * @property {boolean} email_verified
 * @property {boolean} prx_chart_collision_flagged
 * @property {string} created_at ISO 8601
 * @property {{ enabled: boolean, setup_required: boolean }} two_factor
 */

/**
 * The session's deadlines. Admin: `SecurityController::session()`
 * (`GET /patient/session`); `now` is added by this app's `GET /api/session`
 * from its own clock (lib/sessionClock.js).
 *
 * @typedef {object} SessionDeadlines
 * @property {number} [idle_minutes]
 * @property {string} idle_expires_at ISO 8601
 * @property {string} expires_at ISO 8601, the absolute cap
 * @property {string} [now] ISO 8601, this server's clock
 */

// ── Approvals ────────────────────────────────────────────────────────────────

/**
 * One item a provider added for the patient to accept (a charge) or decline.
 * Admin: the approvals list in `PortalController`, from the provider.
 *
 * @typedef {object} Approval
 * @property {string} approval_id
 * @property {string} product_name
 * @property {number} [quantity]
 * @property {number} amount_due what accepting charges, confirmed back as `acknowledged_total`
 * @property {string} [currency]
 * @property {number} [total_price]
 * @property {number} [shipping]
 * @property {string | null} [review_expires_at] ISO 8601
 */

/**
 * `App\Enums\Patient\PatientApprovalOutcome` on the admin.
 *
 * @typedef {'charged' | 'declined' | 'payment_required' | 'gateway_declined' | 'already_resolved'
 *   | 'price_mismatch' | 'uncertain' | 'error'} ApprovalOutcomeCode
 */

/**
 * The answer to accept/decline. Admin: `App\Data\Patient\ApprovalDecisionResult::toArray()`.
 *
 * @typedef {object} ApprovalDecisionResult
 * @property {string} approval_id
 * @property {ApprovalOutcomeCode} outcome
 * @property {number | null} amount
 * @property {string} message the admin's sentence for the outcome
 * @property {boolean} retryable
 */

// ── Record ───────────────────────────────────────────────────────────────────

/**
 * One medication, allergy or condition. Admin: `HealthRecordController`, the
 * provider's entry filtered to the fields a patient may see; the fields a
 * patient may set are `HealthRecordKind::rules()`.
 *
 * @typedef {object} HealthRecordEntry
 * @property {string} id
 * @property {string} [medication_name] medications
 * @property {string | null} [dosage] medications
 * @property {string | null} [frequency] medications
 * @property {string} [allergy_name] allergies
 * @property {string | null} [allergy_reaction] allergies
 * @property {string | null} [allergy_severity] allergies
 * @property {string} [condition_name] conditions
 * @property {string | null} [condition_notes] conditions
 */

/**
 * A requested copy of the record. Admin: `ExportController`, from the provider.
 *
 * @typedef {object} RecordExport
 * @property {string} export_id
 * @property {'queued' | 'processing' | 'ready' | 'failed' | 'expired' | string} status
 * @property {boolean} [ready]
 * @property {string | null} [expires_at] ISO 8601, when the download link stops working
 */

// ── Labs ─────────────────────────────────────────────────────────────────────

/**
 * One lab order. Admin: `LabController`, from the provider.
 *
 * @typedef {object} LabOrder
 * @property {string} id
 * @property {string} [number]
 * @property {string} [panel]
 * @property {string} [stage_label]
 * @property {boolean} [released]
 * @property {boolean} [reviewed]
 * @property {boolean} [critical]
 * @property {boolean} [flagged]
 * @property {string | null} [ordered_at]
 * @property {string | null} [results_at]
 */

/**
 * One result value on a lab order.
 *
 * @typedef {object} LabResult
 * @property {string} name
 * @property {string | number | null} [value]
 * @property {string | null} [unit]
 * @property {number | null} [ref_low]
 * @property {number | null} [ref_high]
 * @property {string | null} [ref_text]
 * @property {string | null} [severity]
 * @property {string | null} [direction]
 * @property {string[]} [notes]
 */

// ── Messaging ────────────────────────────────────────────────────────────────

/**
 * Admin: `PortalController` conversations list, from the provider.
 *
 * @typedef {object} Conversation
 * @property {string} id
 * @property {string | null} [subject]
 * @property {number} [unread_count]
 */

/**
 * @typedef {object} Message
 * @property {string} id
 * @property {string} content
 * @property {string} created_at ISO 8601
 * @property {boolean} [is_mine]
 * @property {string | null} [sender_name]
 */

/**
 * The polled page of newer messages (`?after=<cursor>`).
 *
 * @typedef {object} MessagesSince
 * @property {Message[]} messages
 * @property {string | null} latest_cursor null when nothing arrived
 * @property {boolean} has_more
 */

export {};
