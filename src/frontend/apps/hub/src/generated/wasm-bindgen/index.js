/* @ts-self-types="./index.d.ts" */

export class RustCallStatus {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        RustCallStatusFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_rustcallstatus_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    get code() {
        const ret = wasm.__wbg_get_rustcallstatus_code(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {Uint8Array | undefined}
     */
    get errorBuf() {
        const ptr = this.__destroy_into_raw();
        const ret = wasm.rustcallstatus_error_buf(ptr);
        let v1;
        if (ret[0] !== 0) {
            v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
            wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        }
        return v1;
    }
    constructor() {
        const ret = wasm.rustcallstatus_new();
        this.__wbg_ptr = ret >>> 0;
        RustCallStatusFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @param {Uint8Array | null} [bytes]
     */
    set errorBuf(bytes) {
        var ptr0 = isLikeNone(bytes) ? 0 : passArray8ToWasm0(bytes, wasm.__wbindgen_malloc);
        var len0 = WASM_VECTOR_LEN;
        wasm.rustcallstatus_set_error_buf(this.__wbg_ptr, ptr0, len0);
    }
    /**
     * @param {number} arg0
     */
    set code(arg0) {
        wasm.__wbg_set_rustcallstatus_code(this.__wbg_ptr, arg0);
    }
}
if (Symbol.dispose) RustCallStatus.prototype[Symbol.dispose] = RustCallStatus.prototype.free;

/**
 * A machine-readable representation of the authenticity for a `ShieldState`.
 * @enum {0 | 1 | 2 | 3 | 4 | 5}
 */
export const ShieldStateCode = Object.freeze({
    /**
     * Not enough information available to check the authenticity.
     */
    AuthenticityNotGuaranteed: 0, "0": "AuthenticityNotGuaranteed",
    /**
     * The sending device isn't yet known by the Client.
     */
    UnknownDevice: 1, "1": "UnknownDevice",
    /**
     * The sending device hasn't been verified by the sender.
     */
    UnsignedDevice: 2, "2": "UnsignedDevice",
    /**
     * The sender hasn't been verified by the Client's user.
     */
    UnverifiedIdentity: 3, "3": "UnverifiedIdentity",
    /**
     * The sender was previously verified but changed their identity.
     */
    VerificationViolation: 4, "4": "VerificationViolation",
    /**
     * The `sender` field on the event does not match the owner of the device
     * that established the Megolm session.
     */
    MismatchedSender: 5, "5": "MismatchedSender",
});

/**
 * @returns {number}
 */
export function ubrn_ffi_matrix_sdk_base_uniffi_contract_version() {
    const ret = wasm.ubrn_ffi_matrix_sdk_base_uniffi_contract_version();
    return ret >>> 0;
}

/**
 * @returns {number}
 */
export function ubrn_ffi_matrix_sdk_common_uniffi_contract_version() {
    const ret = wasm.ubrn_ffi_matrix_sdk_common_uniffi_contract_version();
    return ret >>> 0;
}

/**
 * @returns {number}
 */
export function ubrn_ffi_matrix_sdk_crypto_uniffi_contract_version() {
    const ret = wasm.ubrn_ffi_matrix_sdk_crypto_uniffi_contract_version();
    return ret >>> 0;
}

/**
 * @param {bigint} handle
 */
export function ubrn_ffi_matrix_sdk_ffi_rust_future_cancel_f32(handle) {
    wasm.ubrn_ffi_matrix_sdk_ffi_rust_future_cancel_f32(handle);
}

/**
 * @param {bigint} handle
 */
export function ubrn_ffi_matrix_sdk_ffi_rust_future_cancel_f64(handle) {
    wasm.ubrn_ffi_matrix_sdk_ffi_rust_future_cancel_f64(handle);
}

/**
 * @param {bigint} handle
 */
export function ubrn_ffi_matrix_sdk_ffi_rust_future_cancel_i16(handle) {
    wasm.ubrn_ffi_matrix_sdk_ffi_rust_future_cancel_i16(handle);
}

/**
 * @param {bigint} handle
 */
export function ubrn_ffi_matrix_sdk_ffi_rust_future_cancel_i32(handle) {
    wasm.ubrn_ffi_matrix_sdk_ffi_rust_future_cancel_i32(handle);
}

/**
 * @param {bigint} handle
 */
export function ubrn_ffi_matrix_sdk_ffi_rust_future_cancel_i64(handle) {
    wasm.ubrn_ffi_matrix_sdk_ffi_rust_future_cancel_i64(handle);
}

/**
 * @param {bigint} handle
 */
export function ubrn_ffi_matrix_sdk_ffi_rust_future_cancel_i8(handle) {
    wasm.ubrn_ffi_matrix_sdk_ffi_rust_future_cancel_i8(handle);
}

/**
 * @param {bigint} handle
 */
export function ubrn_ffi_matrix_sdk_ffi_rust_future_cancel_rust_buffer(handle) {
    wasm.ubrn_ffi_matrix_sdk_ffi_rust_future_cancel_rust_buffer(handle);
}

/**
 * @param {bigint} handle
 */
export function ubrn_ffi_matrix_sdk_ffi_rust_future_cancel_u16(handle) {
    wasm.ubrn_ffi_matrix_sdk_ffi_rust_future_cancel_u16(handle);
}

/**
 * @param {bigint} handle
 */
export function ubrn_ffi_matrix_sdk_ffi_rust_future_cancel_u32(handle) {
    wasm.ubrn_ffi_matrix_sdk_ffi_rust_future_cancel_u32(handle);
}

/**
 * @param {bigint} handle
 */
export function ubrn_ffi_matrix_sdk_ffi_rust_future_cancel_u64(handle) {
    wasm.ubrn_ffi_matrix_sdk_ffi_rust_future_cancel_u64(handle);
}

/**
 * @param {bigint} handle
 */
export function ubrn_ffi_matrix_sdk_ffi_rust_future_cancel_u8(handle) {
    wasm.ubrn_ffi_matrix_sdk_ffi_rust_future_cancel_u8(handle);
}

/**
 * @param {bigint} handle
 */
export function ubrn_ffi_matrix_sdk_ffi_rust_future_cancel_void(handle) {
    wasm.ubrn_ffi_matrix_sdk_ffi_rust_future_cancel_void(handle);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 * @returns {number}
 */
export function ubrn_ffi_matrix_sdk_ffi_rust_future_complete_f32(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_ffi_matrix_sdk_ffi_rust_future_complete_f32(handle, f_status_.__wbg_ptr);
    return ret;
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 * @returns {number}
 */
export function ubrn_ffi_matrix_sdk_ffi_rust_future_complete_f64(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_ffi_matrix_sdk_ffi_rust_future_complete_f64(handle, f_status_.__wbg_ptr);
    return ret;
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 * @returns {number}
 */
export function ubrn_ffi_matrix_sdk_ffi_rust_future_complete_i16(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_ffi_matrix_sdk_ffi_rust_future_complete_i16(handle, f_status_.__wbg_ptr);
    return ret;
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 * @returns {number}
 */
export function ubrn_ffi_matrix_sdk_ffi_rust_future_complete_i32(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_ffi_matrix_sdk_ffi_rust_future_complete_i32(handle, f_status_.__wbg_ptr);
    return ret;
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_ffi_matrix_sdk_ffi_rust_future_complete_i64(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_ffi_matrix_sdk_ffi_rust_future_complete_i64(handle, f_status_.__wbg_ptr);
    return ret;
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 * @returns {number}
 */
export function ubrn_ffi_matrix_sdk_ffi_rust_future_complete_i8(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_ffi_matrix_sdk_ffi_rust_future_complete_i8(handle, f_status_.__wbg_ptr);
    return ret;
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_ffi_matrix_sdk_ffi_rust_future_complete_rust_buffer(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_ffi_matrix_sdk_ffi_rust_future_complete_rust_buffer(handle, f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 * @returns {number}
 */
export function ubrn_ffi_matrix_sdk_ffi_rust_future_complete_u16(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_ffi_matrix_sdk_ffi_rust_future_complete_u16(handle, f_status_.__wbg_ptr);
    return ret;
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 * @returns {number}
 */
export function ubrn_ffi_matrix_sdk_ffi_rust_future_complete_u32(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_ffi_matrix_sdk_ffi_rust_future_complete_u32(handle, f_status_.__wbg_ptr);
    return ret >>> 0;
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_ffi_matrix_sdk_ffi_rust_future_complete_u64(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_ffi_matrix_sdk_ffi_rust_future_complete_u64(handle, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 * @returns {number}
 */
export function ubrn_ffi_matrix_sdk_ffi_rust_future_complete_u8(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_ffi_matrix_sdk_ffi_rust_future_complete_u8(handle, f_status_.__wbg_ptr);
    return ret;
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 */
export function ubrn_ffi_matrix_sdk_ffi_rust_future_complete_void(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_ffi_matrix_sdk_ffi_rust_future_complete_void(handle, f_status_.__wbg_ptr);
}

/**
 * @param {bigint} handle
 */
export function ubrn_ffi_matrix_sdk_ffi_rust_future_free_f32(handle) {
    wasm.ubrn_ffi_matrix_sdk_ffi_rust_future_free_f32(handle);
}

/**
 * @param {bigint} handle
 */
export function ubrn_ffi_matrix_sdk_ffi_rust_future_free_f64(handle) {
    wasm.ubrn_ffi_matrix_sdk_ffi_rust_future_free_f64(handle);
}

/**
 * @param {bigint} handle
 */
export function ubrn_ffi_matrix_sdk_ffi_rust_future_free_i16(handle) {
    wasm.ubrn_ffi_matrix_sdk_ffi_rust_future_free_i16(handle);
}

/**
 * @param {bigint} handle
 */
export function ubrn_ffi_matrix_sdk_ffi_rust_future_free_i32(handle) {
    wasm.ubrn_ffi_matrix_sdk_ffi_rust_future_free_i32(handle);
}

/**
 * @param {bigint} handle
 */
export function ubrn_ffi_matrix_sdk_ffi_rust_future_free_i64(handle) {
    wasm.ubrn_ffi_matrix_sdk_ffi_rust_future_free_i64(handle);
}

/**
 * @param {bigint} handle
 */
export function ubrn_ffi_matrix_sdk_ffi_rust_future_free_i8(handle) {
    wasm.ubrn_ffi_matrix_sdk_ffi_rust_future_free_i8(handle);
}

/**
 * @param {bigint} handle
 */
export function ubrn_ffi_matrix_sdk_ffi_rust_future_free_rust_buffer(handle) {
    wasm.ubrn_ffi_matrix_sdk_ffi_rust_future_free_rust_buffer(handle);
}

/**
 * @param {bigint} handle
 */
export function ubrn_ffi_matrix_sdk_ffi_rust_future_free_u16(handle) {
    wasm.ubrn_ffi_matrix_sdk_ffi_rust_future_free_u16(handle);
}

/**
 * @param {bigint} handle
 */
export function ubrn_ffi_matrix_sdk_ffi_rust_future_free_u32(handle) {
    wasm.ubrn_ffi_matrix_sdk_ffi_rust_future_free_u32(handle);
}

/**
 * @param {bigint} handle
 */
export function ubrn_ffi_matrix_sdk_ffi_rust_future_free_u64(handle) {
    wasm.ubrn_ffi_matrix_sdk_ffi_rust_future_free_u64(handle);
}

/**
 * @param {bigint} handle
 */
export function ubrn_ffi_matrix_sdk_ffi_rust_future_free_u8(handle) {
    wasm.ubrn_ffi_matrix_sdk_ffi_rust_future_free_u8(handle);
}

/**
 * @param {bigint} handle
 */
export function ubrn_ffi_matrix_sdk_ffi_rust_future_free_void(handle) {
    wasm.ubrn_ffi_matrix_sdk_ffi_rust_future_free_void(handle);
}

/**
 * @param {bigint} handle
 * @param {any} callback
 * @param {bigint} callback_data
 */
export function ubrn_ffi_matrix_sdk_ffi_rust_future_poll_f32(handle, callback, callback_data) {
    wasm.ubrn_ffi_matrix_sdk_ffi_rust_future_poll_f32(handle, callback, callback_data);
}

/**
 * @param {bigint} handle
 * @param {any} callback
 * @param {bigint} callback_data
 */
export function ubrn_ffi_matrix_sdk_ffi_rust_future_poll_f64(handle, callback, callback_data) {
    wasm.ubrn_ffi_matrix_sdk_ffi_rust_future_poll_f64(handle, callback, callback_data);
}

/**
 * @param {bigint} handle
 * @param {any} callback
 * @param {bigint} callback_data
 */
export function ubrn_ffi_matrix_sdk_ffi_rust_future_poll_i16(handle, callback, callback_data) {
    wasm.ubrn_ffi_matrix_sdk_ffi_rust_future_poll_i16(handle, callback, callback_data);
}

/**
 * @param {bigint} handle
 * @param {any} callback
 * @param {bigint} callback_data
 */
export function ubrn_ffi_matrix_sdk_ffi_rust_future_poll_i32(handle, callback, callback_data) {
    wasm.ubrn_ffi_matrix_sdk_ffi_rust_future_poll_i32(handle, callback, callback_data);
}

/**
 * @param {bigint} handle
 * @param {any} callback
 * @param {bigint} callback_data
 */
export function ubrn_ffi_matrix_sdk_ffi_rust_future_poll_i64(handle, callback, callback_data) {
    wasm.ubrn_ffi_matrix_sdk_ffi_rust_future_poll_i64(handle, callback, callback_data);
}

/**
 * @param {bigint} handle
 * @param {any} callback
 * @param {bigint} callback_data
 */
export function ubrn_ffi_matrix_sdk_ffi_rust_future_poll_i8(handle, callback, callback_data) {
    wasm.ubrn_ffi_matrix_sdk_ffi_rust_future_poll_i8(handle, callback, callback_data);
}

/**
 * @param {bigint} handle
 * @param {any} callback
 * @param {bigint} callback_data
 */
export function ubrn_ffi_matrix_sdk_ffi_rust_future_poll_rust_buffer(handle, callback, callback_data) {
    wasm.ubrn_ffi_matrix_sdk_ffi_rust_future_poll_rust_buffer(handle, callback, callback_data);
}

/**
 * @param {bigint} handle
 * @param {any} callback
 * @param {bigint} callback_data
 */
export function ubrn_ffi_matrix_sdk_ffi_rust_future_poll_u16(handle, callback, callback_data) {
    wasm.ubrn_ffi_matrix_sdk_ffi_rust_future_poll_u16(handle, callback, callback_data);
}

/**
 * @param {bigint} handle
 * @param {any} callback
 * @param {bigint} callback_data
 */
export function ubrn_ffi_matrix_sdk_ffi_rust_future_poll_u32(handle, callback, callback_data) {
    wasm.ubrn_ffi_matrix_sdk_ffi_rust_future_poll_u32(handle, callback, callback_data);
}

/**
 * @param {bigint} handle
 * @param {any} callback
 * @param {bigint} callback_data
 */
export function ubrn_ffi_matrix_sdk_ffi_rust_future_poll_u64(handle, callback, callback_data) {
    wasm.ubrn_ffi_matrix_sdk_ffi_rust_future_poll_u64(handle, callback, callback_data);
}

/**
 * @param {bigint} handle
 * @param {any} callback
 * @param {bigint} callback_data
 */
export function ubrn_ffi_matrix_sdk_ffi_rust_future_poll_u8(handle, callback, callback_data) {
    wasm.ubrn_ffi_matrix_sdk_ffi_rust_future_poll_u8(handle, callback, callback_data);
}

/**
 * @param {bigint} handle
 * @param {any} callback
 * @param {bigint} callback_data
 */
export function ubrn_ffi_matrix_sdk_ffi_rust_future_poll_void(handle, callback, callback_data) {
    wasm.ubrn_ffi_matrix_sdk_ffi_rust_future_poll_void(handle, callback, callback_data);
}

/**
 * @returns {number}
 */
export function ubrn_ffi_matrix_sdk_ffi_uniffi_contract_version() {
    const ret = wasm.ubrn_ffi_matrix_sdk_ffi_uniffi_contract_version();
    return ret >>> 0;
}

/**
 * @returns {number}
 */
export function ubrn_ffi_matrix_sdk_ui_uniffi_contract_version() {
    const ret = wasm.ubrn_ffi_matrix_sdk_ui_uniffi_contract_version();
    return ret >>> 0;
}

/**
 * @returns {number}
 */
export function ubrn_ffi_matrix_sdk_uniffi_contract_version() {
    const ret = wasm.ubrn_ffi_matrix_sdk_uniffi_contract_version();
    return ret >>> 0;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_checksum_method_oauthauthorizationdata_login_url() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_checksum_method_oauthauthorizationdata_login_url();
    return ret;
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_crypto_fn_clone_backupsecrets(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_crypto_fn_clone_backupsecrets(handle, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_crypto_fn_clone_crosssigningsecrets(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_crypto_fn_clone_crosssigningsecrets(handle, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_crypto_fn_clone_secretsbundle(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_crypto_fn_clone_secretsbundle(handle, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_crypto_fn_free_backupsecrets(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_crypto_fn_free_backupsecrets(handle, f_status_.__wbg_ptr);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_crypto_fn_free_crosssigningsecrets(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_crypto_fn_free_crosssigningsecrets(handle, f_status_.__wbg_ptr);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_crypto_fn_free_secretsbundle(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_crypto_fn_free_secretsbundle(handle, f_status_.__wbg_ptr);
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_constructor_clientbuilder_new() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_constructor_clientbuilder_new();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_constructor_indexeddbstorebuilder_new() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_constructor_indexeddbstorebuilder_new();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_constructor_mediasource_from_json() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_constructor_mediasource_from_json();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_constructor_mediasource_from_url() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_constructor_mediasource_from_url();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_constructor_qrcodedata_from_bytes() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_constructor_qrcodedata_from_bytes();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_constructor_secretsbundlewithuserid_from_str() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_constructor_secretsbundlewithuserid_from_str();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_constructor_span_current() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_constructor_span_current();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_constructor_span_new() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_constructor_span_new();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_constructor_span_new_bridge_span() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_constructor_span_new_bridge_span();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_constructor_timelineeventfilter_exclude() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_constructor_timelineeventfilter_exclude();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_constructor_timelineeventfilter_exclude_event_types() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_constructor_timelineeventfilter_exclude_event_types();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_constructor_timelineeventfilter_include() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_constructor_timelineeventfilter_include();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_constructor_timelineeventfilter_include_event_types() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_constructor_timelineeventfilter_include_event_types();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_func_content_without_relation_from_message() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_func_content_without_relation_from_message();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_func_create_caption_edit() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_func_create_caption_edit();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_func_gen_transaction_id() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_func_gen_transaction_id();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_func_generate_webview_url() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_func_generate_webview_url();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_func_get_element_call_required_permissions() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_func_get_element_call_required_permissions();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_func_init_platform() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_func_init_platform();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_func_is_room_alias_format_valid() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_func_is_room_alias_format_valid();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_func_json_string_contains_secrets_bundle() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_func_json_string_contains_secrets_bundle();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_func_log_event() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_func_log_event();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_func_make_widget_driver() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_func_make_widget_driver();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_func_matrix_to_room_alias_permalink() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_func_matrix_to_room_alias_permalink();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_func_matrix_to_user_permalink() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_func_matrix_to_user_permalink();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_func_message_event_content_from_html() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_func_message_event_content_from_html();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_func_message_event_content_from_html_as_emote() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_func_message_event_content_from_html_as_emote();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_func_message_event_content_from_markdown() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_func_message_event_content_from_markdown();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_func_message_event_content_from_markdown_as_emote() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_func_message_event_content_from_markdown_as_emote();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_func_message_event_content_new() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_func_message_event_content_new();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_func_new_virtual_element_call_widget() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_func_new_virtual_element_call_widget();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_func_parse_matrix_entity_from() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_func_parse_matrix_entity_from();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_func_reload_tracing_file_writer() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_func_reload_tracing_file_writer();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_func_room_alias_name_from_room_display_name() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_func_room_alias_name_from_room_display_name();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_func_sdk_git_sha() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_func_sdk_git_sha();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_func_suggested_power_level_for_role() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_func_suggested_power_level_for_role();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_func_suggested_role_for_power_level() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_func_suggested_role_for_power_level();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_accountdatalistener_on_change() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_accountdatalistener_on_change();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_backupstatelistener_on_update() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_backupstatelistener_on_update();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_backupsteadystatelistener_on_update() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_backupsteadystatelistener_on_update();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_beaconinfolistener_on_update() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_beaconinfolistener_on_update();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_calldeclinelistener_call() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_calldeclinelistener_call();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_checkcodesender_send() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_checkcodesender_send();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_abort_oauth_auth() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_abort_oauth_auth();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_account_data() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_account_data();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_account_url() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_account_url();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_available_sliding_sync_versions() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_available_sliding_sync_versions();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_avatar_url() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_avatar_url();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_await_room_remote_echo() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_await_room_remote_echo();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_cached_avatar_url() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_cached_avatar_url();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_can_deactivate_account() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_can_deactivate_account();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_clear_caches() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_clear_caches();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_create_room() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_create_room();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_custom_login_with_jwt() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_custom_login_with_jwt();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_deactivate_account() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_deactivate_account();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_delete_pusher() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_delete_pusher();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_device_id() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_device_id();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_display_name() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_display_name();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_enable_all_send_queues() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_enable_all_send_queues();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_enable_automatic_backpagination() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_enable_automatic_backpagination();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_enable_send_queue_upload_progress() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_enable_send_queue_upload_progress();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_encryption() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_encryption();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_fetch_media_preview_config() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_fetch_media_preview_config();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_get_dm_room() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_get_dm_room();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_get_dm_rooms() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_get_dm_rooms();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_get_invite_avatars_display_policy() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_get_invite_avatars_display_policy();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_get_max_media_upload_size() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_get_max_media_upload_size();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_get_media_content() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_get_media_content();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_get_media_file() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_get_media_file();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_get_media_preview_display_policy() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_get_media_preview_display_policy();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_get_media_thumbnail() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_get_media_thumbnail();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_get_notification_settings() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_get_notification_settings();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_get_profile() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_get_profile();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_get_recently_visited_rooms() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_get_recently_visited_rooms();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_get_room() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_get_room();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_get_room_preview_from_room_alias() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_get_room_preview_from_room_alias();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_get_room_preview_from_room_id() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_get_room_preview_from_room_id();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_get_session_verification_controller() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_get_session_verification_controller();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_get_store_sizes() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_get_store_sizes();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_get_url() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_get_url();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_homeserver() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_homeserver();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_homeserver_capabilities() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_homeserver_capabilities();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_homeserver_login_details() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_homeserver_login_details();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_ignore_user() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_ignore_user();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_ignored_users() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_ignored_users();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_is_livekit_rtc_supported() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_is_livekit_rtc_supported();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_is_login_with_qr_code_supported() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_is_login_with_qr_code_supported();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_is_report_room_api_supported() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_is_report_room_api_supported();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_is_room_alias_available() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_is_room_alias_available();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_join_room_by_id() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_join_room_by_id();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_join_room_by_id_or_alias() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_join_room_by_id_or_alias();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_knock() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_knock();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_login() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_login();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_login_with_email() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_login_with_email();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_login_with_oauth_callback() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_login_with_oauth_callback();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_logout() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_logout();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_mark_all_rooms_as_read() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_mark_all_rooms_as_read();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_new_grant_login_with_qr_code_handler() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_new_grant_login_with_qr_code_handler();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_new_login_with_qr_code_handler() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_new_login_with_qr_code_handler();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_notification_client() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_notification_client();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_observe_account_data_event() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_observe_account_data_event();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_observe_room_account_data_event() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_observe_room_account_data_event();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_optimize_stores() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_optimize_stores();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_pause() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_pause();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_register_notification_handler() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_register_notification_handler();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_remove_avatar() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_remove_avatar();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_request_openid_token() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_request_openid_token();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_reset_supported_versions() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_reset_supported_versions();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_reset_well_known() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_reset_well_known();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_resolve_room_alias() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_resolve_room_alias();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_restore_session() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_restore_session();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_restore_session_with() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_restore_session_with();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_resume() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_resume();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_room_alias_exists() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_room_alias_exists();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_room_directory_search() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_room_directory_search();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_rooms() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_rooms();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_search_users() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_search_users();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_server() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_server();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_server_vendor_info() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_server_vendor_info();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_session() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_session();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_set_account_data() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_set_account_data();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_set_avatar_url() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_set_avatar_url();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_set_delegate() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_set_delegate();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_set_display_name() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_set_display_name();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_set_invite_avatars_display_policy() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_set_invite_avatars_display_policy();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_set_media_preview_display_policy() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_set_media_preview_display_policy();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_set_media_retention_policy() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_set_media_retention_policy();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_set_pusher() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_set_pusher();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_set_utd_delegate() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_set_utd_delegate();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_sliding_sync_version() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_sliding_sync_version();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_space_service() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_space_service();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_start_sso_login() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_start_sso_login();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_subscribe_to_duplicate_key_upload_errors() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_subscribe_to_duplicate_key_upload_errors();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_subscribe_to_ignored_users() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_subscribe_to_ignored_users();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_subscribe_to_media_preview_config() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_subscribe_to_media_preview_config();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_subscribe_to_own_beacon_info_updates() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_subscribe_to_own_beacon_info_updates();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_subscribe_to_room_info() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_subscribe_to_room_info();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_subscribe_to_send_queue_status() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_subscribe_to_send_queue_status();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_subscribe_to_send_queue_updates() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_subscribe_to_send_queue_updates();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_sync_once_v2() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_sync_once_v2();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_sync_service() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_sync_service();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_sync_v2() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_sync_v2();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_tile_server() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_tile_server();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_track_recently_visited_room() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_track_recently_visited_room();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_unignore_user() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_unignore_user();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_upload_avatar() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_upload_avatar();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_upload_media() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_upload_media();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_url_for_oauth() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_url_for_oauth();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_user_id() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_user_id();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_user_id_server_name() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_client_user_id_server_name();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_clientbuilder_add_root_certificates() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_clientbuilder_add_root_certificates();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_clientbuilder_auto_enable_backups() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_clientbuilder_auto_enable_backups();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_clientbuilder_auto_enable_cross_signing() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_clientbuilder_auto_enable_cross_signing();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_clientbuilder_backup_download_strategy() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_clientbuilder_backup_download_strategy();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_clientbuilder_build() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_clientbuilder_build();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_clientbuilder_cross_process_lock_config() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_clientbuilder_cross_process_lock_config();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_clientbuilder_decryption_settings() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_clientbuilder_decryption_settings();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_clientbuilder_disable_automatic_token_refresh() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_clientbuilder_disable_automatic_token_refresh();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_clientbuilder_disable_built_in_root_certificates() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_clientbuilder_disable_built_in_root_certificates();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_clientbuilder_disable_ssl_verification() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_clientbuilder_disable_ssl_verification();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_clientbuilder_dm_room_definition() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_clientbuilder_dm_room_definition();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_clientbuilder_enable_share_history_on_invite() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_clientbuilder_enable_share_history_on_invite();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_clientbuilder_homeserver_url() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_clientbuilder_homeserver_url();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_clientbuilder_in_memory_store() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_clientbuilder_in_memory_store();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_clientbuilder_indexeddb_store() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_clientbuilder_indexeddb_store();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_clientbuilder_proxy() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_clientbuilder_proxy();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_clientbuilder_request_config() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_clientbuilder_request_config();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_clientbuilder_room_key_recipient_strategy() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_clientbuilder_room_key_recipient_strategy();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_clientbuilder_server_name() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_clientbuilder_server_name();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_clientbuilder_server_name_or_homeserver_url() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_clientbuilder_server_name_or_homeserver_url();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_clientbuilder_set_session_delegate() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_clientbuilder_set_session_delegate();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_clientbuilder_sliding_sync_version_builder() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_clientbuilder_sliding_sync_version_builder();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_clientbuilder_system_is_memory_constrained() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_clientbuilder_system_is_memory_constrained();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_clientbuilder_threads_enabled() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_clientbuilder_threads_enabled();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_clientbuilder_user_agent() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_clientbuilder_user_agent();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_clientbuilder_username() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_clientbuilder_username();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_clientdelegate_did_receive_auth_error() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_clientdelegate_did_receive_auth_error();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_clientdelegate_on_background_task_error_report() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_clientdelegate_on_background_task_error_report();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_clientsessiondelegate_retrieve_session_from_keychain() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_clientsessiondelegate_retrieve_session_from_keychain();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_clientsessiondelegate_save_session_in_keychain() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_clientsessiondelegate_save_session_in_keychain();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_duplicatekeyuploaderrorlistener_on_duplicate_key_upload_error() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_duplicatekeyuploaderrorlistener_on_duplicate_key_upload_error();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_enablerecoveryprogresslistener_on_update() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_enablerecoveryprogresslistener_on_update();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_encryption_backup_exists_on_server() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_encryption_backup_exists_on_server();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_encryption_backup_state() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_encryption_backup_state();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_encryption_backup_state_listener() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_encryption_backup_state_listener();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_encryption_curve25519_key() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_encryption_curve25519_key();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_encryption_disable_recovery() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_encryption_disable_recovery();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_encryption_ed25519_key() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_encryption_ed25519_key();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_encryption_enable_backups() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_encryption_enable_backups();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_encryption_enable_recovery() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_encryption_enable_recovery();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_encryption_has_devices_to_verify_against() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_encryption_has_devices_to_verify_against();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_encryption_import_secrets_bundle() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_encryption_import_secrets_bundle();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_encryption_is_last_device() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_encryption_is_last_device();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_encryption_recover() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_encryption_recover();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_encryption_recover_and_fix_backup() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_encryption_recover_and_fix_backup();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_encryption_recover_and_reset() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_encryption_recover_and_reset();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_encryption_recovery_state() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_encryption_recovery_state();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_encryption_recovery_state_listener() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_encryption_recovery_state_listener();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_encryption_reset_identity() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_encryption_reset_identity();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_encryption_reset_recovery_key() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_encryption_reset_recovery_key();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_encryption_user_identity() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_encryption_user_identity();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_encryption_verification_state() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_encryption_verification_state();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_encryption_verification_state_listener() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_encryption_verification_state_listener();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_encryption_wait_for_backup_upload_steady_state() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_encryption_wait_for_backup_upload_steady_state();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_encryption_wait_for_e2ee_initialization_tasks() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_encryption_wait_for_e2ee_initialization_tasks();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_generatedqrloginprogresslistener_on_update() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_generatedqrloginprogresslistener_on_update();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_grantgeneratedqrloginprogresslistener_on_update() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_grantgeneratedqrloginprogresslistener_on_update();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_grantloginwithqrcodehandler_generate() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_grantloginwithqrcodehandler_generate();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_grantloginwithqrcodehandler_scan() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_grantloginwithqrcodehandler_scan();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_grantqrloginprogresslistener_on_update() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_grantqrloginprogresslistener_on_update();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_homeservercapabilities_can_change_avatar() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_homeservercapabilities_can_change_avatar();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_homeservercapabilities_can_change_displayname() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_homeservercapabilities_can_change_displayname();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_homeservercapabilities_can_change_password() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_homeservercapabilities_can_change_password();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_homeservercapabilities_can_change_thirdparty_ids() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_homeservercapabilities_can_change_thirdparty_ids();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_homeservercapabilities_can_get_login_token() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_homeservercapabilities_can_get_login_token();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_homeservercapabilities_extended_profile_fields() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_homeservercapabilities_extended_profile_fields();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_homeservercapabilities_forgets_room_when_leaving() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_homeservercapabilities_forgets_room_when_leaving();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_homeservercapabilities_refresh() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_homeservercapabilities_refresh();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_homeserverlogindetails_sliding_sync_version() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_homeserverlogindetails_sliding_sync_version();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_homeserverlogindetails_supported_oauth_prompts() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_homeserverlogindetails_supported_oauth_prompts();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_homeserverlogindetails_supports_oauth_login() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_homeserverlogindetails_supports_oauth_login();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_homeserverlogindetails_supports_password_login() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_homeserverlogindetails_supports_password_login();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_homeserverlogindetails_supports_sso_login() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_homeserverlogindetails_supports_sso_login();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_homeserverlogindetails_url() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_homeserverlogindetails_url();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_identityresethandle_auth_type() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_identityresethandle_auth_type();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_identityresethandle_cancel() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_identityresethandle_cancel();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_identityresethandle_reset() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_identityresethandle_reset();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_identitystatuschangelistener_call() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_identitystatuschangelistener_call();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_ignoreduserslistener_call() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_ignoreduserslistener_call();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_indexeddbstorebuilder_passphrase() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_indexeddbstorebuilder_passphrase();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_inreplytodetails_event() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_inreplytodetails_event();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_inreplytodetails_event_id() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_inreplytodetails_event_id();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_knockrequestactions_accept() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_knockrequestactions_accept();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_knockrequestactions_decline() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_knockrequestactions_decline();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_knockrequestactions_decline_and_ban() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_knockrequestactions_decline_and_ban();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_knockrequestactions_mark_as_seen() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_knockrequestactions_mark_as_seen();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_knockrequestslistener_call() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_knockrequestslistener_call();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_lazytimelineitemprovider_contains_only_emojis() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_lazytimelineitemprovider_contains_only_emojis();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_lazytimelineitemprovider_debug_info() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_lazytimelineitemprovider_debug_info();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_lazytimelineitemprovider_get_send_handle() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_lazytimelineitemprovider_get_send_handle();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_lazytimelineitemprovider_get_shields() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_lazytimelineitemprovider_get_shields();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_lazytimelineitemprovider_latest_json() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_lazytimelineitemprovider_latest_json();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_leavespacehandle_leave() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_leavespacehandle_leave();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_leavespacehandle_rooms() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_leavespacehandle_rooms();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_livelocationslistener_on_update() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_livelocationslistener_on_update();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_livelocationsobserver_subscribe() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_livelocationsobserver_subscribe();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_loginwithqrcodehandler_generate() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_loginwithqrcodehandler_generate();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_loginwithqrcodehandler_scan() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_loginwithqrcodehandler_scan();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_mediafilehandle_path() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_mediafilehandle_path();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_mediafilehandle_persist() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_mediafilehandle_persist();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_mediapreviewconfiglistener_on_change() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_mediapreviewconfiglistener_on_change();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_mediasource_to_json() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_mediasource_to_json();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_mediasource_url() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_mediasource_url();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_notificationclient_get_notification() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_notificationclient_get_notification();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_notificationclient_get_notifications() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_notificationclient_get_notifications();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_notificationclient_get_room() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_notificationclient_get_room();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_notificationsettings_can_homeserver_push_encrypted_event_to_device() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_notificationsettings_can_homeserver_push_encrypted_event_to_device();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_notificationsettings_can_push_encrypted_event_to_device() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_notificationsettings_can_push_encrypted_event_to_device();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_notificationsettings_contains_keywords_rules() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_notificationsettings_contains_keywords_rules();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_notificationsettings_get_default_room_notification_mode() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_notificationsettings_get_default_room_notification_mode();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_notificationsettings_get_raw_push_rules() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_notificationsettings_get_raw_push_rules();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_notificationsettings_get_room_notification_settings() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_notificationsettings_get_room_notification_settings();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_notificationsettings_get_rooms_with_user_defined_rules() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_notificationsettings_get_rooms_with_user_defined_rules();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_notificationsettings_get_user_defined_room_notification_mode() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_notificationsettings_get_user_defined_room_notification_mode();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_notificationsettings_is_call_enabled() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_notificationsettings_is_call_enabled();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_notificationsettings_is_invite_for_me_enabled() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_notificationsettings_is_invite_for_me_enabled();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_notificationsettings_is_room_mention_enabled() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_notificationsettings_is_room_mention_enabled();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_notificationsettings_is_user_mention_enabled() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_notificationsettings_is_user_mention_enabled();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_notificationsettings_restore_default_room_notification_mode() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_notificationsettings_restore_default_room_notification_mode();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_notificationsettings_set_call_enabled() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_notificationsettings_set_call_enabled();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_notificationsettings_set_custom_push_rule() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_notificationsettings_set_custom_push_rule();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_notificationsettings_set_default_room_notification_mode() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_notificationsettings_set_default_room_notification_mode();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_notificationsettings_set_delegate() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_notificationsettings_set_delegate();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_notificationsettings_set_invite_for_me_enabled() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_notificationsettings_set_invite_for_me_enabled();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_notificationsettings_set_room_mention_enabled() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_notificationsettings_set_room_mention_enabled();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_notificationsettings_set_room_notification_mode() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_notificationsettings_set_room_notification_mode();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_notificationsettings_set_user_mention_enabled() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_notificationsettings_set_user_mention_enabled();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_notificationsettings_unmute_room() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_notificationsettings_unmute_room();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_notificationsettingsdelegate_settings_did_change() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_notificationsettingsdelegate_settings_did_change();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_paginationstatuslistener_on_update() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_paginationstatuslistener_on_update();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_progresswatcher_transmission_progress() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_progresswatcher_transmission_progress();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_qrcodedata_base_url() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_qrcodedata_base_url();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_qrcodedata_intent() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_qrcodedata_intent();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_qrcodedata_server_name() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_qrcodedata_server_name();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_qrcodedata_to_bytes() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_qrcodedata_to_bytes();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_qrloginprogresslistener_on_update() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_qrloginprogresslistener_on_update();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_recoverystatelistener_on_update() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_recoverystatelistener_on_update();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_active_members_count() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_active_members_count();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_active_room_call_participants() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_active_room_call_participants();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_alternative_aliases() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_alternative_aliases();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_apply_power_level_changes() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_apply_power_level_changes();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_avatar_url() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_avatar_url();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_ban_user() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_ban_user();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_canonical_alias() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_canonical_alias();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_clear_composer_draft() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_clear_composer_draft();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_clear_event_cache_storage() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_clear_event_cache_storage();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_decline_call() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_decline_call();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_discard_room_key() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_discard_room_key();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_display_name() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_display_name();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_edit() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_edit();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_enable_encryption() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_enable_encryption();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_enable_send_queue() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_enable_send_queue();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_encryption_state() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_encryption_state();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_fetch_thread_subscription() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_fetch_thread_subscription();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_forget() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_forget();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_get_power_levels() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_get_power_levels();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_get_room_visibility() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_get_room_visibility();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_has_active_room_call() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_has_active_room_call();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_heroes() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_heroes();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_id() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_id();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_ignore_device_trust_and_resend() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_ignore_device_trust_and_resend();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_ignore_user() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_ignore_user();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_invite_user_by_id() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_invite_user_by_id();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_invited_members_count() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_invited_members_count();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_inviter() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_inviter();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_is_direct() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_is_direct();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_is_encrypted() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_is_encrypted();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_is_public() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_is_public();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_is_send_queue_enabled() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_is_send_queue_enabled();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_is_space() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_is_space();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_join() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_join();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_joined_members_count() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_joined_members_count();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_kick_user() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_kick_user();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_latest_encryption_state() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_latest_encryption_state();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_latest_event() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_latest_event();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_leave() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_leave();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_live_locations_observer() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_live_locations_observer();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_load_composer_draft() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_load_composer_draft();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_load_or_fetch_event() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_load_or_fetch_event();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_mark_as_fully_read_unchecked() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_mark_as_fully_read_unchecked();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_mark_as_read() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_mark_as_read();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_matrix_to_event_permalink() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_matrix_to_event_permalink();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_matrix_to_permalink() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_matrix_to_permalink();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_member() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_member();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_member_avatar_url() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_member_avatar_url();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_member_display_name() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_member_display_name();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_member_with_sender_info() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_member_with_sender_info();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_members() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_members();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_members_no_sync() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_members_no_sync();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_membership() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_membership();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_own_user_id() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_own_user_id();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_predecessor_room() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_predecessor_room();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_preview_room() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_preview_room();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_publish_room_alias_in_room_directory() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_publish_room_alias_in_room_directory();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_raw_name() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_raw_name();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_redact() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_redact();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_remove_avatar() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_remove_avatar();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_remove_room_alias_from_room_directory() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_remove_room_alias_from_room_directory();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_report_content() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_report_content();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_report_room() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_report_room();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_reset_power_levels() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_reset_power_levels();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_room_events_debug_string() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_room_events_debug_string();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_room_info() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_room_info();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_save_composer_draft() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_save_composer_draft();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_send_live_location() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_send_live_location();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_send_raw() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_send_raw();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_send_state_event_raw() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_send_state_event_raw();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_set_is_favourite() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_set_is_favourite();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_set_is_low_priority() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_set_is_low_priority();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_set_name() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_set_name();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_set_own_member_display_name() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_set_own_member_display_name();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_set_thread_subscription() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_set_thread_subscription();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_set_topic() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_set_topic();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_set_unread_flag() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_set_unread_flag();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_start_live_location_share() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_start_live_location_share();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_stop_live_location_share() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_stop_live_location_share();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_subscribe_to_call_decline_events() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_subscribe_to_call_decline_events();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_subscribe_to_identity_status_changes() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_subscribe_to_identity_status_changes();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_subscribe_to_knock_requests() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_subscribe_to_knock_requests();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_subscribe_to_room_info_updates() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_subscribe_to_room_info_updates();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_subscribe_to_send_queue_updates() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_subscribe_to_send_queue_updates();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_subscribe_to_typing_notifications() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_subscribe_to_typing_notifications();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_successor_room() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_successor_room();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_suggested_role_for_user() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_suggested_role_for_user();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_thread_list_service() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_thread_list_service();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_timeline() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_timeline();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_timeline_with_configuration() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_timeline_with_configuration();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_topic() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_topic();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_typing_notice() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_typing_notice();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_unban_user() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_unban_user();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_update_canonical_alias() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_update_canonical_alias();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_update_history_visibility() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_update_history_visibility();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_update_join_rules() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_update_join_rules();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_update_power_levels_for_users() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_update_power_levels_for_users();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_update_room_visibility() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_update_room_visibility();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_upload_avatar() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_upload_avatar();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_withdraw_verification_and_resend() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_room_withdraw_verification_and_resend();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_roomaccountdatalistener_on_change() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_roomaccountdatalistener_on_change();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_roomdirectorysearch_is_at_last_page() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_roomdirectorysearch_is_at_last_page();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_roomdirectorysearch_loaded_pages() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_roomdirectorysearch_loaded_pages();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_roomdirectorysearch_next_page() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_roomdirectorysearch_next_page();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_roomdirectorysearch_results() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_roomdirectorysearch_results();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_roomdirectorysearch_search() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_roomdirectorysearch_search();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_roomdirectorysearchentrieslistener_on_update() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_roomdirectorysearchentrieslistener_on_update();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_roominfolistener_call() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_roominfolistener_call();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_roomlist_entries_with_dynamic_adapters() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_roomlist_entries_with_dynamic_adapters();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_roomlist_loading_state() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_roomlist_loading_state();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_roomlist_room() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_roomlist_room();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_roomlistdynamicentriescontroller_add_one_page() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_roomlistdynamicentriescontroller_add_one_page();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_roomlistdynamicentriescontroller_reset_to_one_page() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_roomlistdynamicentriescontroller_reset_to_one_page();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_roomlistdynamicentriescontroller_set_filter() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_roomlistdynamicentriescontroller_set_filter();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_roomlistentrieslistener_on_update() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_roomlistentrieslistener_on_update();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_roomlistentrieswithdynamicadaptersresult_controller() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_roomlistentrieswithdynamicadaptersresult_controller();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_roomlistentrieswithdynamicadaptersresult_entries_stream() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_roomlistentrieswithdynamicadaptersresult_entries_stream();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_roomlistloadingstatelistener_on_update() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_roomlistloadingstatelistener_on_update();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_roomlistservice_all_rooms() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_roomlistservice_all_rooms();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_roomlistservice_room() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_roomlistservice_room();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_roomlistservice_state() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_roomlistservice_state();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_roomlistservice_subscribe_to_rooms() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_roomlistservice_subscribe_to_rooms();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_roomlistservice_sync_indicator() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_roomlistservice_sync_indicator();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_roomlistservicestatelistener_on_update() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_roomlistservicestatelistener_on_update();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_roomlistservicesyncindicatorlistener_on_update() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_roomlistservicesyncindicatorlistener_on_update();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_roommembersiterator_len() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_roommembersiterator_len();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_roommembersiterator_next_chunk() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_roommembersiterator_next_chunk();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_roommessageeventcontentwithoutrelation_with_mentions() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_roommessageeventcontentwithoutrelation_with_mentions();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_roompowerlevels_can_own_user_ban() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_roompowerlevels_can_own_user_ban();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_roompowerlevels_can_own_user_invite() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_roompowerlevels_can_own_user_invite();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_roompowerlevels_can_own_user_kick() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_roompowerlevels_can_own_user_kick();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_roompowerlevels_can_own_user_pin_unpin() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_roompowerlevels_can_own_user_pin_unpin();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_roompowerlevels_can_own_user_redact_other() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_roompowerlevels_can_own_user_redact_other();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_roompowerlevels_can_own_user_redact_own() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_roompowerlevels_can_own_user_redact_own();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_roompowerlevels_can_own_user_send_message() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_roompowerlevels_can_own_user_send_message();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_roompowerlevels_can_own_user_send_state() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_roompowerlevels_can_own_user_send_state();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_roompowerlevels_can_own_user_trigger_room_notification() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_roompowerlevels_can_own_user_trigger_room_notification();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_roompowerlevels_can_user_ban() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_roompowerlevels_can_user_ban();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_roompowerlevels_can_user_invite() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_roompowerlevels_can_user_invite();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_roompowerlevels_can_user_kick() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_roompowerlevels_can_user_kick();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_roompowerlevels_can_user_pin_unpin() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_roompowerlevels_can_user_pin_unpin();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_roompowerlevels_can_user_redact_other() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_roompowerlevels_can_user_redact_other();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_roompowerlevels_can_user_redact_own() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_roompowerlevels_can_user_redact_own();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_roompowerlevels_can_user_send_message() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_roompowerlevels_can_user_send_message();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_roompowerlevels_can_user_send_state() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_roompowerlevels_can_user_send_state();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_roompowerlevels_can_user_trigger_room_notification() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_roompowerlevels_can_user_trigger_room_notification();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_roompowerlevels_events() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_roompowerlevels_events();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_roompowerlevels_user_power_levels() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_roompowerlevels_user_power_levels();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_roompowerlevels_values() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_roompowerlevels_values();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_roompreview_forget() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_roompreview_forget();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_roompreview_info() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_roompreview_info();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_roompreview_inviter() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_roompreview_inviter();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_roompreview_leave() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_roompreview_leave();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_roompreview_own_membership_details() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_roompreview_own_membership_details();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_secretsbundlewithuserid_contains_backup_key() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_secretsbundlewithuserid_contains_backup_key();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_sendattachmentjoinhandle_cancel() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_sendattachmentjoinhandle_cancel();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_sendattachmentjoinhandle_join() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_sendattachmentjoinhandle_join();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_sendhandle_abort() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_sendhandle_abort();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_sendhandle_try_resend() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_sendhandle_try_resend();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_sendqueuelistener_on_update() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_sendqueuelistener_on_update();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_sendqueueroomerrorlistener_on_error() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_sendqueueroomerrorlistener_on_error();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_sendqueueroomupdatelistener_on_update() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_sendqueueroomupdatelistener_on_update();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_sessionverificationcontroller_accept_verification_request() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_sessionverificationcontroller_accept_verification_request();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_sessionverificationcontroller_acknowledge_verification_request() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_sessionverificationcontroller_acknowledge_verification_request();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_sessionverificationcontroller_approve_verification() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_sessionverificationcontroller_approve_verification();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_sessionverificationcontroller_cancel_verification() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_sessionverificationcontroller_cancel_verification();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_sessionverificationcontroller_decline_verification() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_sessionverificationcontroller_decline_verification();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_sessionverificationcontroller_request_device_verification() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_sessionverificationcontroller_request_device_verification();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_sessionverificationcontroller_request_user_verification() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_sessionverificationcontroller_request_user_verification();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_sessionverificationcontroller_set_delegate() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_sessionverificationcontroller_set_delegate();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_sessionverificationcontroller_start_sas_verification() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_sessionverificationcontroller_start_sas_verification();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_sessionverificationcontrollerdelegate_did_accept_verification_request() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_sessionverificationcontrollerdelegate_did_accept_verification_request();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_sessionverificationcontrollerdelegate_did_cancel() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_sessionverificationcontrollerdelegate_did_cancel();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_sessionverificationcontrollerdelegate_did_fail() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_sessionverificationcontrollerdelegate_did_fail();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_sessionverificationcontrollerdelegate_did_finish() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_sessionverificationcontrollerdelegate_did_finish();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_sessionverificationcontrollerdelegate_did_receive_verification_data() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_sessionverificationcontrollerdelegate_did_receive_verification_data();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_sessionverificationcontrollerdelegate_did_receive_verification_request() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_sessionverificationcontrollerdelegate_did_receive_verification_request();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_sessionverificationcontrollerdelegate_did_start_sas_verification() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_sessionverificationcontrollerdelegate_did_start_sas_verification();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_sessionverificationemoji_description() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_sessionverificationemoji_description();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_sessionverificationemoji_symbol() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_sessionverificationemoji_symbol();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_spaceroomlist_paginate() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_spaceroomlist_paginate();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_spaceroomlist_pagination_state() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_spaceroomlist_pagination_state();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_spaceroomlist_reset() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_spaceroomlist_reset();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_spaceroomlist_rooms() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_spaceroomlist_rooms();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_spaceroomlist_space() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_spaceroomlist_space();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_spaceroomlist_subscribe_to_pagination_state_updates() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_spaceroomlist_subscribe_to_pagination_state_updates();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_spaceroomlist_subscribe_to_room_update() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_spaceroomlist_subscribe_to_room_update();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_spaceroomlist_subscribe_to_space_updates() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_spaceroomlist_subscribe_to_space_updates();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_spaceroomlistentrieslistener_on_update() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_spaceroomlistentrieslistener_on_update();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_spaceroomlistpaginationstatelistener_on_update() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_spaceroomlistpaginationstatelistener_on_update();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_spaceroomlistspacelistener_on_update() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_spaceroomlistspacelistener_on_update();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_spaceservice_add_child_to_space() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_spaceservice_add_child_to_space();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_spaceservice_editable_spaces() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_spaceservice_editable_spaces();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_spaceservice_get_space_room() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_spaceservice_get_space_room();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_spaceservice_joined_parents_of_child() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_spaceservice_joined_parents_of_child();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_spaceservice_leave_space() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_spaceservice_leave_space();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_spaceservice_remove_child_from_space() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_spaceservice_remove_child_from_space();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_spaceservice_space_filters() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_spaceservice_space_filters();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_spaceservice_space_room_list() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_spaceservice_space_room_list();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_spaceservice_subscribe_to_space_filters() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_spaceservice_subscribe_to_space_filters();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_spaceservice_subscribe_to_top_level_joined_spaces() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_spaceservice_subscribe_to_top_level_joined_spaces();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_spaceservice_top_level_joined_spaces() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_spaceservice_top_level_joined_spaces();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_spaceservicejoinedspaceslistener_on_update() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_spaceservicejoinedspaceslistener_on_update();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_spaceservicespacefilterslistener_on_update() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_spaceservicespacefilterslistener_on_update();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_span_enter() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_span_enter();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_span_exit() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_span_exit();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_span_is_none() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_span_is_none();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_ssohandler_finish() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_ssohandler_finish();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_ssohandler_url() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_ssohandler_url();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_synclistenerv2_on_update() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_synclistenerv2_on_update();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_syncnotificationlistener_on_notification() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_syncnotificationlistener_on_notification();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_syncservice_expire_sessions() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_syncservice_expire_sessions();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_syncservice_room_list_service() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_syncservice_room_list_service();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_syncservice_start() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_syncservice_start();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_syncservice_state() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_syncservice_state();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_syncservice_stop() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_syncservice_stop();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_syncservicebuilder_finish() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_syncservicebuilder_finish();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_syncservicebuilder_with_offline_mode() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_syncservicebuilder_with_offline_mode();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_syncservicebuilder_with_room_list_connection_id() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_syncservicebuilder_with_room_list_connection_id();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_syncservicebuilder_with_room_list_timeline_limit() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_syncservicebuilder_with_room_list_timeline_limit();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_syncservicebuilder_with_share_pos() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_syncservicebuilder_with_share_pos();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_syncservicestateobserver_on_update() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_syncservicestateobserver_on_update();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_taskhandle_cancel() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_taskhandle_cancel();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_taskhandle_is_finished() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_taskhandle_is_finished();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_threadlistentrieslistener_on_update() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_threadlistentrieslistener_on_update();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_threadlistpaginationstatelistener_on_update() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_threadlistpaginationstatelistener_on_update();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_threadlistservice_items() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_threadlistservice_items();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_threadlistservice_paginate() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_threadlistservice_paginate();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_threadlistservice_pagination_state() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_threadlistservice_pagination_state();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_threadlistservice_reset() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_threadlistservice_reset();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_threadlistservice_subscribe_to_items_updates() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_threadlistservice_subscribe_to_items_updates();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_threadlistservice_subscribe_to_pagination_state_updates() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_threadlistservice_subscribe_to_pagination_state_updates();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_threadsummary_latest_event() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_threadsummary_latest_event();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_threadsummary_num_replies() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_threadsummary_num_replies();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_timeline_add_listener() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_timeline_add_listener();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_timeline_create_message_content() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_timeline_create_message_content();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_timeline_create_poll() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_timeline_create_poll();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_timeline_edit() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_timeline_edit();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_timeline_end_poll() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_timeline_end_poll();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_timeline_fetch_details_for_event() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_timeline_fetch_details_for_event();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_timeline_fetch_members() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_timeline_fetch_members();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_timeline_get_event_timeline_item_by_event_id() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_timeline_get_event_timeline_item_by_event_id();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_timeline_latest_event_id() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_timeline_latest_event_id();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_timeline_load_reply_details() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_timeline_load_reply_details();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_timeline_mark_as_read() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_timeline_mark_as_read();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_timeline_paginate_backwards() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_timeline_paginate_backwards();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_timeline_paginate_forwards() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_timeline_paginate_forwards();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_timeline_pin_event() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_timeline_pin_event();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_timeline_redact_event() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_timeline_redact_event();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_timeline_retry_decryption() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_timeline_retry_decryption();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_timeline_send() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_timeline_send();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_timeline_send_audio() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_timeline_send_audio();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_timeline_send_file() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_timeline_send_file();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_timeline_send_image() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_timeline_send_image();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_timeline_send_location() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_timeline_send_location();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_timeline_send_poll_response() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_timeline_send_poll_response();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_timeline_send_read_receipt() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_timeline_send_read_receipt();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_timeline_send_reply() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_timeline_send_reply();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_timeline_send_video() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_timeline_send_video();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_timeline_send_voice_message() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_timeline_send_voice_message();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_timeline_subscribe_to_back_pagination_status() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_timeline_subscribe_to_back_pagination_status();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_timeline_toggle_reaction() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_timeline_toggle_reaction();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_timeline_unpin_event() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_timeline_unpin_event();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_timelineevent_content() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_timelineevent_content();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_timelineevent_event_id() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_timelineevent_event_id();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_timelineevent_sender_id() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_timelineevent_sender_id();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_timelineevent_thread_root_event_id() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_timelineevent_thread_root_event_id();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_timelineevent_timestamp() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_timelineevent_timestamp();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_timelineitem_as_event() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_timelineitem_as_event();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_timelineitem_as_virtual() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_timelineitem_as_virtual();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_timelineitem_fmt_debug() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_timelineitem_fmt_debug();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_timelineitem_unique_id() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_timelineitem_unique_id();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_timelinelistener_on_update() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_timelinelistener_on_update();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_typingnotificationslistener_call() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_typingnotificationslistener_call();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_unabletodecryptdelegate_on_utd() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_unabletodecryptdelegate_on_utd();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_unreadnotificationscount_has_notifications() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_unreadnotificationscount_has_notifications();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_unreadnotificationscount_highlight_count() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_unreadnotificationscount_highlight_count();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_unreadnotificationscount_notification_count() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_unreadnotificationscount_notification_count();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_useridentity_has_verification_violation() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_useridentity_has_verification_violation();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_useridentity_is_verified() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_useridentity_is_verified();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_useridentity_master_key() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_useridentity_master_key();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_useridentity_pin() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_useridentity_pin();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_useridentity_was_previously_verified() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_useridentity_was_previously_verified();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_useridentity_withdraw_verification() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_useridentity_withdraw_verification();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_verificationstatelistener_on_update() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_verificationstatelistener_on_update();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_widgetcapabilitiesprovider_acquire_capabilities() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_widgetcapabilitiesprovider_acquire_capabilities();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_widgetdriver_run() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_widgetdriver_run();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_widgetdriverhandle_recv() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_widgetdriverhandle_recv();
    return ret;
}

/**
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_checksum_method_widgetdriverhandle_send() {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_checksum_method_widgetdriverhandle_send();
    return ret;
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_clone_checkcodesender(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_clone_checkcodesender(handle, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_clone_client(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_clone_client(handle, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_clone_clientbuilder(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_clone_clientbuilder(handle, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_clone_encryption(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_clone_encryption(handle, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_clone_grantloginwithqrcodehandler(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_clone_grantloginwithqrcodehandler(handle, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_clone_homeservercapabilities(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_clone_homeservercapabilities(handle, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_clone_homeserverlogindetails(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_clone_homeserverlogindetails(handle, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_clone_identityresethandle(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_clone_identityresethandle(handle, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_clone_indexeddbstorebuilder(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_clone_indexeddbstorebuilder(handle, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_clone_inreplytodetails(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_clone_inreplytodetails(handle, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_clone_knockrequestactions(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_clone_knockrequestactions(handle, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_clone_lazytimelineitemprovider(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_clone_lazytimelineitemprovider(handle, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_clone_leavespacehandle(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_clone_leavespacehandle(handle, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_clone_livelocationsobserver(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_clone_livelocationsobserver(handle, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_clone_loginwithqrcodehandler(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_clone_loginwithqrcodehandler(handle, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_clone_mediafilehandle(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_clone_mediafilehandle(handle, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_clone_mediasource(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_clone_mediasource(handle, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_clone_notificationclient(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_clone_notificationclient(handle, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_clone_notificationsettings(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_clone_notificationsettings(handle, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_clone_qrcodedata(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_clone_qrcodedata(handle, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_clone_room(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_clone_room(handle, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_clone_roomdirectorysearch(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_clone_roomdirectorysearch(handle, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_clone_roomlist(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_clone_roomlist(handle, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_clone_roomlistdynamicentriescontroller(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_clone_roomlistdynamicentriescontroller(handle, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_clone_roomlistentrieswithdynamicadaptersresult(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_clone_roomlistentrieswithdynamicadaptersresult(handle, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_clone_roomlistservice(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_clone_roomlistservice(handle, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_clone_roommembersiterator(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_clone_roommembersiterator(handle, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_clone_roommessageeventcontentwithoutrelation(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_clone_roommessageeventcontentwithoutrelation(handle, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_clone_roompowerlevels(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_clone_roompowerlevels(handle, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_clone_roompreview(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_clone_roompreview(handle, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_clone_secretsbundlewithuserid(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_clone_secretsbundlewithuserid(handle, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_clone_sendattachmentjoinhandle(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_clone_sendattachmentjoinhandle(handle, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_clone_sendhandle(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_clone_sendhandle(handle, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_clone_sessionverificationcontroller(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_clone_sessionverificationcontroller(handle, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_clone_sessionverificationemoji(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_clone_sessionverificationemoji(handle, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_clone_spaceroomlist(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_clone_spaceroomlist(handle, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_clone_spaceservice(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_clone_spaceservice(handle, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_clone_span(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_clone_span(handle, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_clone_ssohandler(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_clone_ssohandler(handle, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_clone_syncservice(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_clone_syncservice(handle, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_clone_syncservicebuilder(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_clone_syncservicebuilder(handle, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_clone_taskhandle(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_clone_taskhandle(handle, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_clone_threadlistservice(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_clone_threadlistservice(handle, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_clone_threadsummary(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_clone_threadsummary(handle, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_clone_timeline(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_clone_timeline(handle, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_clone_timelineevent(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_clone_timelineevent(handle, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_clone_timelineeventfilter(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_clone_timelineeventfilter(handle, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_clone_timelineitem(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_clone_timelineitem(handle, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_clone_unreadnotificationscount(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_clone_unreadnotificationscount(handle, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_clone_useridentity(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_clone_useridentity(handle, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_clone_widgetdriver(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_clone_widgetdriver(handle, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_clone_widgetdriverhandle(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_clone_widgetdriverhandle(handle, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_constructor_clientbuilder_new(f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_constructor_clientbuilder_new(f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {Uint8Array} name
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_constructor_indexeddbstorebuilder_new(name, f_status_) {
    const ptr0 = passArray8ToWasm0(name, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_constructor_indexeddbstorebuilder_new(ptr0, len0, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {Uint8Array} json
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_constructor_mediasource_from_json(json, f_status_) {
    const ptr0 = passArray8ToWasm0(json, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_constructor_mediasource_from_json(ptr0, len0, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {Uint8Array} url
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_constructor_mediasource_from_url(url, f_status_) {
    const ptr0 = passArray8ToWasm0(url, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_constructor_mediasource_from_url(ptr0, len0, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {Uint8Array} bytes
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_constructor_qrcodedata_from_bytes(bytes, f_status_) {
    const ptr0 = passArray8ToWasm0(bytes, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_constructor_qrcodedata_from_bytes(ptr0, len0, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {Uint8Array} user_id
 * @param {Uint8Array} bundle
 * @param {Uint8Array} backup_info
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_constructor_secretsbundlewithuserid_from_str(user_id, bundle, backup_info, f_status_) {
    const ptr0 = passArray8ToWasm0(user_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(bundle, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArray8ToWasm0(backup_info, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_constructor_secretsbundlewithuserid_from_str(ptr0, len0, ptr1, len1, ptr2, len2, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_constructor_span_current(f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_constructor_span_current(f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {Uint8Array} file
 * @param {Uint8Array} line
 * @param {Uint8Array} level
 * @param {Uint8Array} target
 * @param {Uint8Array} name
 * @param {Uint8Array} bridge_trace_id
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_constructor_span_new(file, line, level, target, name, bridge_trace_id, f_status_) {
    const ptr0 = passArray8ToWasm0(file, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(line, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArray8ToWasm0(level, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ptr3 = passArray8ToWasm0(target, wasm.__wbindgen_malloc);
    const len3 = WASM_VECTOR_LEN;
    const ptr4 = passArray8ToWasm0(name, wasm.__wbindgen_malloc);
    const len4 = WASM_VECTOR_LEN;
    const ptr5 = passArray8ToWasm0(bridge_trace_id, wasm.__wbindgen_malloc);
    const len5 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_constructor_span_new(ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4, ptr5, len5, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {Uint8Array} target
 * @param {Uint8Array} parent_trace_id
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_constructor_span_new_bridge_span(target, parent_trace_id, f_status_) {
    const ptr0 = passArray8ToWasm0(target, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(parent_trace_id, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_constructor_span_new_bridge_span(ptr0, len0, ptr1, len1, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {Uint8Array} conditions
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_constructor_timelineeventfilter_exclude(conditions, f_status_) {
    const ptr0 = passArray8ToWasm0(conditions, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_constructor_timelineeventfilter_exclude(ptr0, len0, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {Uint8Array} event_types
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_constructor_timelineeventfilter_exclude_event_types(event_types, f_status_) {
    const ptr0 = passArray8ToWasm0(event_types, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_constructor_timelineeventfilter_exclude_event_types(ptr0, len0, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {Uint8Array} conditions
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_constructor_timelineeventfilter_include(conditions, f_status_) {
    const ptr0 = passArray8ToWasm0(conditions, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_constructor_timelineeventfilter_include(ptr0, len0, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {Uint8Array} event_types
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_constructor_timelineeventfilter_include_event_types(event_types, f_status_) {
    const ptr0 = passArray8ToWasm0(event_types, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_constructor_timelineeventfilter_include_event_types(ptr0, len0, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_free_checkcodesender(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_free_checkcodesender(handle, f_status_.__wbg_ptr);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_free_client(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_free_client(handle, f_status_.__wbg_ptr);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_free_clientbuilder(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_free_clientbuilder(handle, f_status_.__wbg_ptr);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_free_encryption(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_free_encryption(handle, f_status_.__wbg_ptr);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_free_grantloginwithqrcodehandler(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_free_grantloginwithqrcodehandler(handle, f_status_.__wbg_ptr);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_free_homeservercapabilities(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_free_homeservercapabilities(handle, f_status_.__wbg_ptr);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_free_homeserverlogindetails(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_free_homeserverlogindetails(handle, f_status_.__wbg_ptr);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_free_identityresethandle(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_free_identityresethandle(handle, f_status_.__wbg_ptr);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_free_indexeddbstorebuilder(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_free_indexeddbstorebuilder(handle, f_status_.__wbg_ptr);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_free_inreplytodetails(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_free_inreplytodetails(handle, f_status_.__wbg_ptr);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_free_knockrequestactions(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_free_knockrequestactions(handle, f_status_.__wbg_ptr);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_free_lazytimelineitemprovider(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_free_lazytimelineitemprovider(handle, f_status_.__wbg_ptr);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_free_leavespacehandle(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_free_leavespacehandle(handle, f_status_.__wbg_ptr);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_free_livelocationsobserver(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_free_livelocationsobserver(handle, f_status_.__wbg_ptr);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_free_loginwithqrcodehandler(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_free_loginwithqrcodehandler(handle, f_status_.__wbg_ptr);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_free_mediafilehandle(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_free_mediafilehandle(handle, f_status_.__wbg_ptr);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_free_mediasource(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_free_mediasource(handle, f_status_.__wbg_ptr);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_free_notificationclient(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_free_notificationclient(handle, f_status_.__wbg_ptr);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_free_notificationsettings(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_free_notificationsettings(handle, f_status_.__wbg_ptr);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_free_qrcodedata(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_free_qrcodedata(handle, f_status_.__wbg_ptr);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_free_room(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_free_room(handle, f_status_.__wbg_ptr);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_free_roomdirectorysearch(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_free_roomdirectorysearch(handle, f_status_.__wbg_ptr);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_free_roomlist(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_free_roomlist(handle, f_status_.__wbg_ptr);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_free_roomlistdynamicentriescontroller(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_free_roomlistdynamicentriescontroller(handle, f_status_.__wbg_ptr);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_free_roomlistentrieswithdynamicadaptersresult(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_free_roomlistentrieswithdynamicadaptersresult(handle, f_status_.__wbg_ptr);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_free_roomlistservice(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_free_roomlistservice(handle, f_status_.__wbg_ptr);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_free_roommembersiterator(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_free_roommembersiterator(handle, f_status_.__wbg_ptr);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_free_roommessageeventcontentwithoutrelation(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_free_roommessageeventcontentwithoutrelation(handle, f_status_.__wbg_ptr);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_free_roompowerlevels(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_free_roompowerlevels(handle, f_status_.__wbg_ptr);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_free_roompreview(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_free_roompreview(handle, f_status_.__wbg_ptr);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_free_secretsbundlewithuserid(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_free_secretsbundlewithuserid(handle, f_status_.__wbg_ptr);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_free_sendattachmentjoinhandle(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_free_sendattachmentjoinhandle(handle, f_status_.__wbg_ptr);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_free_sendhandle(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_free_sendhandle(handle, f_status_.__wbg_ptr);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_free_sessionverificationcontroller(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_free_sessionverificationcontroller(handle, f_status_.__wbg_ptr);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_free_sessionverificationemoji(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_free_sessionverificationemoji(handle, f_status_.__wbg_ptr);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_free_spaceroomlist(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_free_spaceroomlist(handle, f_status_.__wbg_ptr);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_free_spaceservice(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_free_spaceservice(handle, f_status_.__wbg_ptr);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_free_span(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_free_span(handle, f_status_.__wbg_ptr);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_free_ssohandler(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_free_ssohandler(handle, f_status_.__wbg_ptr);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_free_syncservice(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_free_syncservice(handle, f_status_.__wbg_ptr);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_free_syncservicebuilder(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_free_syncservicebuilder(handle, f_status_.__wbg_ptr);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_free_taskhandle(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_free_taskhandle(handle, f_status_.__wbg_ptr);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_free_threadlistservice(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_free_threadlistservice(handle, f_status_.__wbg_ptr);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_free_threadsummary(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_free_threadsummary(handle, f_status_.__wbg_ptr);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_free_timeline(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_free_timeline(handle, f_status_.__wbg_ptr);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_free_timelineevent(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_free_timelineevent(handle, f_status_.__wbg_ptr);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_free_timelineeventfilter(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_free_timelineeventfilter(handle, f_status_.__wbg_ptr);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_free_timelineitem(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_free_timelineitem(handle, f_status_.__wbg_ptr);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_free_unreadnotificationscount(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_free_unreadnotificationscount(handle, f_status_.__wbg_ptr);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_free_useridentity(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_free_useridentity(handle, f_status_.__wbg_ptr);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_free_widgetdriver(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_free_widgetdriver(handle, f_status_.__wbg_ptr);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_free_widgetdriverhandle(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_free_widgetdriverhandle(handle, f_status_.__wbg_ptr);
}

/**
 * @param {Uint8Array} message
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_func_content_without_relation_from_message(message, f_status_) {
    const ptr0 = passArray8ToWasm0(message, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_func_content_without_relation_from_message(ptr0, len0, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {Uint8Array} caption
 * @param {Uint8Array} formatted_caption
 * @param {Uint8Array} mentions
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_func_create_caption_edit(caption, formatted_caption, mentions, f_status_) {
    const ptr0 = passArray8ToWasm0(caption, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(formatted_caption, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArray8ToWasm0(mentions, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_func_create_caption_edit(ptr0, len0, ptr1, len1, ptr2, len2, f_status_.__wbg_ptr);
    var v4 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v4;
}

/**
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_func_gen_transaction_id(f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_func_gen_transaction_id(f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {Uint8Array} widget_settings
 * @param {bigint} room
 * @param {Uint8Array} props
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_func_generate_webview_url(widget_settings, room, props) {
    const ptr0 = passArray8ToWasm0(widget_settings, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(props, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_func_generate_webview_url(ptr0, len0, room, ptr1, len1);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {Uint8Array} own_user_id
 * @param {Uint8Array} own_device_id
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_func_get_element_call_required_permissions(own_user_id, own_device_id, f_status_) {
    const ptr0 = passArray8ToWasm0(own_user_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(own_device_id, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_func_get_element_call_required_permissions(ptr0, len0, ptr1, len1, f_status_.__wbg_ptr);
    var v3 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v3;
}

/**
 * @param {Uint8Array} config
 * @param {number} use_lightweight_tokio_runtime
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_func_init_platform(config, use_lightweight_tokio_runtime, f_status_) {
    const ptr0 = passArray8ToWasm0(config, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_func_init_platform(ptr0, len0, use_lightweight_tokio_runtime, f_status_.__wbg_ptr);
}

/**
 * @param {Uint8Array} alias
 * @param {RustCallStatus} f_status_
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_func_is_room_alias_format_valid(alias, f_status_) {
    const ptr0 = passArray8ToWasm0(alias, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_func_is_room_alias_format_valid(ptr0, len0, f_status_.__wbg_ptr);
    return ret;
}

/**
 * @param {Uint8Array} bundle
 * @param {Uint8Array} backup_info
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_func_json_string_contains_secrets_bundle(bundle, backup_info, f_status_) {
    const ptr0 = passArray8ToWasm0(bundle, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(backup_info, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_func_json_string_contains_secrets_bundle(ptr0, len0, ptr1, len1, f_status_.__wbg_ptr);
    var v3 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v3;
}

/**
 * @param {Uint8Array} file
 * @param {Uint8Array} line
 * @param {Uint8Array} level
 * @param {Uint8Array} target
 * @param {Uint8Array} message
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_func_log_event(file, line, level, target, message, f_status_) {
    const ptr0 = passArray8ToWasm0(file, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(line, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArray8ToWasm0(level, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ptr3 = passArray8ToWasm0(target, wasm.__wbindgen_malloc);
    const len3 = WASM_VECTOR_LEN;
    const ptr4 = passArray8ToWasm0(message, wasm.__wbindgen_malloc);
    const len4 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_func_log_event(ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4, f_status_.__wbg_ptr);
}

/**
 * @param {Uint8Array} settings
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_func_make_widget_driver(settings, f_status_) {
    const ptr0 = passArray8ToWasm0(settings, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_func_make_widget_driver(ptr0, len0, f_status_.__wbg_ptr);
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}

/**
 * @param {Uint8Array} room_alias
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_func_matrix_to_room_alias_permalink(room_alias, f_status_) {
    const ptr0 = passArray8ToWasm0(room_alias, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_func_matrix_to_room_alias_permalink(ptr0, len0, f_status_.__wbg_ptr);
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}

/**
 * @param {Uint8Array} user_id
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_func_matrix_to_user_permalink(user_id, f_status_) {
    const ptr0 = passArray8ToWasm0(user_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_func_matrix_to_user_permalink(ptr0, len0, f_status_.__wbg_ptr);
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}

/**
 * @param {Uint8Array} body
 * @param {Uint8Array} html_body
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_func_message_event_content_from_html(body, html_body, f_status_) {
    const ptr0 = passArray8ToWasm0(body, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(html_body, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_func_message_event_content_from_html(ptr0, len0, ptr1, len1, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {Uint8Array} body
 * @param {Uint8Array} html_body
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_func_message_event_content_from_html_as_emote(body, html_body, f_status_) {
    const ptr0 = passArray8ToWasm0(body, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(html_body, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_func_message_event_content_from_html_as_emote(ptr0, len0, ptr1, len1, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {Uint8Array} md
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_func_message_event_content_from_markdown(md, f_status_) {
    const ptr0 = passArray8ToWasm0(md, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_func_message_event_content_from_markdown(ptr0, len0, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {Uint8Array} md
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_func_message_event_content_from_markdown_as_emote(md, f_status_) {
    const ptr0 = passArray8ToWasm0(md, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_func_message_event_content_from_markdown_as_emote(ptr0, len0, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {Uint8Array} msgtype
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_func_message_event_content_new(msgtype, f_status_) {
    const ptr0 = passArray8ToWasm0(msgtype, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_func_message_event_content_new(ptr0, len0, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {Uint8Array} props
 * @param {Uint8Array} config
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_func_new_virtual_element_call_widget(props, config, f_status_) {
    const ptr0 = passArray8ToWasm0(props, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(config, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_func_new_virtual_element_call_widget(ptr0, len0, ptr1, len1, f_status_.__wbg_ptr);
    var v3 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v3;
}

/**
 * @param {Uint8Array} uri
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_func_parse_matrix_entity_from(uri, f_status_) {
    const ptr0 = passArray8ToWasm0(uri, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_func_parse_matrix_entity_from(ptr0, len0, f_status_.__wbg_ptr);
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}

/**
 * @param {Uint8Array} configuration
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_func_reload_tracing_file_writer(configuration, f_status_) {
    const ptr0 = passArray8ToWasm0(configuration, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_func_reload_tracing_file_writer(ptr0, len0, f_status_.__wbg_ptr);
}

/**
 * @param {Uint8Array} room_name
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_func_room_alias_name_from_room_display_name(room_name, f_status_) {
    const ptr0 = passArray8ToWasm0(room_name, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_func_room_alias_name_from_room_display_name(ptr0, len0, f_status_.__wbg_ptr);
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}

/**
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_func_sdk_git_sha(f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_func_sdk_git_sha(f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {Uint8Array} role
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_func_suggested_power_level_for_role(role, f_status_) {
    const ptr0 = passArray8ToWasm0(role, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_func_suggested_power_level_for_role(ptr0, len0, f_status_.__wbg_ptr);
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}

/**
 * @param {Uint8Array} power_level
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_func_suggested_role_for_power_level(power_level, f_status_) {
    const ptr0 = passArray8ToWasm0(power_level, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_func_suggested_role_for_power_level(ptr0, len0, f_status_.__wbg_ptr);
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}

/**
 * @param {any} vtable
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_accountdatalistener(vtable) {
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_accountdatalistener(vtable);
}

/**
 * @param {any} vtable
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_backupstatelistener(vtable) {
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_backupstatelistener(vtable);
}

/**
 * @param {any} vtable
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_backupsteadystatelistener(vtable) {
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_backupsteadystatelistener(vtable);
}

/**
 * @param {any} vtable
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_beaconinfolistener(vtable) {
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_beaconinfolistener(vtable);
}

/**
 * @param {any} vtable
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_calldeclinelistener(vtable) {
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_calldeclinelistener(vtable);
}

/**
 * @param {any} vtable
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_clientdelegate(vtable) {
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_clientdelegate(vtable);
}

/**
 * @param {any} vtable
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_clientsessiondelegate(vtable) {
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_clientsessiondelegate(vtable);
}

/**
 * @param {any} vtable
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_duplicatekeyuploaderrorlistener(vtable) {
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_duplicatekeyuploaderrorlistener(vtable);
}

/**
 * @param {any} vtable
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_enablerecoveryprogresslistener(vtable) {
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_enablerecoveryprogresslistener(vtable);
}

/**
 * @param {any} vtable
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_generatedqrloginprogresslistener(vtable) {
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_generatedqrloginprogresslistener(vtable);
}

/**
 * @param {any} vtable
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_grantgeneratedqrloginprogresslistener(vtable) {
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_grantgeneratedqrloginprogresslistener(vtable);
}

/**
 * @param {any} vtable
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_grantqrloginprogresslistener(vtable) {
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_grantqrloginprogresslistener(vtable);
}

/**
 * @param {any} vtable
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_identitystatuschangelistener(vtable) {
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_identitystatuschangelistener(vtable);
}

/**
 * @param {any} vtable
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_ignoreduserslistener(vtable) {
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_ignoreduserslistener(vtable);
}

/**
 * @param {any} vtable
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_knockrequestslistener(vtable) {
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_knockrequestslistener(vtable);
}

/**
 * @param {any} vtable
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_livelocationslistener(vtable) {
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_livelocationslistener(vtable);
}

/**
 * @param {any} vtable
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_mediapreviewconfiglistener(vtable) {
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_mediapreviewconfiglistener(vtable);
}

/**
 * @param {any} vtable
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_notificationsettingsdelegate(vtable) {
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_notificationsettingsdelegate(vtable);
}

/**
 * @param {any} vtable
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_paginationstatuslistener(vtable) {
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_paginationstatuslistener(vtable);
}

/**
 * @param {any} vtable
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_progresswatcher(vtable) {
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_progresswatcher(vtable);
}

/**
 * @param {any} vtable
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_qrloginprogresslistener(vtable) {
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_qrloginprogresslistener(vtable);
}

/**
 * @param {any} vtable
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_recoverystatelistener(vtable) {
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_recoverystatelistener(vtable);
}

/**
 * @param {any} vtable
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_roomaccountdatalistener(vtable) {
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_roomaccountdatalistener(vtable);
}

/**
 * @param {any} vtable
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_roomdirectorysearchentrieslistener(vtable) {
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_roomdirectorysearchentrieslistener(vtable);
}

/**
 * @param {any} vtable
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_roominfolistener(vtable) {
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_roominfolistener(vtable);
}

/**
 * @param {any} vtable
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_roomlistentrieslistener(vtable) {
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_roomlistentrieslistener(vtable);
}

/**
 * @param {any} vtable
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_roomlistloadingstatelistener(vtable) {
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_roomlistloadingstatelistener(vtable);
}

/**
 * @param {any} vtable
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_roomlistservicestatelistener(vtable) {
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_roomlistservicestatelistener(vtable);
}

/**
 * @param {any} vtable
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_roomlistservicesyncindicatorlistener(vtable) {
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_roomlistservicesyncindicatorlistener(vtable);
}

/**
 * @param {any} vtable
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_sendqueuelistener(vtable) {
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_sendqueuelistener(vtable);
}

/**
 * @param {any} vtable
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_sendqueueroomerrorlistener(vtable) {
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_sendqueueroomerrorlistener(vtable);
}

/**
 * @param {any} vtable
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_sendqueueroomupdatelistener(vtable) {
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_sendqueueroomupdatelistener(vtable);
}

/**
 * @param {any} vtable
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_sessionverificationcontrollerdelegate(vtable) {
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_sessionverificationcontrollerdelegate(vtable);
}

/**
 * @param {any} vtable
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_spaceroomlistentrieslistener(vtable) {
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_spaceroomlistentrieslistener(vtable);
}

/**
 * @param {any} vtable
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_spaceroomlistpaginationstatelistener(vtable) {
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_spaceroomlistpaginationstatelistener(vtable);
}

/**
 * @param {any} vtable
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_spaceroomlistspacelistener(vtable) {
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_spaceroomlistspacelistener(vtable);
}

/**
 * @param {any} vtable
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_spaceservicejoinedspaceslistener(vtable) {
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_spaceservicejoinedspaceslistener(vtable);
}

/**
 * @param {any} vtable
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_spaceservicespacefilterslistener(vtable) {
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_spaceservicespacefilterslistener(vtable);
}

/**
 * @param {any} vtable
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_synclistenerv2(vtable) {
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_synclistenerv2(vtable);
}

/**
 * @param {any} vtable
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_syncnotificationlistener(vtable) {
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_syncnotificationlistener(vtable);
}

/**
 * @param {any} vtable
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_syncservicestateobserver(vtable) {
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_syncservicestateobserver(vtable);
}

/**
 * @param {any} vtable
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_threadlistentrieslistener(vtable) {
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_threadlistentrieslistener(vtable);
}

/**
 * @param {any} vtable
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_threadlistpaginationstatelistener(vtable) {
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_threadlistpaginationstatelistener(vtable);
}

/**
 * @param {any} vtable
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_timelinelistener(vtable) {
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_timelinelistener(vtable);
}

/**
 * @param {any} vtable
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_typingnotificationslistener(vtable) {
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_typingnotificationslistener(vtable);
}

/**
 * @param {any} vtable
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_unabletodecryptdelegate(vtable) {
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_unabletodecryptdelegate(vtable);
}

/**
 * @param {any} vtable
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_verificationstatelistener(vtable) {
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_verificationstatelistener(vtable);
}

/**
 * @param {any} vtable
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_widgetcapabilitiesprovider(vtable) {
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_init_callback_vtable_widgetcapabilitiesprovider(vtable);
}

/**
 * @param {bigint} ptr
 * @param {number} code
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_checkcodesender_send(ptr, code) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_checkcodesender_send(ptr, code);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {bigint} authorization_data
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_abort_oauth_auth(ptr, authorization_data) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_abort_oauth_auth(ptr, authorization_data);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} event_type
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_account_data(ptr, event_type) {
    const ptr0 = passArray8ToWasm0(event_type, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_account_data(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} action
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_account_url(ptr, action) {
    const ptr0 = passArray8ToWasm0(action, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_account_url(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_available_sliding_sync_versions(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_available_sliding_sync_versions(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_avatar_url(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_avatar_url(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} room_id
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_await_room_remote_echo(ptr, room_id) {
    const ptr0 = passArray8ToWasm0(room_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_await_room_remote_echo(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_cached_avatar_url(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_cached_avatar_url(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_can_deactivate_account(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_can_deactivate_account(ptr, f_status_.__wbg_ptr);
    return ret;
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} sync_service
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_clear_caches(ptr, sync_service) {
    const ptr0 = passArray8ToWasm0(sync_service, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_clear_caches(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} request
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_create_room(ptr, request) {
    const ptr0 = passArray8ToWasm0(request, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_create_room(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} jwt
 * @param {Uint8Array} initial_device_name
 * @param {Uint8Array} device_id
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_custom_login_with_jwt(ptr, jwt, initial_device_name, device_id) {
    const ptr0 = passArray8ToWasm0(jwt, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(initial_device_name, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArray8ToWasm0(device_id, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_custom_login_with_jwt(ptr, ptr0, len0, ptr1, len1, ptr2, len2);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} auth_data
 * @param {number} erase_data
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_deactivate_account(ptr, auth_data, erase_data) {
    const ptr0 = passArray8ToWasm0(auth_data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_deactivate_account(ptr, ptr0, len0, erase_data);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} identifiers
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_delete_pusher(ptr, identifiers) {
    const ptr0 = passArray8ToWasm0(identifiers, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_delete_pusher(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_device_id(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_device_id(ptr, f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_display_name(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_display_name(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {number} enable
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_enable_all_send_queues(ptr, enable) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_enable_all_send_queues(ptr, enable);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_enable_automatic_backpagination(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_enable_automatic_backpagination(ptr, f_status_.__wbg_ptr);
}

/**
 * @param {bigint} ptr
 * @param {number} enable
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_enable_send_queue_upload_progress(ptr, enable, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_enable_send_queue_upload_progress(ptr, enable, f_status_.__wbg_ptr);
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_encryption(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_encryption(ptr, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_fetch_media_preview_config(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_fetch_media_preview_config(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} user_id
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_get_dm_room(ptr, user_id, f_status_) {
    const ptr0 = passArray8ToWasm0(user_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_get_dm_room(ptr, ptr0, len0, f_status_.__wbg_ptr);
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} user_id
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_get_dm_rooms(ptr, user_id, f_status_) {
    const ptr0 = passArray8ToWasm0(user_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_get_dm_rooms(ptr, ptr0, len0, f_status_.__wbg_ptr);
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_get_invite_avatars_display_policy(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_get_invite_avatars_display_policy(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_get_max_media_upload_size(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_get_max_media_upload_size(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {bigint} media_source
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_get_media_content(ptr, media_source) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_get_media_content(ptr, media_source);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {bigint} media_source
 * @param {Uint8Array} filename
 * @param {Uint8Array} mime_type
 * @param {number} use_cache
 * @param {Uint8Array} temp_dir
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_get_media_file(ptr, media_source, filename, mime_type, use_cache, temp_dir) {
    const ptr0 = passArray8ToWasm0(filename, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(mime_type, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArray8ToWasm0(temp_dir, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_get_media_file(ptr, media_source, ptr0, len0, ptr1, len1, use_cache, ptr2, len2);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_get_media_preview_display_policy(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_get_media_preview_display_policy(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {bigint} media_source
 * @param {bigint} width
 * @param {bigint} height
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_get_media_thumbnail(ptr, media_source, width, height) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_get_media_thumbnail(ptr, media_source, width, height);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_get_notification_settings(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_get_notification_settings(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} user_id
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_get_profile(ptr, user_id) {
    const ptr0 = passArray8ToWasm0(user_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_get_profile(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_get_recently_visited_rooms(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_get_recently_visited_rooms(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} room_id
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_get_room(ptr, room_id, f_status_) {
    const ptr0 = passArray8ToWasm0(room_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_get_room(ptr, ptr0, len0, f_status_.__wbg_ptr);
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} room_alias
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_get_room_preview_from_room_alias(ptr, room_alias) {
    const ptr0 = passArray8ToWasm0(room_alias, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_get_room_preview_from_room_alias(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} room_id
 * @param {Uint8Array} via_servers
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_get_room_preview_from_room_id(ptr, room_id, via_servers) {
    const ptr0 = passArray8ToWasm0(room_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(via_servers, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_get_room_preview_from_room_id(ptr, ptr0, len0, ptr1, len1);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_get_session_verification_controller(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_get_session_verification_controller(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_get_store_sizes(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_get_store_sizes(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} url
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_get_url(ptr, url) {
    const ptr0 = passArray8ToWasm0(url, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_get_url(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_homeserver(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_homeserver(ptr, f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_homeserver_capabilities(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_homeserver_capabilities(ptr, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_homeserver_login_details(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_homeserver_login_details(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} user_id
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_ignore_user(ptr, user_id) {
    const ptr0 = passArray8ToWasm0(user_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_ignore_user(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_ignored_users(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_ignored_users(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_is_livekit_rtc_supported(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_is_livekit_rtc_supported(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_is_login_with_qr_code_supported(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_is_login_with_qr_code_supported(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_is_report_room_api_supported(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_is_report_room_api_supported(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} alias
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_is_room_alias_available(ptr, alias) {
    const ptr0 = passArray8ToWasm0(alias, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_is_room_alias_available(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} room_id
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_join_room_by_id(ptr, room_id) {
    const ptr0 = passArray8ToWasm0(room_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_join_room_by_id(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} room_id_or_alias
 * @param {Uint8Array} server_names
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_join_room_by_id_or_alias(ptr, room_id_or_alias, server_names) {
    const ptr0 = passArray8ToWasm0(room_id_or_alias, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(server_names, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_join_room_by_id_or_alias(ptr, ptr0, len0, ptr1, len1);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} room_id_or_alias
 * @param {Uint8Array} reason
 * @param {Uint8Array} server_names
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_knock(ptr, room_id_or_alias, reason, server_names) {
    const ptr0 = passArray8ToWasm0(room_id_or_alias, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(reason, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArray8ToWasm0(server_names, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_knock(ptr, ptr0, len0, ptr1, len1, ptr2, len2);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} username
 * @param {Uint8Array} password
 * @param {Uint8Array} initial_device_name
 * @param {Uint8Array} device_id
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_login(ptr, username, password, initial_device_name, device_id) {
    const ptr0 = passArray8ToWasm0(username, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(password, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArray8ToWasm0(initial_device_name, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ptr3 = passArray8ToWasm0(device_id, wasm.__wbindgen_malloc);
    const len3 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_login(ptr, ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} email
 * @param {Uint8Array} password
 * @param {Uint8Array} initial_device_name
 * @param {Uint8Array} device_id
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_login_with_email(ptr, email, password, initial_device_name, device_id) {
    const ptr0 = passArray8ToWasm0(email, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(password, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArray8ToWasm0(initial_device_name, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ptr3 = passArray8ToWasm0(device_id, wasm.__wbindgen_malloc);
    const len3 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_login_with_email(ptr, ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} callback_url
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_login_with_oauth_callback(ptr, callback_url) {
    const ptr0 = passArray8ToWasm0(callback_url, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_login_with_oauth_callback(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_logout(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_logout(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_mark_all_rooms_as_read(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_mark_all_rooms_as_read(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_new_grant_login_with_qr_code_handler(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_new_grant_login_with_qr_code_handler(ptr, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} oauth_configuration
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_new_login_with_qr_code_handler(ptr, oauth_configuration, f_status_) {
    const ptr0 = passArray8ToWasm0(oauth_configuration, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_new_login_with_qr_code_handler(ptr, ptr0, len0, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} process_setup
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_notification_client(ptr, process_setup) {
    const ptr0 = passArray8ToWasm0(process_setup, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_notification_client(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} event_type
 * @param {bigint} listener
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_observe_account_data_event(ptr, event_type, listener, f_status_) {
    const ptr0 = passArray8ToWasm0(event_type, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_observe_account_data_event(ptr, ptr0, len0, listener, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} room_id
 * @param {Uint8Array} event_type
 * @param {bigint} listener
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_observe_room_account_data_event(ptr, room_id, event_type, listener, f_status_) {
    const ptr0 = passArray8ToWasm0(room_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(event_type, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_observe_room_account_data_event(ptr, ptr0, len0, ptr1, len1, listener, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_optimize_stores(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_optimize_stores(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_pause(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_pause(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {bigint} listener
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_register_notification_handler(ptr, listener) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_register_notification_handler(ptr, listener);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_remove_avatar(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_remove_avatar(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_request_openid_token(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_request_openid_token(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_reset_supported_versions(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_reset_supported_versions(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_reset_well_known(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_reset_well_known(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} room_alias
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_resolve_room_alias(ptr, room_alias) {
    const ptr0 = passArray8ToWasm0(room_alias, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_resolve_room_alias(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} session
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_restore_session(ptr, session) {
    const ptr0 = passArray8ToWasm0(session, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_restore_session(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} session
 * @param {Uint8Array} room_load_settings
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_restore_session_with(ptr, session, room_load_settings) {
    const ptr0 = passArray8ToWasm0(session, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(room_load_settings, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_restore_session_with(ptr, ptr0, len0, ptr1, len1);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_resume(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_resume(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} room_alias
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_room_alias_exists(ptr, room_alias) {
    const ptr0 = passArray8ToWasm0(room_alias, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_room_alias_exists(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_room_directory_search(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_room_directory_search(ptr, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_rooms(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_rooms(ptr, f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} search_term
 * @param {bigint} limit
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_search_users(ptr, search_term, limit) {
    const ptr0 = passArray8ToWasm0(search_term, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_search_users(ptr, ptr0, len0, limit);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_server(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_server(ptr, f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_server_vendor_info(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_server_vendor_info(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_session(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_session(ptr, f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} event_type
 * @param {Uint8Array} content
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_set_account_data(ptr, event_type, content) {
    const ptr0 = passArray8ToWasm0(event_type, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(content, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_set_account_data(ptr, ptr0, len0, ptr1, len1);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} url
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_set_avatar_url(ptr, url) {
    const ptr0 = passArray8ToWasm0(url, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_set_avatar_url(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} delegate
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_set_delegate(ptr, delegate, f_status_) {
    const ptr0 = passArray8ToWasm0(delegate, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_set_delegate(ptr, ptr0, len0, f_status_.__wbg_ptr);
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} name
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_set_display_name(ptr, name) {
    const ptr0 = passArray8ToWasm0(name, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_set_display_name(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} policy
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_set_invite_avatars_display_policy(ptr, policy) {
    const ptr0 = passArray8ToWasm0(policy, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_set_invite_avatars_display_policy(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} policy
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_set_media_preview_display_policy(ptr, policy) {
    const ptr0 = passArray8ToWasm0(policy, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_set_media_preview_display_policy(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} policy
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_set_media_retention_policy(ptr, policy) {
    const ptr0 = passArray8ToWasm0(policy, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_set_media_retention_policy(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} identifiers
 * @param {Uint8Array} kind
 * @param {Uint8Array} app_display_name
 * @param {Uint8Array} device_display_name
 * @param {Uint8Array} profile_tag
 * @param {Uint8Array} lang
 * @param {number} append
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_set_pusher(ptr, identifiers, kind, app_display_name, device_display_name, profile_tag, lang, append) {
    const ptr0 = passArray8ToWasm0(identifiers, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(kind, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArray8ToWasm0(app_display_name, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ptr3 = passArray8ToWasm0(device_display_name, wasm.__wbindgen_malloc);
    const len3 = WASM_VECTOR_LEN;
    const ptr4 = passArray8ToWasm0(profile_tag, wasm.__wbindgen_malloc);
    const len4 = WASM_VECTOR_LEN;
    const ptr5 = passArray8ToWasm0(lang, wasm.__wbindgen_malloc);
    const len5 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_set_pusher(ptr, ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4, ptr5, len5, append);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {bigint} utd_delegate
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_set_utd_delegate(ptr, utd_delegate) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_set_utd_delegate(ptr, utd_delegate);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_sliding_sync_version(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_sliding_sync_version(ptr, f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_space_service(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_space_service(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} redirect_url
 * @param {Uint8Array} idp_id
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_start_sso_login(ptr, redirect_url, idp_id) {
    const ptr0 = passArray8ToWasm0(redirect_url, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(idp_id, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_start_sso_login(ptr, ptr0, len0, ptr1, len1);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {bigint} listener
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_subscribe_to_duplicate_key_upload_errors(ptr, listener, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_subscribe_to_duplicate_key_upload_errors(ptr, listener, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {bigint} listener
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_subscribe_to_ignored_users(ptr, listener, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_subscribe_to_ignored_users(ptr, listener, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {bigint} listener
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_subscribe_to_media_preview_config(ptr, listener) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_subscribe_to_media_preview_config(ptr, listener);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {bigint} listener
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_subscribe_to_own_beacon_info_updates(ptr, listener, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_subscribe_to_own_beacon_info_updates(ptr, listener, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} room_id
 * @param {bigint} listener
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_subscribe_to_room_info(ptr, room_id, listener) {
    const ptr0 = passArray8ToWasm0(room_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_subscribe_to_room_info(ptr, ptr0, len0, listener);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {bigint} listener
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_subscribe_to_send_queue_status(ptr, listener, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_subscribe_to_send_queue_status(ptr, listener, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {bigint} listener
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_subscribe_to_send_queue_updates(ptr, listener) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_subscribe_to_send_queue_updates(ptr, listener);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} settings
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_sync_once_v2(ptr, settings) {
    const ptr0 = passArray8ToWasm0(settings, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_sync_once_v2(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_sync_service(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_sync_service(ptr, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} settings
 * @param {bigint} listener
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_sync_v2(ptr, settings, listener, f_status_) {
    const ptr0 = passArray8ToWasm0(settings, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_sync_v2(ptr, ptr0, len0, listener, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_tile_server(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_tile_server(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} room
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_track_recently_visited_room(ptr, room) {
    const ptr0 = passArray8ToWasm0(room, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_track_recently_visited_room(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} user_id
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_unignore_user(ptr, user_id) {
    const ptr0 = passArray8ToWasm0(user_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_unignore_user(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} mime_type
 * @param {Uint8Array} data
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_upload_avatar(ptr, mime_type, data) {
    const ptr0 = passArray8ToWasm0(mime_type, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_upload_avatar(ptr, ptr0, len0, ptr1, len1);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} mime_type
 * @param {Uint8Array} data
 * @param {Uint8Array} progress_watcher
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_upload_media(ptr, mime_type, data, progress_watcher) {
    const ptr0 = passArray8ToWasm0(mime_type, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArray8ToWasm0(progress_watcher, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_upload_media(ptr, ptr0, len0, ptr1, len1, ptr2, len2);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} oauth_configuration
 * @param {Uint8Array} prompt
 * @param {Uint8Array} login_hint
 * @param {Uint8Array} device_id
 * @param {Uint8Array} additional_scopes
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_url_for_oauth(ptr, oauth_configuration, prompt, login_hint, device_id, additional_scopes) {
    const ptr0 = passArray8ToWasm0(oauth_configuration, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(prompt, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArray8ToWasm0(login_hint, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ptr3 = passArray8ToWasm0(device_id, wasm.__wbindgen_malloc);
    const len3 = WASM_VECTOR_LEN;
    const ptr4 = passArray8ToWasm0(additional_scopes, wasm.__wbindgen_malloc);
    const len4 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_url_for_oauth(ptr, ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_user_id(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_user_id(ptr, f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_client_user_id_server_name(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_client_user_id_server_name(ptr, f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} certificates
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_clientbuilder_add_root_certificates(ptr, certificates, f_status_) {
    const ptr0 = passArray8ToWasm0(certificates, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_clientbuilder_add_root_certificates(ptr, ptr0, len0, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {number} auto_enable_backups
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_clientbuilder_auto_enable_backups(ptr, auto_enable_backups, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_clientbuilder_auto_enable_backups(ptr, auto_enable_backups, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {number} auto_enable_cross_signing
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_clientbuilder_auto_enable_cross_signing(ptr, auto_enable_cross_signing, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_clientbuilder_auto_enable_cross_signing(ptr, auto_enable_cross_signing, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} backup_download_strategy
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_clientbuilder_backup_download_strategy(ptr, backup_download_strategy, f_status_) {
    const ptr0 = passArray8ToWasm0(backup_download_strategy, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_clientbuilder_backup_download_strategy(ptr, ptr0, len0, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_clientbuilder_build(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_clientbuilder_build(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} cross_process_lock_config
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_clientbuilder_cross_process_lock_config(ptr, cross_process_lock_config, f_status_) {
    const ptr0 = passArray8ToWasm0(cross_process_lock_config, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_clientbuilder_cross_process_lock_config(ptr, ptr0, len0, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} decryption_settings
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_clientbuilder_decryption_settings(ptr, decryption_settings, f_status_) {
    const ptr0 = passArray8ToWasm0(decryption_settings, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_clientbuilder_decryption_settings(ptr, ptr0, len0, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_clientbuilder_disable_automatic_token_refresh(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_clientbuilder_disable_automatic_token_refresh(ptr, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_clientbuilder_disable_built_in_root_certificates(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_clientbuilder_disable_built_in_root_certificates(ptr, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_clientbuilder_disable_ssl_verification(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_clientbuilder_disable_ssl_verification(ptr, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} dm_room_definition
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_clientbuilder_dm_room_definition(ptr, dm_room_definition, f_status_) {
    const ptr0 = passArray8ToWasm0(dm_room_definition, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_clientbuilder_dm_room_definition(ptr, ptr0, len0, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {number} enable_share_history_on_invite
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_clientbuilder_enable_share_history_on_invite(ptr, enable_share_history_on_invite, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_clientbuilder_enable_share_history_on_invite(ptr, enable_share_history_on_invite, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} url
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_clientbuilder_homeserver_url(ptr, url, f_status_) {
    const ptr0 = passArray8ToWasm0(url, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_clientbuilder_homeserver_url(ptr, ptr0, len0, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_clientbuilder_in_memory_store(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_clientbuilder_in_memory_store(ptr, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {bigint} config
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_clientbuilder_indexeddb_store(ptr, config, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_clientbuilder_indexeddb_store(ptr, config, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} url
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_clientbuilder_proxy(ptr, url, f_status_) {
    const ptr0 = passArray8ToWasm0(url, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_clientbuilder_proxy(ptr, ptr0, len0, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} config
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_clientbuilder_request_config(ptr, config, f_status_) {
    const ptr0 = passArray8ToWasm0(config, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_clientbuilder_request_config(ptr, ptr0, len0, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} strategy
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_clientbuilder_room_key_recipient_strategy(ptr, strategy, f_status_) {
    const ptr0 = passArray8ToWasm0(strategy, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_clientbuilder_room_key_recipient_strategy(ptr, ptr0, len0, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} server_name
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_clientbuilder_server_name(ptr, server_name, f_status_) {
    const ptr0 = passArray8ToWasm0(server_name, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_clientbuilder_server_name(ptr, ptr0, len0, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} server_name_or_url
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_clientbuilder_server_name_or_homeserver_url(ptr, server_name_or_url, f_status_) {
    const ptr0 = passArray8ToWasm0(server_name_or_url, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_clientbuilder_server_name_or_homeserver_url(ptr, ptr0, len0, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {bigint} session_delegate
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_clientbuilder_set_session_delegate(ptr, session_delegate, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_clientbuilder_set_session_delegate(ptr, session_delegate, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} version_builder
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_clientbuilder_sliding_sync_version_builder(ptr, version_builder, f_status_) {
    const ptr0 = passArray8ToWasm0(version_builder, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_clientbuilder_sliding_sync_version_builder(ptr, ptr0, len0, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_clientbuilder_system_is_memory_constrained(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_clientbuilder_system_is_memory_constrained(ptr, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {number} enabled
 * @param {number} thread_subscriptions
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_clientbuilder_threads_enabled(ptr, enabled, thread_subscriptions, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_clientbuilder_threads_enabled(ptr, enabled, thread_subscriptions, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} user_agent
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_clientbuilder_user_agent(ptr, user_agent, f_status_) {
    const ptr0 = passArray8ToWasm0(user_agent, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_clientbuilder_user_agent(ptr, ptr0, len0, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} username
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_clientbuilder_username(ptr, username, f_status_) {
    const ptr0 = passArray8ToWasm0(username, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_clientbuilder_username(ptr, ptr0, len0, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_encryption_backup_exists_on_server(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_encryption_backup_exists_on_server(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_encryption_backup_state(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_encryption_backup_state(ptr, f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {bigint} ptr
 * @param {bigint} listener
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_encryption_backup_state_listener(ptr, listener, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_encryption_backup_state_listener(ptr, listener, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_encryption_curve25519_key(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_encryption_curve25519_key(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_encryption_disable_recovery(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_encryption_disable_recovery(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_encryption_ed25519_key(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_encryption_ed25519_key(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_encryption_enable_backups(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_encryption_enable_backups(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {number} wait_for_backups_to_upload
 * @param {Uint8Array} passphrase
 * @param {bigint} progress_listener
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_encryption_enable_recovery(ptr, wait_for_backups_to_upload, passphrase, progress_listener) {
    const ptr0 = passArray8ToWasm0(passphrase, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_encryption_enable_recovery(ptr, wait_for_backups_to_upload, ptr0, len0, progress_listener);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_encryption_has_devices_to_verify_against(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_encryption_has_devices_to_verify_against(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {bigint} secrets_bundle
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_encryption_import_secrets_bundle(ptr, secrets_bundle) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_encryption_import_secrets_bundle(ptr, secrets_bundle);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_encryption_is_last_device(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_encryption_is_last_device(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} recovery_key
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_encryption_recover(ptr, recovery_key) {
    const ptr0 = passArray8ToWasm0(recovery_key, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_encryption_recover(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} recovery_key
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_encryption_recover_and_fix_backup(ptr, recovery_key) {
    const ptr0 = passArray8ToWasm0(recovery_key, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_encryption_recover_and_fix_backup(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} old_recovery_key
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_encryption_recover_and_reset(ptr, old_recovery_key) {
    const ptr0 = passArray8ToWasm0(old_recovery_key, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_encryption_recover_and_reset(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_encryption_recovery_state(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_encryption_recovery_state(ptr, f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {bigint} ptr
 * @param {bigint} listener
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_encryption_recovery_state_listener(ptr, listener, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_encryption_recovery_state_listener(ptr, listener, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_encryption_reset_identity(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_encryption_reset_identity(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_encryption_reset_recovery_key(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_encryption_reset_recovery_key(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} user_id
 * @param {number} fallback_to_server
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_encryption_user_identity(ptr, user_id, fallback_to_server) {
    const ptr0 = passArray8ToWasm0(user_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_encryption_user_identity(ptr, ptr0, len0, fallback_to_server);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_encryption_verification_state(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_encryption_verification_state(ptr, f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {bigint} ptr
 * @param {bigint} listener
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_encryption_verification_state_listener(ptr, listener, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_encryption_verification_state_listener(ptr, listener, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} progress_listener
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_encryption_wait_for_backup_upload_steady_state(ptr, progress_listener) {
    const ptr0 = passArray8ToWasm0(progress_listener, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_encryption_wait_for_backup_upload_steady_state(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_encryption_wait_for_e2ee_initialization_tasks(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_encryption_wait_for_e2ee_initialization_tasks(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {bigint} progress_listener
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_grantloginwithqrcodehandler_generate(ptr, progress_listener) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_grantloginwithqrcodehandler_generate(ptr, progress_listener);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {bigint} qr_code_data
 * @param {bigint} progress_listener
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_grantloginwithqrcodehandler_scan(ptr, qr_code_data, progress_listener) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_grantloginwithqrcodehandler_scan(ptr, qr_code_data, progress_listener);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_homeservercapabilities_can_change_avatar(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_homeservercapabilities_can_change_avatar(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_homeservercapabilities_can_change_displayname(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_homeservercapabilities_can_change_displayname(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_homeservercapabilities_can_change_password(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_homeservercapabilities_can_change_password(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_homeservercapabilities_can_change_thirdparty_ids(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_homeservercapabilities_can_change_thirdparty_ids(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_homeservercapabilities_can_get_login_token(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_homeservercapabilities_can_get_login_token(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_homeservercapabilities_extended_profile_fields(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_homeservercapabilities_extended_profile_fields(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_homeservercapabilities_forgets_room_when_leaving(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_homeservercapabilities_forgets_room_when_leaving(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_homeservercapabilities_refresh(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_homeservercapabilities_refresh(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_homeserverlogindetails_sliding_sync_version(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_homeserverlogindetails_sliding_sync_version(ptr, f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_homeserverlogindetails_supported_oauth_prompts(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_homeserverlogindetails_supported_oauth_prompts(ptr, f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_homeserverlogindetails_supports_oauth_login(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_homeserverlogindetails_supports_oauth_login(ptr, f_status_.__wbg_ptr);
    return ret;
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_homeserverlogindetails_supports_password_login(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_homeserverlogindetails_supports_password_login(ptr, f_status_.__wbg_ptr);
    return ret;
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_homeserverlogindetails_supports_sso_login(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_homeserverlogindetails_supports_sso_login(ptr, f_status_.__wbg_ptr);
    return ret;
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_homeserverlogindetails_url(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_homeserverlogindetails_url(ptr, f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_identityresethandle_auth_type(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_identityresethandle_auth_type(ptr, f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_identityresethandle_cancel(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_identityresethandle_cancel(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} auth
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_identityresethandle_reset(ptr, auth) {
    const ptr0 = passArray8ToWasm0(auth, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_identityresethandle_reset(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} passphrase
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_indexeddbstorebuilder_passphrase(ptr, passphrase, f_status_) {
    const ptr0 = passArray8ToWasm0(passphrase, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_indexeddbstorebuilder_passphrase(ptr, ptr0, len0, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_inreplytodetails_event(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_inreplytodetails_event(ptr, f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_inreplytodetails_event_id(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_inreplytodetails_event_id(ptr, f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_knockrequestactions_accept(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_knockrequestactions_accept(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} reason
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_knockrequestactions_decline(ptr, reason) {
    const ptr0 = passArray8ToWasm0(reason, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_knockrequestactions_decline(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} reason
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_knockrequestactions_decline_and_ban(ptr, reason) {
    const ptr0 = passArray8ToWasm0(reason, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_knockrequestactions_decline_and_ban(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_knockrequestactions_mark_as_seen(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_knockrequestactions_mark_as_seen(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_lazytimelineitemprovider_contains_only_emojis(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_lazytimelineitemprovider_contains_only_emojis(ptr, f_status_.__wbg_ptr);
    return ret;
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_lazytimelineitemprovider_debug_info(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_lazytimelineitemprovider_debug_info(ptr, f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_lazytimelineitemprovider_get_send_handle(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_lazytimelineitemprovider_get_send_handle(ptr, f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {bigint} ptr
 * @param {number} strict
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_lazytimelineitemprovider_get_shields(ptr, strict, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_lazytimelineitemprovider_get_shields(ptr, strict, f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_lazytimelineitemprovider_latest_json(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_lazytimelineitemprovider_latest_json(ptr, f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} room_ids
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_leavespacehandle_leave(ptr, room_ids) {
    const ptr0 = passArray8ToWasm0(room_ids, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_leavespacehandle_leave(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_leavespacehandle_rooms(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_leavespacehandle_rooms(ptr, f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {bigint} ptr
 * @param {bigint} listener
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_livelocationsobserver_subscribe(ptr, listener, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_livelocationsobserver_subscribe(ptr, listener, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {bigint} progress_listener
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_loginwithqrcodehandler_generate(ptr, progress_listener) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_loginwithqrcodehandler_generate(ptr, progress_listener);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {bigint} qr_code_data
 * @param {bigint} progress_listener
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_loginwithqrcodehandler_scan(ptr, qr_code_data, progress_listener) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_loginwithqrcodehandler_scan(ptr, qr_code_data, progress_listener);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_mediafilehandle_path(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_mediafilehandle_path(ptr, f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} path
 * @param {RustCallStatus} f_status_
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_mediafilehandle_persist(ptr, path, f_status_) {
    const ptr0 = passArray8ToWasm0(path, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_mediafilehandle_persist(ptr, ptr0, len0, f_status_.__wbg_ptr);
    return ret;
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_mediasource_to_json(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_mediasource_to_json(ptr, f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_mediasource_url(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_mediasource_url(ptr, f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} room_id
 * @param {Uint8Array} event_id
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_notificationclient_get_notification(ptr, room_id, event_id) {
    const ptr0 = passArray8ToWasm0(room_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(event_id, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_notificationclient_get_notification(ptr, ptr0, len0, ptr1, len1);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} requests
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_notificationclient_get_notifications(ptr, requests) {
    const ptr0 = passArray8ToWasm0(requests, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_notificationclient_get_notifications(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} room_id
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_notificationclient_get_room(ptr, room_id, f_status_) {
    const ptr0 = passArray8ToWasm0(room_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_notificationclient_get_room(ptr, ptr0, len0, f_status_.__wbg_ptr);
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_notificationsettings_can_homeserver_push_encrypted_event_to_device(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_notificationsettings_can_homeserver_push_encrypted_event_to_device(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_notificationsettings_can_push_encrypted_event_to_device(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_notificationsettings_can_push_encrypted_event_to_device(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_notificationsettings_contains_keywords_rules(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_notificationsettings_contains_keywords_rules(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {number} is_encrypted
 * @param {number} is_one_to_one
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_notificationsettings_get_default_room_notification_mode(ptr, is_encrypted, is_one_to_one) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_notificationsettings_get_default_room_notification_mode(ptr, is_encrypted, is_one_to_one);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_notificationsettings_get_raw_push_rules(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_notificationsettings_get_raw_push_rules(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} room_id
 * @param {number} is_encrypted
 * @param {number} is_one_to_one
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_notificationsettings_get_room_notification_settings(ptr, room_id, is_encrypted, is_one_to_one) {
    const ptr0 = passArray8ToWasm0(room_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_notificationsettings_get_room_notification_settings(ptr, ptr0, len0, is_encrypted, is_one_to_one);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} enabled
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_notificationsettings_get_rooms_with_user_defined_rules(ptr, enabled) {
    const ptr0 = passArray8ToWasm0(enabled, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_notificationsettings_get_rooms_with_user_defined_rules(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} room_id
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_notificationsettings_get_user_defined_room_notification_mode(ptr, room_id) {
    const ptr0 = passArray8ToWasm0(room_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_notificationsettings_get_user_defined_room_notification_mode(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_notificationsettings_is_call_enabled(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_notificationsettings_is_call_enabled(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_notificationsettings_is_invite_for_me_enabled(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_notificationsettings_is_invite_for_me_enabled(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_notificationsettings_is_room_mention_enabled(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_notificationsettings_is_room_mention_enabled(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_notificationsettings_is_user_mention_enabled(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_notificationsettings_is_user_mention_enabled(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} room_id
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_notificationsettings_restore_default_room_notification_mode(ptr, room_id) {
    const ptr0 = passArray8ToWasm0(room_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_notificationsettings_restore_default_room_notification_mode(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {number} enabled
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_notificationsettings_set_call_enabled(ptr, enabled) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_notificationsettings_set_call_enabled(ptr, enabled);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} rule_id
 * @param {Uint8Array} rule_kind
 * @param {Uint8Array} actions
 * @param {Uint8Array} conditions
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_notificationsettings_set_custom_push_rule(ptr, rule_id, rule_kind, actions, conditions) {
    const ptr0 = passArray8ToWasm0(rule_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(rule_kind, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArray8ToWasm0(actions, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ptr3 = passArray8ToWasm0(conditions, wasm.__wbindgen_malloc);
    const len3 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_notificationsettings_set_custom_push_rule(ptr, ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {number} is_encrypted
 * @param {number} is_one_to_one
 * @param {Uint8Array} mode
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_notificationsettings_set_default_room_notification_mode(ptr, is_encrypted, is_one_to_one, mode) {
    const ptr0 = passArray8ToWasm0(mode, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_notificationsettings_set_default_room_notification_mode(ptr, is_encrypted, is_one_to_one, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} delegate
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_notificationsettings_set_delegate(ptr, delegate, f_status_) {
    const ptr0 = passArray8ToWasm0(delegate, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_notificationsettings_set_delegate(ptr, ptr0, len0, f_status_.__wbg_ptr);
}

/**
 * @param {bigint} ptr
 * @param {number} enabled
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_notificationsettings_set_invite_for_me_enabled(ptr, enabled) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_notificationsettings_set_invite_for_me_enabled(ptr, enabled);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {number} enabled
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_notificationsettings_set_room_mention_enabled(ptr, enabled) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_notificationsettings_set_room_mention_enabled(ptr, enabled);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} room_id
 * @param {Uint8Array} mode
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_notificationsettings_set_room_notification_mode(ptr, room_id, mode) {
    const ptr0 = passArray8ToWasm0(room_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(mode, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_notificationsettings_set_room_notification_mode(ptr, ptr0, len0, ptr1, len1);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {number} enabled
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_notificationsettings_set_user_mention_enabled(ptr, enabled) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_notificationsettings_set_user_mention_enabled(ptr, enabled);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} room_id
 * @param {number} is_encrypted
 * @param {number} is_one_to_one
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_notificationsettings_unmute_room(ptr, room_id, is_encrypted, is_one_to_one) {
    const ptr0 = passArray8ToWasm0(room_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_notificationsettings_unmute_room(ptr, ptr0, len0, is_encrypted, is_one_to_one);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_qrcodedata_base_url(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_qrcodedata_base_url(ptr, f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_qrcodedata_intent(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_qrcodedata_intent(ptr, f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_qrcodedata_server_name(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_qrcodedata_server_name(ptr, f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_qrcodedata_to_bytes(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_qrcodedata_to_bytes(ptr, f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_active_members_count(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_active_members_count(ptr, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_active_room_call_participants(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_active_room_call_participants(ptr, f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_alternative_aliases(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_alternative_aliases(ptr, f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} changes
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_apply_power_level_changes(ptr, changes) {
    const ptr0 = passArray8ToWasm0(changes, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_apply_power_level_changes(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_avatar_url(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_avatar_url(ptr, f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} user_id
 * @param {Uint8Array} reason
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_ban_user(ptr, user_id, reason) {
    const ptr0 = passArray8ToWasm0(user_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(reason, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_ban_user(ptr, ptr0, len0, ptr1, len1);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_canonical_alias(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_canonical_alias(ptr, f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} thread_root
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_clear_composer_draft(ptr, thread_root) {
    const ptr0 = passArray8ToWasm0(thread_root, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_clear_composer_draft(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_clear_event_cache_storage(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_clear_event_cache_storage(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} rtc_notification_event_id
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_decline_call(ptr, rtc_notification_event_id) {
    const ptr0 = passArray8ToWasm0(rtc_notification_event_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_decline_call(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_discard_room_key(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_discard_room_key(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_display_name(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_display_name(ptr, f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} event_id
 * @param {bigint} new_content
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_edit(ptr, event_id, new_content) {
    const ptr0 = passArray8ToWasm0(event_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_edit(ptr, ptr0, len0, new_content);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_enable_encryption(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_enable_encryption(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {number} enable
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_enable_send_queue(ptr, enable, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_enable_send_queue(ptr, enable, f_status_.__wbg_ptr);
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_encryption_state(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_encryption_state(ptr, f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} thread_root_event_id
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_fetch_thread_subscription(ptr, thread_root_event_id) {
    const ptr0 = passArray8ToWasm0(thread_root_event_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_fetch_thread_subscription(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_forget(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_forget(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_get_power_levels(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_get_power_levels(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_get_room_visibility(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_get_room_visibility(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_has_active_room_call(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_has_active_room_call(ptr, f_status_.__wbg_ptr);
    return ret;
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_heroes(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_heroes(ptr, f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_id(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_id(ptr, f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} devices
 * @param {bigint} send_handle
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_ignore_device_trust_and_resend(ptr, devices, send_handle) {
    const ptr0 = passArray8ToWasm0(devices, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_ignore_device_trust_and_resend(ptr, ptr0, len0, send_handle);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} user_id
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_ignore_user(ptr, user_id) {
    const ptr0 = passArray8ToWasm0(user_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_ignore_user(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} user_id
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_invite_user_by_id(ptr, user_id) {
    const ptr0 = passArray8ToWasm0(user_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_invite_user_by_id(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_invited_members_count(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_invited_members_count(ptr, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_inviter(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_inviter(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_is_direct(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_is_direct(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_is_encrypted(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_is_encrypted(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_is_public(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_is_public(ptr, f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_is_send_queue_enabled(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_is_send_queue_enabled(ptr, f_status_.__wbg_ptr);
    return ret;
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_is_space(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_is_space(ptr, f_status_.__wbg_ptr);
    return ret;
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_join(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_join(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_joined_members_count(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_joined_members_count(ptr, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} user_id
 * @param {Uint8Array} reason
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_kick_user(ptr, user_id, reason) {
    const ptr0 = passArray8ToWasm0(user_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(reason, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_kick_user(ptr, ptr0, len0, ptr1, len1);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_latest_encryption_state(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_latest_encryption_state(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_latest_event(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_latest_event(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_leave(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_leave(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_live_locations_observer(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_live_locations_observer(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} thread_root
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_load_composer_draft(ptr, thread_root) {
    const ptr0 = passArray8ToWasm0(thread_root, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_load_composer_draft(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} event_id
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_load_or_fetch_event(ptr, event_id) {
    const ptr0 = passArray8ToWasm0(event_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_load_or_fetch_event(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} event_id
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_mark_as_fully_read_unchecked(ptr, event_id) {
    const ptr0 = passArray8ToWasm0(event_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_mark_as_fully_read_unchecked(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} receipt_type
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_mark_as_read(ptr, receipt_type) {
    const ptr0 = passArray8ToWasm0(receipt_type, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_mark_as_read(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} event_id
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_matrix_to_event_permalink(ptr, event_id) {
    const ptr0 = passArray8ToWasm0(event_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_matrix_to_event_permalink(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_matrix_to_permalink(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_matrix_to_permalink(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} user_id
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_member(ptr, user_id) {
    const ptr0 = passArray8ToWasm0(user_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_member(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} user_id
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_member_avatar_url(ptr, user_id) {
    const ptr0 = passArray8ToWasm0(user_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_member_avatar_url(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} user_id
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_member_display_name(ptr, user_id) {
    const ptr0 = passArray8ToWasm0(user_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_member_display_name(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} user_id
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_member_with_sender_info(ptr, user_id) {
    const ptr0 = passArray8ToWasm0(user_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_member_with_sender_info(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_members(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_members(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_members_no_sync(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_members_no_sync(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_membership(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_membership(ptr, f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_own_user_id(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_own_user_id(ptr, f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_predecessor_room(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_predecessor_room(ptr, f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} via
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_preview_room(ptr, via) {
    const ptr0 = passArray8ToWasm0(via, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_preview_room(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} alias
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_publish_room_alias_in_room_directory(ptr, alias) {
    const ptr0 = passArray8ToWasm0(alias, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_publish_room_alias_in_room_directory(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_raw_name(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_raw_name(ptr, f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} event_id
 * @param {Uint8Array} reason
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_redact(ptr, event_id, reason) {
    const ptr0 = passArray8ToWasm0(event_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(reason, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_redact(ptr, ptr0, len0, ptr1, len1);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_remove_avatar(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_remove_avatar(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} alias
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_remove_room_alias_from_room_directory(ptr, alias) {
    const ptr0 = passArray8ToWasm0(alias, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_remove_room_alias_from_room_directory(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} event_id
 * @param {Uint8Array} reason
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_report_content(ptr, event_id, reason) {
    const ptr0 = passArray8ToWasm0(event_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(reason, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_report_content(ptr, ptr0, len0, ptr1, len1);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} reason
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_report_room(ptr, reason) {
    const ptr0 = passArray8ToWasm0(reason, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_report_room(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_reset_power_levels(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_reset_power_levels(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_room_events_debug_string(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_room_events_debug_string(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_room_info(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_room_info(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} draft
 * @param {Uint8Array} thread_root
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_save_composer_draft(ptr, draft, thread_root) {
    const ptr0 = passArray8ToWasm0(draft, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(thread_root, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_save_composer_draft(ptr, ptr0, len0, ptr1, len1);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} geo_uri
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_send_live_location(ptr, geo_uri) {
    const ptr0 = passArray8ToWasm0(geo_uri, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_send_live_location(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} event_type
 * @param {Uint8Array} content
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_send_raw(ptr, event_type, content) {
    const ptr0 = passArray8ToWasm0(event_type, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(content, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_send_raw(ptr, ptr0, len0, ptr1, len1);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} event_type
 * @param {Uint8Array} state_key
 * @param {Uint8Array} content
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_send_state_event_raw(ptr, event_type, state_key, content) {
    const ptr0 = passArray8ToWasm0(event_type, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(state_key, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArray8ToWasm0(content, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_send_state_event_raw(ptr, ptr0, len0, ptr1, len1, ptr2, len2);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {number} is_favourite
 * @param {Uint8Array} tag_order
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_set_is_favourite(ptr, is_favourite, tag_order) {
    const ptr0 = passArray8ToWasm0(tag_order, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_set_is_favourite(ptr, is_favourite, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {number} is_low_priority
 * @param {Uint8Array} tag_order
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_set_is_low_priority(ptr, is_low_priority, tag_order) {
    const ptr0 = passArray8ToWasm0(tag_order, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_set_is_low_priority(ptr, is_low_priority, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} name
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_set_name(ptr, name) {
    const ptr0 = passArray8ToWasm0(name, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_set_name(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} display_name
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_set_own_member_display_name(ptr, display_name) {
    const ptr0 = passArray8ToWasm0(display_name, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_set_own_member_display_name(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} thread_root_event_id
 * @param {number} subscribed
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_set_thread_subscription(ptr, thread_root_event_id, subscribed) {
    const ptr0 = passArray8ToWasm0(thread_root_event_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_set_thread_subscription(ptr, ptr0, len0, subscribed);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} topic
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_set_topic(ptr, topic) {
    const ptr0 = passArray8ToWasm0(topic, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_set_topic(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {number} new_value
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_set_unread_flag(ptr, new_value) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_set_unread_flag(ptr, new_value);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {bigint} duration_millis
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_start_live_location_share(ptr, duration_millis) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_start_live_location_share(ptr, duration_millis);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_stop_live_location_share(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_stop_live_location_share(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} rtc_notification_event_id
 * @param {bigint} listener
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_subscribe_to_call_decline_events(ptr, rtc_notification_event_id, listener, f_status_) {
    const ptr0 = passArray8ToWasm0(rtc_notification_event_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_subscribe_to_call_decline_events(ptr, ptr0, len0, listener, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {bigint} listener
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_subscribe_to_identity_status_changes(ptr, listener) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_subscribe_to_identity_status_changes(ptr, listener);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {bigint} listener
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_subscribe_to_knock_requests(ptr, listener) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_subscribe_to_knock_requests(ptr, listener);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {bigint} listener
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_subscribe_to_room_info_updates(ptr, listener, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_subscribe_to_room_info_updates(ptr, listener, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {bigint} listener
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_subscribe_to_send_queue_updates(ptr, listener) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_subscribe_to_send_queue_updates(ptr, listener);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {bigint} listener
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_subscribe_to_typing_notifications(ptr, listener, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_subscribe_to_typing_notifications(ptr, listener, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_successor_room(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_successor_room(ptr, f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} user_id
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_suggested_role_for_user(ptr, user_id) {
    const ptr0 = passArray8ToWasm0(user_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_suggested_role_for_user(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_thread_list_service(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_thread_list_service(ptr, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_timeline(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_timeline(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} configuration
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_timeline_with_configuration(ptr, configuration) {
    const ptr0 = passArray8ToWasm0(configuration, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_timeline_with_configuration(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_topic(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_topic(ptr, f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {bigint} ptr
 * @param {number} is_typing
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_typing_notice(ptr, is_typing) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_typing_notice(ptr, is_typing);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} user_id
 * @param {Uint8Array} reason
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_unban_user(ptr, user_id, reason) {
    const ptr0 = passArray8ToWasm0(user_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(reason, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_unban_user(ptr, ptr0, len0, ptr1, len1);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} alias
 * @param {Uint8Array} alt_aliases
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_update_canonical_alias(ptr, alias, alt_aliases) {
    const ptr0 = passArray8ToWasm0(alias, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(alt_aliases, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_update_canonical_alias(ptr, ptr0, len0, ptr1, len1);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} visibility
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_update_history_visibility(ptr, visibility) {
    const ptr0 = passArray8ToWasm0(visibility, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_update_history_visibility(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} new_rule
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_update_join_rules(ptr, new_rule) {
    const ptr0 = passArray8ToWasm0(new_rule, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_update_join_rules(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} updates
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_update_power_levels_for_users(ptr, updates) {
    const ptr0 = passArray8ToWasm0(updates, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_update_power_levels_for_users(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} visibility
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_update_room_visibility(ptr, visibility) {
    const ptr0 = passArray8ToWasm0(visibility, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_update_room_visibility(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} mime_type
 * @param {Uint8Array} data
 * @param {Uint8Array} media_info
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_upload_avatar(ptr, mime_type, data, media_info) {
    const ptr0 = passArray8ToWasm0(mime_type, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArray8ToWasm0(media_info, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_upload_avatar(ptr, ptr0, len0, ptr1, len1, ptr2, len2);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} user_ids
 * @param {bigint} send_handle
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_room_withdraw_verification_and_resend(ptr, user_ids, send_handle) {
    const ptr0 = passArray8ToWasm0(user_ids, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_room_withdraw_verification_and_resend(ptr, ptr0, len0, send_handle);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_roomdirectorysearch_is_at_last_page(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_roomdirectorysearch_is_at_last_page(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_roomdirectorysearch_loaded_pages(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_roomdirectorysearch_loaded_pages(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_roomdirectorysearch_next_page(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_roomdirectorysearch_next_page(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {bigint} listener
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_roomdirectorysearch_results(ptr, listener) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_roomdirectorysearch_results(ptr, listener);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} filter
 * @param {number} batch_size
 * @param {Uint8Array} via_server_name
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_roomdirectorysearch_search(ptr, filter, batch_size, via_server_name) {
    const ptr0 = passArray8ToWasm0(filter, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(via_server_name, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_roomdirectorysearch_search(ptr, ptr0, len0, batch_size, ptr1, len1);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {number} page_size
 * @param {bigint} listener
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_roomlist_entries_with_dynamic_adapters(ptr, page_size, listener, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_roomlist_entries_with_dynamic_adapters(ptr, page_size, listener, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {bigint} listener
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_roomlist_loading_state(ptr, listener, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_roomlist_loading_state(ptr, listener, f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} room_id
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_roomlist_room(ptr, room_id, f_status_) {
    const ptr0 = passArray8ToWasm0(room_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_roomlist_room(ptr, ptr0, len0, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_roomlistdynamicentriescontroller_add_one_page(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_roomlistdynamicentriescontroller_add_one_page(ptr, f_status_.__wbg_ptr);
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_roomlistdynamicentriescontroller_reset_to_one_page(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_roomlistdynamicentriescontroller_reset_to_one_page(ptr, f_status_.__wbg_ptr);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} kind
 * @param {RustCallStatus} f_status_
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_roomlistdynamicentriescontroller_set_filter(ptr, kind, f_status_) {
    const ptr0 = passArray8ToWasm0(kind, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_roomlistdynamicentriescontroller_set_filter(ptr, ptr0, len0, f_status_.__wbg_ptr);
    return ret;
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_roomlistentrieswithdynamicadaptersresult_controller(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_roomlistentrieswithdynamicadaptersresult_controller(ptr, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_roomlistentrieswithdynamicadaptersresult_entries_stream(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_roomlistentrieswithdynamicadaptersresult_entries_stream(ptr, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_roomlistservice_all_rooms(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_roomlistservice_all_rooms(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} room_id
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_roomlistservice_room(ptr, room_id, f_status_) {
    const ptr0 = passArray8ToWasm0(room_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_roomlistservice_room(ptr, ptr0, len0, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {bigint} listener
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_roomlistservice_state(ptr, listener, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_roomlistservice_state(ptr, listener, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} room_ids
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_roomlistservice_subscribe_to_rooms(ptr, room_ids) {
    const ptr0 = passArray8ToWasm0(room_ids, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_roomlistservice_subscribe_to_rooms(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {number} delay_before_showing_in_ms
 * @param {number} delay_before_hiding_in_ms
 * @param {bigint} listener
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_roomlistservice_sync_indicator(ptr, delay_before_showing_in_ms, delay_before_hiding_in_ms, listener, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_roomlistservice_sync_indicator(ptr, delay_before_showing_in_ms, delay_before_hiding_in_ms, listener, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_roommembersiterator_len(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_roommembersiterator_len(ptr, f_status_.__wbg_ptr);
    return ret >>> 0;
}

/**
 * @param {bigint} ptr
 * @param {number} chunk_size
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_roommembersiterator_next_chunk(ptr, chunk_size, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_roommembersiterator_next_chunk(ptr, chunk_size, f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} mentions
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_roommessageeventcontentwithoutrelation_with_mentions(ptr, mentions, f_status_) {
    const ptr0 = passArray8ToWasm0(mentions, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_roommessageeventcontentwithoutrelation_with_mentions(ptr, ptr0, len0, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_roompowerlevels_can_own_user_ban(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_roompowerlevels_can_own_user_ban(ptr, f_status_.__wbg_ptr);
    return ret;
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_roompowerlevels_can_own_user_invite(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_roompowerlevels_can_own_user_invite(ptr, f_status_.__wbg_ptr);
    return ret;
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_roompowerlevels_can_own_user_kick(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_roompowerlevels_can_own_user_kick(ptr, f_status_.__wbg_ptr);
    return ret;
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_roompowerlevels_can_own_user_pin_unpin(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_roompowerlevels_can_own_user_pin_unpin(ptr, f_status_.__wbg_ptr);
    return ret;
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_roompowerlevels_can_own_user_redact_other(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_roompowerlevels_can_own_user_redact_other(ptr, f_status_.__wbg_ptr);
    return ret;
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_roompowerlevels_can_own_user_redact_own(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_roompowerlevels_can_own_user_redact_own(ptr, f_status_.__wbg_ptr);
    return ret;
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} message
 * @param {RustCallStatus} f_status_
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_roompowerlevels_can_own_user_send_message(ptr, message, f_status_) {
    const ptr0 = passArray8ToWasm0(message, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_roompowerlevels_can_own_user_send_message(ptr, ptr0, len0, f_status_.__wbg_ptr);
    return ret;
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} state_event
 * @param {RustCallStatus} f_status_
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_roompowerlevels_can_own_user_send_state(ptr, state_event, f_status_) {
    const ptr0 = passArray8ToWasm0(state_event, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_roompowerlevels_can_own_user_send_state(ptr, ptr0, len0, f_status_.__wbg_ptr);
    return ret;
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_roompowerlevels_can_own_user_trigger_room_notification(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_roompowerlevels_can_own_user_trigger_room_notification(ptr, f_status_.__wbg_ptr);
    return ret;
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} user_id
 * @param {RustCallStatus} f_status_
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_roompowerlevels_can_user_ban(ptr, user_id, f_status_) {
    const ptr0 = passArray8ToWasm0(user_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_roompowerlevels_can_user_ban(ptr, ptr0, len0, f_status_.__wbg_ptr);
    return ret;
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} user_id
 * @param {RustCallStatus} f_status_
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_roompowerlevels_can_user_invite(ptr, user_id, f_status_) {
    const ptr0 = passArray8ToWasm0(user_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_roompowerlevels_can_user_invite(ptr, ptr0, len0, f_status_.__wbg_ptr);
    return ret;
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} user_id
 * @param {RustCallStatus} f_status_
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_roompowerlevels_can_user_kick(ptr, user_id, f_status_) {
    const ptr0 = passArray8ToWasm0(user_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_roompowerlevels_can_user_kick(ptr, ptr0, len0, f_status_.__wbg_ptr);
    return ret;
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} user_id
 * @param {RustCallStatus} f_status_
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_roompowerlevels_can_user_pin_unpin(ptr, user_id, f_status_) {
    const ptr0 = passArray8ToWasm0(user_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_roompowerlevels_can_user_pin_unpin(ptr, ptr0, len0, f_status_.__wbg_ptr);
    return ret;
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} user_id
 * @param {RustCallStatus} f_status_
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_roompowerlevels_can_user_redact_other(ptr, user_id, f_status_) {
    const ptr0 = passArray8ToWasm0(user_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_roompowerlevels_can_user_redact_other(ptr, ptr0, len0, f_status_.__wbg_ptr);
    return ret;
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} user_id
 * @param {RustCallStatus} f_status_
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_roompowerlevels_can_user_redact_own(ptr, user_id, f_status_) {
    const ptr0 = passArray8ToWasm0(user_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_roompowerlevels_can_user_redact_own(ptr, ptr0, len0, f_status_.__wbg_ptr);
    return ret;
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} user_id
 * @param {Uint8Array} message
 * @param {RustCallStatus} f_status_
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_roompowerlevels_can_user_send_message(ptr, user_id, message, f_status_) {
    const ptr0 = passArray8ToWasm0(user_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(message, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_roompowerlevels_can_user_send_message(ptr, ptr0, len0, ptr1, len1, f_status_.__wbg_ptr);
    return ret;
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} user_id
 * @param {Uint8Array} state_event
 * @param {RustCallStatus} f_status_
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_roompowerlevels_can_user_send_state(ptr, user_id, state_event, f_status_) {
    const ptr0 = passArray8ToWasm0(user_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(state_event, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_roompowerlevels_can_user_send_state(ptr, ptr0, len0, ptr1, len1, f_status_.__wbg_ptr);
    return ret;
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} user_id
 * @param {RustCallStatus} f_status_
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_roompowerlevels_can_user_trigger_room_notification(ptr, user_id, f_status_) {
    const ptr0 = passArray8ToWasm0(user_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_roompowerlevels_can_user_trigger_room_notification(ptr, ptr0, len0, f_status_.__wbg_ptr);
    return ret;
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_roompowerlevels_events(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_roompowerlevels_events(ptr, f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_roompowerlevels_user_power_levels(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_roompowerlevels_user_power_levels(ptr, f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_roompowerlevels_values(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_roompowerlevels_values(ptr, f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_roompreview_forget(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_roompreview_forget(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_roompreview_info(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_roompreview_info(ptr, f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_roompreview_inviter(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_roompreview_inviter(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_roompreview_leave(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_roompreview_leave(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_roompreview_own_membership_details(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_roompreview_own_membership_details(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_secretsbundlewithuserid_contains_backup_key(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_secretsbundlewithuserid_contains_backup_key(ptr, f_status_.__wbg_ptr);
    return ret;
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_sendattachmentjoinhandle_cancel(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_sendattachmentjoinhandle_cancel(ptr, f_status_.__wbg_ptr);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_sendattachmentjoinhandle_join(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_sendattachmentjoinhandle_join(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_sendhandle_abort(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_sendhandle_abort(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_sendhandle_try_resend(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_sendhandle_try_resend(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_sessionverificationcontroller_accept_verification_request(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_sessionverificationcontroller_accept_verification_request(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} sender_id
 * @param {Uint8Array} flow_id
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_sessionverificationcontroller_acknowledge_verification_request(ptr, sender_id, flow_id) {
    const ptr0 = passArray8ToWasm0(sender_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(flow_id, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_sessionverificationcontroller_acknowledge_verification_request(ptr, ptr0, len0, ptr1, len1);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_sessionverificationcontroller_approve_verification(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_sessionverificationcontroller_approve_verification(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_sessionverificationcontroller_cancel_verification(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_sessionverificationcontroller_cancel_verification(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_sessionverificationcontroller_decline_verification(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_sessionverificationcontroller_decline_verification(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_sessionverificationcontroller_request_device_verification(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_sessionverificationcontroller_request_device_verification(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} user_id
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_sessionverificationcontroller_request_user_verification(ptr, user_id) {
    const ptr0 = passArray8ToWasm0(user_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_sessionverificationcontroller_request_user_verification(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} delegate
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_sessionverificationcontroller_set_delegate(ptr, delegate, f_status_) {
    const ptr0 = passArray8ToWasm0(delegate, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_sessionverificationcontroller_set_delegate(ptr, ptr0, len0, f_status_.__wbg_ptr);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_sessionverificationcontroller_start_sas_verification(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_sessionverificationcontroller_start_sas_verification(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_sessionverificationemoji_description(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_sessionverificationemoji_description(ptr, f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_sessionverificationemoji_symbol(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_sessionverificationemoji_symbol(ptr, f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_spaceroomlist_paginate(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_spaceroomlist_paginate(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_spaceroomlist_pagination_state(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_spaceroomlist_pagination_state(ptr, f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_spaceroomlist_reset(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_spaceroomlist_reset(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_spaceroomlist_rooms(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_spaceroomlist_rooms(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_spaceroomlist_space(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_spaceroomlist_space(ptr, f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {bigint} ptr
 * @param {bigint} listener
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_spaceroomlist_subscribe_to_pagination_state_updates(ptr, listener, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_spaceroomlist_subscribe_to_pagination_state_updates(ptr, listener, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {bigint} listener
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_spaceroomlist_subscribe_to_room_update(ptr, listener) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_spaceroomlist_subscribe_to_room_update(ptr, listener);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {bigint} listener
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_spaceroomlist_subscribe_to_space_updates(ptr, listener, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_spaceroomlist_subscribe_to_space_updates(ptr, listener, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} child_id
 * @param {Uint8Array} space_id
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_spaceservice_add_child_to_space(ptr, child_id, space_id) {
    const ptr0 = passArray8ToWasm0(child_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(space_id, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_spaceservice_add_child_to_space(ptr, ptr0, len0, ptr1, len1);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_spaceservice_editable_spaces(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_spaceservice_editable_spaces(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} room_id
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_spaceservice_get_space_room(ptr, room_id) {
    const ptr0 = passArray8ToWasm0(room_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_spaceservice_get_space_room(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} child_id
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_spaceservice_joined_parents_of_child(ptr, child_id) {
    const ptr0 = passArray8ToWasm0(child_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_spaceservice_joined_parents_of_child(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} space_id
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_spaceservice_leave_space(ptr, space_id) {
    const ptr0 = passArray8ToWasm0(space_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_spaceservice_leave_space(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} child_id
 * @param {Uint8Array} space_id
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_spaceservice_remove_child_from_space(ptr, child_id, space_id) {
    const ptr0 = passArray8ToWasm0(child_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(space_id, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_spaceservice_remove_child_from_space(ptr, ptr0, len0, ptr1, len1);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_spaceservice_space_filters(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_spaceservice_space_filters(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} space_id
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_spaceservice_space_room_list(ptr, space_id) {
    const ptr0 = passArray8ToWasm0(space_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_spaceservice_space_room_list(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {bigint} listener
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_spaceservice_subscribe_to_space_filters(ptr, listener) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_spaceservice_subscribe_to_space_filters(ptr, listener);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {bigint} listener
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_spaceservice_subscribe_to_top_level_joined_spaces(ptr, listener) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_spaceservice_subscribe_to_top_level_joined_spaces(ptr, listener);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_spaceservice_top_level_joined_spaces(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_spaceservice_top_level_joined_spaces(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_span_enter(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_span_enter(ptr, f_status_.__wbg_ptr);
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_span_exit(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_span_exit(ptr, f_status_.__wbg_ptr);
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_span_is_none(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_span_is_none(ptr, f_status_.__wbg_ptr);
    return ret;
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} callback_url
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_ssohandler_finish(ptr, callback_url) {
    const ptr0 = passArray8ToWasm0(callback_url, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_ssohandler_finish(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_ssohandler_url(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_ssohandler_url(ptr, f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_syncservice_expire_sessions(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_syncservice_expire_sessions(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_syncservice_room_list_service(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_syncservice_room_list_service(ptr, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_syncservice_start(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_syncservice_start(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {bigint} listener
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_syncservice_state(ptr, listener, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_syncservice_state(ptr, listener, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_syncservice_stop(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_syncservice_stop(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_syncservicebuilder_finish(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_syncservicebuilder_finish(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_syncservicebuilder_with_offline_mode(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_syncservicebuilder_with_offline_mode(ptr, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} connection_id
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_syncservicebuilder_with_room_list_connection_id(ptr, connection_id, f_status_) {
    const ptr0 = passArray8ToWasm0(connection_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_syncservicebuilder_with_room_list_connection_id(ptr, ptr0, len0, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {number} limit
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_syncservicebuilder_with_room_list_timeline_limit(ptr, limit, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_syncservicebuilder_with_room_list_timeline_limit(ptr, limit, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {number} enable
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_syncservicebuilder_with_share_pos(ptr, enable, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_syncservicebuilder_with_share_pos(ptr, enable, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {Uint8Array} ptr
 * @param {Uint8Array} other
 * @param {RustCallStatus} f_status_
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_tagname_uniffi_trait_eq_eq(ptr, other, f_status_) {
    const ptr0 = passArray8ToWasm0(ptr, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(other, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_tagname_uniffi_trait_eq_eq(ptr0, len0, ptr1, len1, f_status_.__wbg_ptr);
    return ret;
}

/**
 * @param {Uint8Array} ptr
 * @param {Uint8Array} other
 * @param {RustCallStatus} f_status_
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_tagname_uniffi_trait_eq_ne(ptr, other, f_status_) {
    const ptr0 = passArray8ToWasm0(ptr, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(other, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_tagname_uniffi_trait_eq_ne(ptr0, len0, ptr1, len1, f_status_.__wbg_ptr);
    return ret;
}

/**
 * @param {Uint8Array} ptr
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_tagname_uniffi_trait_hash(ptr, f_status_) {
    const ptr0 = passArray8ToWasm0(ptr, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_tagname_uniffi_trait_hash(ptr0, len0, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_taskhandle_cancel(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_taskhandle_cancel(ptr, f_status_.__wbg_ptr);
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_taskhandle_is_finished(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_taskhandle_is_finished(ptr, f_status_.__wbg_ptr);
    return ret;
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_threadlistservice_items(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_threadlistservice_items(ptr, f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_threadlistservice_paginate(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_threadlistservice_paginate(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_threadlistservice_pagination_state(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_threadlistservice_pagination_state(ptr, f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_threadlistservice_reset(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_threadlistservice_reset(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {bigint} listener
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_threadlistservice_subscribe_to_items_updates(ptr, listener, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_threadlistservice_subscribe_to_items_updates(ptr, listener, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {bigint} listener
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_threadlistservice_subscribe_to_pagination_state_updates(ptr, listener, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_threadlistservice_subscribe_to_pagination_state_updates(ptr, listener, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_threadsummary_latest_event(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_threadsummary_latest_event(ptr, f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_threadsummary_num_replies(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_threadsummary_num_replies(ptr, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {bigint} listener
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_timeline_add_listener(ptr, listener) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_timeline_add_listener(ptr, listener);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} msg_type
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_timeline_create_message_content(ptr, msg_type, f_status_) {
    const ptr0 = passArray8ToWasm0(msg_type, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_timeline_create_message_content(ptr, ptr0, len0, f_status_.__wbg_ptr);
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} question
 * @param {Uint8Array} answers
 * @param {number} max_selections
 * @param {Uint8Array} poll_kind
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_timeline_create_poll(ptr, question, answers, max_selections, poll_kind) {
    const ptr0 = passArray8ToWasm0(question, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(answers, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArray8ToWasm0(poll_kind, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_timeline_create_poll(ptr, ptr0, len0, ptr1, len1, max_selections, ptr2, len2);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} event_or_transaction_id
 * @param {Uint8Array} new_content
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_timeline_edit(ptr, event_or_transaction_id, new_content) {
    const ptr0 = passArray8ToWasm0(event_or_transaction_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(new_content, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_timeline_edit(ptr, ptr0, len0, ptr1, len1);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} poll_start_event_id
 * @param {Uint8Array} text
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_timeline_end_poll(ptr, poll_start_event_id, text) {
    const ptr0 = passArray8ToWasm0(poll_start_event_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(text, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_timeline_end_poll(ptr, ptr0, len0, ptr1, len1);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} event_id
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_timeline_fetch_details_for_event(ptr, event_id) {
    const ptr0 = passArray8ToWasm0(event_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_timeline_fetch_details_for_event(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_timeline_fetch_members(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_timeline_fetch_members(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} event_id
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_timeline_get_event_timeline_item_by_event_id(ptr, event_id) {
    const ptr0 = passArray8ToWasm0(event_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_timeline_get_event_timeline_item_by_event_id(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_timeline_latest_event_id(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_timeline_latest_event_id(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} event_id_str
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_timeline_load_reply_details(ptr, event_id_str) {
    const ptr0 = passArray8ToWasm0(event_id_str, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_timeline_load_reply_details(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} receipt_type
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_timeline_mark_as_read(ptr, receipt_type) {
    const ptr0 = passArray8ToWasm0(receipt_type, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_timeline_mark_as_read(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {number} num_events
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_timeline_paginate_backwards(ptr, num_events) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_timeline_paginate_backwards(ptr, num_events);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {number} num_events
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_timeline_paginate_forwards(ptr, num_events) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_timeline_paginate_forwards(ptr, num_events);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} event_id
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_timeline_pin_event(ptr, event_id) {
    const ptr0 = passArray8ToWasm0(event_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_timeline_pin_event(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} event_or_transaction_id
 * @param {Uint8Array} reason
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_timeline_redact_event(ptr, event_or_transaction_id, reason) {
    const ptr0 = passArray8ToWasm0(event_or_transaction_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(reason, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_timeline_redact_event(ptr, ptr0, len0, ptr1, len1);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} session_ids
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_timeline_retry_decryption(ptr, session_ids, f_status_) {
    const ptr0 = passArray8ToWasm0(session_ids, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_timeline_retry_decryption(ptr, ptr0, len0, f_status_.__wbg_ptr);
}

/**
 * @param {bigint} ptr
 * @param {bigint} msg
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_timeline_send(ptr, msg) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_timeline_send(ptr, msg);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} params
 * @param {Uint8Array} audio_info
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_timeline_send_audio(ptr, params, audio_info, f_status_) {
    const ptr0 = passArray8ToWasm0(params, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(audio_info, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_timeline_send_audio(ptr, ptr0, len0, ptr1, len1, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} params
 * @param {Uint8Array} file_info
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_timeline_send_file(ptr, params, file_info, f_status_) {
    const ptr0 = passArray8ToWasm0(params, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(file_info, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_timeline_send_file(ptr, ptr0, len0, ptr1, len1, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} params
 * @param {Uint8Array} thumbnail_source
 * @param {Uint8Array} image_info
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_timeline_send_image(ptr, params, thumbnail_source, image_info, f_status_) {
    const ptr0 = passArray8ToWasm0(params, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(thumbnail_source, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArray8ToWasm0(image_info, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_timeline_send_image(ptr, ptr0, len0, ptr1, len1, ptr2, len2, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} body
 * @param {Uint8Array} geo_uri
 * @param {Uint8Array} description
 * @param {Uint8Array} zoom_level
 * @param {Uint8Array} asset_type
 * @param {Uint8Array} replied_to_event_id
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_timeline_send_location(ptr, body, geo_uri, description, zoom_level, asset_type, replied_to_event_id) {
    const ptr0 = passArray8ToWasm0(body, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(geo_uri, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArray8ToWasm0(description, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ptr3 = passArray8ToWasm0(zoom_level, wasm.__wbindgen_malloc);
    const len3 = WASM_VECTOR_LEN;
    const ptr4 = passArray8ToWasm0(asset_type, wasm.__wbindgen_malloc);
    const len4 = WASM_VECTOR_LEN;
    const ptr5 = passArray8ToWasm0(replied_to_event_id, wasm.__wbindgen_malloc);
    const len5 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_timeline_send_location(ptr, ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4, ptr5, len5);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} poll_start_event_id
 * @param {Uint8Array} answers
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_timeline_send_poll_response(ptr, poll_start_event_id, answers) {
    const ptr0 = passArray8ToWasm0(poll_start_event_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(answers, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_timeline_send_poll_response(ptr, ptr0, len0, ptr1, len1);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} receipt_type
 * @param {Uint8Array} event_id
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_timeline_send_read_receipt(ptr, receipt_type, event_id) {
    const ptr0 = passArray8ToWasm0(receipt_type, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(event_id, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_timeline_send_read_receipt(ptr, ptr0, len0, ptr1, len1);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {bigint} msg
 * @param {Uint8Array} event_id
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_timeline_send_reply(ptr, msg, event_id) {
    const ptr0 = passArray8ToWasm0(event_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_timeline_send_reply(ptr, msg, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} params
 * @param {Uint8Array} thumbnail_source
 * @param {Uint8Array} video_info
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_timeline_send_video(ptr, params, thumbnail_source, video_info, f_status_) {
    const ptr0 = passArray8ToWasm0(params, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(thumbnail_source, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArray8ToWasm0(video_info, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_timeline_send_video(ptr, ptr0, len0, ptr1, len1, ptr2, len2, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} params
 * @param {Uint8Array} audio_info
 * @param {Uint8Array} waveform
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_timeline_send_voice_message(ptr, params, audio_info, waveform, f_status_) {
    const ptr0 = passArray8ToWasm0(params, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(audio_info, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArray8ToWasm0(waveform, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_timeline_send_voice_message(ptr, ptr0, len0, ptr1, len1, ptr2, len2, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {bigint} listener
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_timeline_subscribe_to_back_pagination_status(ptr, listener) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_timeline_subscribe_to_back_pagination_status(ptr, listener);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} item_id
 * @param {Uint8Array} key
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_timeline_toggle_reaction(ptr, item_id, key) {
    const ptr0 = passArray8ToWasm0(item_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(key, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_timeline_toggle_reaction(ptr, ptr0, len0, ptr1, len1);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} event_id
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_timeline_unpin_event(ptr, event_id) {
    const ptr0 = passArray8ToWasm0(event_id, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_timeline_unpin_event(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_timelineevent_content(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_timelineevent_content(ptr, f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_timelineevent_event_id(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_timelineevent_event_id(ptr, f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_timelineevent_sender_id(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_timelineevent_sender_id(ptr, f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_timelineevent_thread_root_event_id(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_timelineevent_thread_root_event_id(ptr, f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_timelineevent_timestamp(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_timelineevent_timestamp(ptr, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {Uint8Array} ptr
 * @param {Uint8Array} other
 * @param {RustCallStatus} f_status_
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_timelineeventtype_uniffi_trait_eq_eq(ptr, other, f_status_) {
    const ptr0 = passArray8ToWasm0(ptr, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(other, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_timelineeventtype_uniffi_trait_eq_eq(ptr0, len0, ptr1, len1, f_status_.__wbg_ptr);
    return ret;
}

/**
 * @param {Uint8Array} ptr
 * @param {Uint8Array} other
 * @param {RustCallStatus} f_status_
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_timelineeventtype_uniffi_trait_eq_ne(ptr, other, f_status_) {
    const ptr0 = passArray8ToWasm0(ptr, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(other, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_timelineeventtype_uniffi_trait_eq_ne(ptr0, len0, ptr1, len1, f_status_.__wbg_ptr);
    return ret;
}

/**
 * @param {Uint8Array} ptr
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_timelineeventtype_uniffi_trait_hash(ptr, f_status_) {
    const ptr0 = passArray8ToWasm0(ptr, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_timelineeventtype_uniffi_trait_hash(ptr0, len0, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_timelineitem_as_event(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_timelineitem_as_event(ptr, f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_timelineitem_as_virtual(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_timelineitem_as_virtual(ptr, f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_timelineitem_fmt_debug(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_timelineitem_fmt_debug(ptr, f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_timelineitem_unique_id(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_timelineitem_unique_id(ptr, f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_unreadnotificationscount_has_notifications(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_unreadnotificationscount_has_notifications(ptr, f_status_.__wbg_ptr);
    return ret;
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_unreadnotificationscount_highlight_count(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_unreadnotificationscount_highlight_count(ptr, f_status_.__wbg_ptr);
    return ret >>> 0;
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_unreadnotificationscount_notification_count(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_unreadnotificationscount_notification_count(ptr, f_status_.__wbg_ptr);
    return ret >>> 0;
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_useridentity_has_verification_violation(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_useridentity_has_verification_violation(ptr, f_status_.__wbg_ptr);
    return ret;
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_useridentity_is_verified(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_useridentity_is_verified(ptr, f_status_.__wbg_ptr);
    return ret;
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_useridentity_master_key(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_useridentity_master_key(ptr, f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_useridentity_pin(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_useridentity_pin(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {number}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_useridentity_was_previously_verified(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_useridentity_was_previously_verified(ptr, f_status_.__wbg_ptr);
    return ret;
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_useridentity_withdraw_verification(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_useridentity_withdraw_verification(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {bigint} room
 * @param {bigint} capabilities_provider
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_widgetdriver_run(ptr, room, capabilities_provider) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_widgetdriver_run(ptr, room, capabilities_provider);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_widgetdriverhandle_recv(ptr) {
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_widgetdriverhandle_recv(ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} ptr
 * @param {Uint8Array} msg
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_ffi_fn_method_widgetdriverhandle_send(ptr, msg) {
    const ptr0 = passArray8ToWasm0(msg, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ubrn_uniffi_matrix_sdk_ffi_fn_method_widgetdriverhandle_send(ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 * @returns {bigint}
 */
export function ubrn_uniffi_matrix_sdk_fn_clone_oauthauthorizationdata(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_fn_clone_oauthauthorizationdata(handle, f_status_.__wbg_ptr);
    return BigInt.asUintN(64, ret);
}

/**
 * @param {bigint} handle
 * @param {RustCallStatus} f_status_
 */
export function ubrn_uniffi_matrix_sdk_fn_free_oauthauthorizationdata(handle, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    wasm.ubrn_uniffi_matrix_sdk_fn_free_oauthauthorizationdata(handle, f_status_.__wbg_ptr);
}

/**
 * @param {bigint} ptr
 * @param {RustCallStatus} f_status_
 * @returns {Uint8Array}
 */
export function ubrn_uniffi_matrix_sdk_fn_method_oauthauthorizationdata_login_url(ptr, f_status_) {
    _assertClass(f_status_, RustCallStatus);
    const ret = wasm.ubrn_uniffi_matrix_sdk_fn_method_oauthauthorizationdata_login_url(ptr, f_status_.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}

function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg_Error_83742b46f01ce22d: function(arg0, arg1) {
            const ret = Error(getStringFromWasm0(arg0, arg1));
            return ret;
        },
        __wbg_Number_a5a435bd7bbec835: function(arg0) {
            const ret = Number(arg0);
            return ret;
        },
        __wbg_String_8564e559799eccda: function(arg0, arg1) {
            const ret = String(arg1);
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg_Window_241244be8c9776c1: function(arg0) {
            const ret = arg0.Window;
            return ret;
        },
        __wbg_WorkerGlobalScope_8623a7c9030fbce2: function(arg0) {
            const ret = arg0.WorkerGlobalScope;
            return ret;
        },
        __wbg___wbindgen_bigint_get_as_i64_447a76b5c6ef7bda: function(arg0, arg1) {
            const v = arg1;
            const ret = typeof(v) === 'bigint' ? v : undefined;
            getDataViewMemory0().setBigInt64(arg0 + 8 * 1, isLikeNone(ret) ? BigInt(0) : ret, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, !isLikeNone(ret), true);
        },
        __wbg___wbindgen_boolean_get_c0f3f60bac5a78d1: function(arg0) {
            const v = arg0;
            const ret = typeof(v) === 'boolean' ? v : undefined;
            return isLikeNone(ret) ? 0xFFFFFF : ret ? 1 : 0;
        },
        __wbg___wbindgen_debug_string_5398f5bb970e0daa: function(arg0, arg1) {
            const ret = debugString(arg1);
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg___wbindgen_in_41dbb8413020e076: function(arg0, arg1) {
            const ret = arg0 in arg1;
            return ret;
        },
        __wbg___wbindgen_is_bigint_e2141d4f045b7eda: function(arg0) {
            const ret = typeof(arg0) === 'bigint';
            return ret;
        },
        __wbg___wbindgen_is_function_3c846841762788c1: function(arg0) {
            const ret = typeof(arg0) === 'function';
            return ret;
        },
        __wbg___wbindgen_is_null_0b605fc6b167c56f: function(arg0) {
            const ret = arg0 === null;
            return ret;
        },
        __wbg___wbindgen_is_object_781bc9f159099513: function(arg0) {
            const val = arg0;
            const ret = typeof(val) === 'object' && val !== null;
            return ret;
        },
        __wbg___wbindgen_is_string_7ef6b97b02428fae: function(arg0) {
            const ret = typeof(arg0) === 'string';
            return ret;
        },
        __wbg___wbindgen_is_undefined_52709e72fb9f179c: function(arg0) {
            const ret = arg0 === undefined;
            return ret;
        },
        __wbg___wbindgen_jsval_eq_ee31bfad3e536463: function(arg0, arg1) {
            const ret = arg0 === arg1;
            return ret;
        },
        __wbg___wbindgen_jsval_loose_eq_5bcc3bed3c69e72b: function(arg0, arg1) {
            const ret = arg0 == arg1;
            return ret;
        },
        __wbg___wbindgen_number_get_34bb9d9dcfa21373: function(arg0, arg1) {
            const obj = arg1;
            const ret = typeof(obj) === 'number' ? obj : undefined;
            getDataViewMemory0().setFloat64(arg0 + 8 * 1, isLikeNone(ret) ? 0 : ret, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, !isLikeNone(ret), true);
        },
        __wbg___wbindgen_string_get_395e606bd0ee4427: function(arg0, arg1) {
            const obj = arg1;
            const ret = typeof(obj) === 'string' ? obj : undefined;
            var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            var len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg___wbindgen_throw_6ddd609b62940d55: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbg__wbg_cb_unref_6b5b6b8576d35cb1: function(arg0) {
            arg0._wbg_cb_unref();
        },
        __wbg_abort_5ef96933660780b7: function(arg0) {
            arg0.abort();
        },
        __wbg_abort_60dcb252ae0031fc: function() { return handleError(function (arg0) {
            arg0.abort();
        }, arguments); },
        __wbg_abort_6479c2d794ebf2ee: function(arg0, arg1) {
            arg0.abort(arg1);
        },
        __wbg_acquire_capabilities_9c823f0ba1f406c3: function(arg0) {
            const ret = arg0.acquire_capabilities;
            return ret;
        },
        __wbg_add_31c3a85003d5143e: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = arg0.add(arg1, arg2);
            return ret;
        }, arguments); },
        __wbg_add_7857847c343fb7de: function() { return handleError(function (arg0, arg1) {
            const ret = arg0.add(arg1);
            return ret;
        }, arguments); },
        __wbg_append_608dfb635ee8998f: function() { return handleError(function (arg0, arg1, arg2, arg3, arg4) {
            arg0.append(getStringFromWasm0(arg1, arg2), getStringFromWasm0(arg3, arg4));
        }, arguments); },
        __wbg_arrayBuffer_eb8e9ca620af2a19: function() { return handleError(function (arg0) {
            const ret = arg0.arrayBuffer();
            return ret;
        }, arguments); },
        __wbg_bound_4e343b4fbe5419fa: function() { return handleError(function (arg0, arg1, arg2, arg3) {
            const ret = IDBKeyRange.bound(arg0, arg1, arg2 !== 0, arg3 !== 0);
            return ret;
        }, arguments); },
        __wbg_call_01a5303bf9844b6f: function(arg0, arg1, arg2) {
            arg0.call(arg1, BigInt.asUintN(64, arg2));
        },
        __wbg_call_031be5b6353c54ac: function(arg0, arg1, arg2) {
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2));
            return ret;
        },
        __wbg_call_045bd936cda28408: function(arg0, arg1, arg2) {
            arg0.call(arg1, BigInt.asUintN(64, arg2));
        },
        __wbg_call_047fd46b6c37b605: function(arg0, arg1, arg2) {
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2));
            return ret;
        },
        __wbg_call_05fa6bcf7a0af139: function(arg0, arg1, arg2) {
            arg0.call(arg1, BigInt.asUintN(64, arg2));
        },
        __wbg_call_06a0c4e342fcdceb: function(arg0, arg1, arg2) {
            arg0.call(arg1, BigInt.asUintN(64, arg2));
        },
        __wbg_call_076dd31816283c76: function(arg0) {
            const ret = arg0.call;
            return ret;
        },
        __wbg_call_0d317b4dd59f14f5: function(arg0, arg1, arg2, arg3, arg4) {
            var v0 = getArrayU8FromWasm0(arg3, arg4).slice();
            wasm.__wbindgen_free(arg3, arg4 * 1, 1);
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2), v0);
            return ret;
        },
        __wbg_call_0f37f08bf3c6c103: function(arg0, arg1, arg2) {
            arg0.call(arg1, BigInt.asUintN(64, arg2));
        },
        __wbg_call_1022c466a2bb88ca: function(arg0, arg1, arg2) {
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2));
            return ret;
        },
        __wbg_call_13663b942c7108d8: function(arg0, arg1, arg2) {
            arg0.call(arg1, BigInt.asUintN(64, arg2));
        },
        __wbg_call_1440de1450408369: function(arg0, arg1, arg2, arg3, arg4) {
            var v0 = getArrayU8FromWasm0(arg3, arg4).slice();
            wasm.__wbindgen_free(arg3, arg4 * 1, 1);
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2), v0);
            return ret;
        },
        __wbg_call_147a39136fa4e796: function(arg0, arg1, arg2, arg3, arg4) {
            var v0 = getArrayU8FromWasm0(arg3, arg4).slice();
            wasm.__wbindgen_free(arg3, arg4 * 1, 1);
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2), v0);
            return ret;
        },
        __wbg_call_19364b2966f35bfa: function(arg0, arg1, arg2) {
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2));
            return ret;
        },
        __wbg_call_1b3ec30f2c87295a: function(arg0, arg1, arg2, arg3, arg4) {
            var v0 = getArrayU8FromWasm0(arg3, arg4).slice();
            wasm.__wbindgen_free(arg3, arg4 * 1, 1);
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2), v0);
            return ret;
        },
        __wbg_call_1f9b3b4350426ab7: function(arg0, arg1, arg2) {
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2));
            return ret;
        },
        __wbg_call_1f9f45a1eebad32e: function(arg0, arg1, arg2, arg3, arg4) {
            var v0 = getArrayU8FromWasm0(arg3, arg4).slice();
            wasm.__wbindgen_free(arg3, arg4 * 1, 1);
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2), v0);
            return ret;
        },
        __wbg_call_206140b0d51b43fb: function(arg0, arg1, arg2, arg3, arg4) {
            var v0 = getArrayU8FromWasm0(arg3, arg4).slice();
            wasm.__wbindgen_free(arg3, arg4 * 1, 1);
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2), v0);
            return ret;
        },
        __wbg_call_2115e9204e04a20e: function(arg0, arg1, arg2) {
            arg0.call(arg1, BigInt.asUintN(64, arg2));
        },
        __wbg_call_2126591f9f2ee295: function(arg0, arg1, arg2, arg3, arg4) {
            var v0 = getArrayU8FromWasm0(arg3, arg4).slice();
            wasm.__wbindgen_free(arg3, arg4 * 1, 1);
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2), v0);
            return ret;
        },
        __wbg_call_212b1dc63585d46b: function(arg0, arg1, arg2, arg3, arg4) {
            var v0 = getArrayU8FromWasm0(arg3, arg4).slice();
            wasm.__wbindgen_free(arg3, arg4 * 1, 1);
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2), v0);
            return ret;
        },
        __wbg_call_237cf580524fcba2: function(arg0, arg1, arg2) {
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2));
            return ret;
        },
        __wbg_call_25d0598383bede61: function(arg0, arg1, arg2, arg3, arg4) {
            var v0 = getArrayU8FromWasm0(arg3, arg4).slice();
            wasm.__wbindgen_free(arg3, arg4 * 1, 1);
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2), v0);
            return ret;
        },
        __wbg_call_277399d78420c20a: function(arg0, arg1, arg2) {
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2));
            return ret;
        },
        __wbg_call_27e6f4323e2d5fcd: function(arg0, arg1, arg2) {
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2));
            return ret;
        },
        __wbg_call_2836fe72b5ecb931: function(arg0, arg1, arg2) {
            arg0.call(arg1, BigInt.asUintN(64, arg2));
        },
        __wbg_call_293ec1a033f469fd: function(arg0, arg1, arg2) {
            arg0.call(arg1, BigInt.asUintN(64, arg2));
        },
        __wbg_call_2d781c1f4d5c0ef8: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = arg0.call(arg1, arg2);
            return ret;
        }, arguments); },
        __wbg_call_2ee44bdeca8fff71: function(arg0, arg1, arg2) {
            arg0.call(arg1, BigInt.asUintN(64, arg2));
        },
        __wbg_call_2f2d70d7fb633d39: function(arg0, arg1, arg2, arg3, arg4) {
            var v0 = getArrayU8FromWasm0(arg3, arg4).slice();
            wasm.__wbindgen_free(arg3, arg4 * 1, 1);
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2), v0);
            return ret;
        },
        __wbg_call_2f810a5d6ccffbe3: function(arg0, arg1, arg2) {
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2));
            return ret;
        },
        __wbg_call_3385ce6790505ff3: function(arg0, arg1, arg2) {
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2));
            return ret;
        },
        __wbg_call_33af9152713154f2: function(arg0, arg1, arg2) {
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2));
            return ret;
        },
        __wbg_call_33c045f796fe45c6: function(arg0, arg1, arg2) {
            arg0.call(arg1, BigInt.asUintN(64, arg2));
        },
        __wbg_call_33d10b69592a8d3a: function(arg0, arg1, arg2, arg3, arg4) {
            var v0 = getArrayU8FromWasm0(arg3, arg4).slice();
            wasm.__wbindgen_free(arg3, arg4 * 1, 1);
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2), v0);
            return ret;
        },
        __wbg_call_344f9e6c647edf64: function(arg0, arg1, arg2) {
            arg0.call(arg1, BigInt.asUintN(64, arg2));
        },
        __wbg_call_38749842b5692bb4: function(arg0, arg1, arg2, arg3, arg4, arg5, arg6) {
            var v0 = getArrayU8FromWasm0(arg3, arg4).slice();
            wasm.__wbindgen_free(arg3, arg4 * 1, 1);
            var v1 = getArrayU8FromWasm0(arg5, arg6).slice();
            wasm.__wbindgen_free(arg5, arg6 * 1, 1);
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2), v0, v1);
            return ret;
        },
        __wbg_call_3c5c946542722a97: function(arg0, arg1, arg2) {
            arg0.call(arg1, BigInt.asUintN(64, arg2));
        },
        __wbg_call_3c918e82615e2f4d: function(arg0, arg1, arg2) {
            arg0.call(arg1, BigInt.asUintN(64, arg2));
        },
        __wbg_call_3e607953a2831f3a: function(arg0, arg1, arg2) {
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2));
            return ret;
        },
        __wbg_call_3f790f961aea3e70: function(arg0, arg1, arg2) {
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2));
            return ret;
        },
        __wbg_call_3f7de7d613f918a1: function(arg0, arg1, arg2) {
            arg0.call(arg1, BigInt.asUintN(64, arg2));
        },
        __wbg_call_42a5b93b68d06cd1: function(arg0, arg1, arg2) {
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2));
            return ret;
        },
        __wbg_call_42e10e2242299ee0: function(arg0, arg1, arg2, arg3, arg4) {
            var v0 = getArrayU8FromWasm0(arg3, arg4).slice();
            wasm.__wbindgen_free(arg3, arg4 * 1, 1);
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2), v0);
            return ret;
        },
        __wbg_call_4810d49ab7632ff3: function(arg0, arg1, arg2) {
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2));
            return ret;
        },
        __wbg_call_4841b61cbd3d191a: function(arg0, arg1, arg2, arg3, arg4) {
            var v0 = getArrayU8FromWasm0(arg3, arg4).slice();
            wasm.__wbindgen_free(arg3, arg4 * 1, 1);
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2), v0);
            return ret;
        },
        __wbg_call_48f6c405a06b6416: function(arg0, arg1, arg2) {
            arg0.call(arg1, BigInt.asUintN(64, arg2));
        },
        __wbg_call_491367b093618522: function(arg0, arg1, arg2) {
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2));
            return ret;
        },
        __wbg_call_49cc58673e18a589: function(arg0, arg1, arg2) {
            arg0.call(arg1, BigInt.asUintN(64, arg2));
        },
        __wbg_call_4a1cbf4475824f4b: function(arg0, arg1, arg2, arg3, arg4, arg5, arg6) {
            var v0 = getArrayU8FromWasm0(arg3, arg4).slice();
            wasm.__wbindgen_free(arg3, arg4 * 1, 1);
            var v1 = getArrayU8FromWasm0(arg5, arg6).slice();
            wasm.__wbindgen_free(arg5, arg6 * 1, 1);
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2), v0, v1);
            return ret;
        },
        __wbg_call_4ba64ed64231e8e8: function(arg0, arg1, arg2, arg3, arg4, arg5, arg6) {
            var v0 = getArrayU8FromWasm0(arg3, arg4).slice();
            wasm.__wbindgen_free(arg3, arg4 * 1, 1);
            var v1 = getArrayU8FromWasm0(arg5, arg6).slice();
            wasm.__wbindgen_free(arg5, arg6 * 1, 1);
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2), v0, v1);
            return ret;
        },
        __wbg_call_4bbb9b067b0ada96: function(arg0, arg1, arg2) {
            arg0.call(arg1, BigInt.asUintN(64, arg2));
        },
        __wbg_call_4dad21ec6f9090bf: function(arg0, arg1, arg2) {
            arg0.call(arg1, BigInt.asUintN(64, arg2));
        },
        __wbg_call_4dbed1ed3d36871f: function(arg0, arg1, arg2) {
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2));
            return ret;
        },
        __wbg_call_4f2fca254ea39ccb: function(arg0, arg1, arg2) {
            arg0.call(arg1, BigInt.asUintN(64, arg2));
        },
        __wbg_call_5246e35c710d4d68: function(arg0, arg1, arg2) {
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2));
            return ret;
        },
        __wbg_call_54943c5d8faaeb4f: function(arg0, arg1, arg2) {
            arg0.call(arg1, BigInt.asUintN(64, arg2));
        },
        __wbg_call_552699b4664cdd17: function(arg0, arg1, arg2, arg3, arg4) {
            var v0 = getArrayU8FromWasm0(arg3, arg4).slice();
            wasm.__wbindgen_free(arg3, arg4 * 1, 1);
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2), v0);
            return ret;
        },
        __wbg_call_562996d208a6e10d: function(arg0, arg1, arg2, arg3, arg4) {
            var v0 = getArrayU8FromWasm0(arg3, arg4).slice();
            wasm.__wbindgen_free(arg3, arg4 * 1, 1);
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2), v0);
            return ret;
        },
        __wbg_call_56f75d5a6ea9d8c9: function(arg0, arg1, arg2) {
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2));
            return ret;
        },
        __wbg_call_58920a32d31df7ad: function(arg0, arg1, arg2) {
            arg0.call(arg1, BigInt.asUintN(64, arg2));
        },
        __wbg_call_58a0229e29e81ce5: function(arg0, arg1, arg2) {
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2));
            return ret;
        },
        __wbg_call_5d6a919785ff2eab: function(arg0, arg1, arg2, arg3, arg4) {
            var v0 = getArrayU8FromWasm0(arg3, arg4).slice();
            wasm.__wbindgen_free(arg3, arg4 * 1, 1);
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2), v0);
            return ret;
        },
        __wbg_call_5e5e85225d0d0f13: function(arg0) {
            const ret = arg0.call;
            return ret;
        },
        __wbg_call_5f2bb35dea107630: function(arg0, arg1, arg2) {
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2));
            return ret;
        },
        __wbg_call_63a23201e818a28b: function(arg0, arg1, arg2, arg3, arg4) {
            var v0 = getArrayU8FromWasm0(arg3, arg4).slice();
            wasm.__wbindgen_free(arg3, arg4 * 1, 1);
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2), v0);
            return ret;
        },
        __wbg_call_63dc0a09228b0d75: function(arg0, arg1, arg2) {
            arg0.call(arg1, BigInt.asUintN(64, arg2));
        },
        __wbg_call_67684ed6a0d5b5e5: function(arg0, arg1, arg2, arg3, arg4) {
            var v0 = getArrayU8FromWasm0(arg3, arg4).slice();
            wasm.__wbindgen_free(arg3, arg4 * 1, 1);
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2), v0);
            return ret;
        },
        __wbg_call_6929997fb776936a: function(arg0, arg1, arg2) {
            arg0.call(arg1, BigInt.asUintN(64, arg2));
        },
        __wbg_call_698f3f0f8a5f3cc4: function(arg0, arg1, arg2) {
            arg0.call(arg1, BigInt.asUintN(64, arg2));
        },
        __wbg_call_69c80f8e466975a5: function(arg0, arg1, arg2) {
            arg0.call(arg1, BigInt.asUintN(64, arg2));
        },
        __wbg_call_6a5a2eb3a2fc5977: function(arg0, arg1, arg2) {
            arg0.call(arg1, BigInt.asUintN(64, arg2));
        },
        __wbg_call_70dfa3ed63405d6e: function(arg0, arg1, arg2, arg3, arg4) {
            var v0 = getArrayU8FromWasm0(arg3, arg4).slice();
            wasm.__wbindgen_free(arg3, arg4 * 1, 1);
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2), v0);
            return ret;
        },
        __wbg_call_72bfa3260cbb620c: function(arg0, arg1, arg2, arg3) {
            arg0.call(arg1, BigInt.asUintN(64, arg2), arg3);
        },
        __wbg_call_735cca4956ca58c2: function(arg0, arg1, arg2) {
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2));
            return ret;
        },
        __wbg_call_73ecc31dcdef7ddc: function(arg0, arg1, arg2, arg3, arg4) {
            var v0 = getArrayU8FromWasm0(arg3, arg4).slice();
            wasm.__wbindgen_free(arg3, arg4 * 1, 1);
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2), v0);
            return ret;
        },
        __wbg_call_78f6102a9d0e96e2: function(arg0, arg1, arg2) {
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2));
            return ret;
        },
        __wbg_call_7be351e23ee2625f: function(arg0, arg1, arg2, arg3, arg4, arg5, arg6) {
            var v0 = getArrayU8FromWasm0(arg3, arg4).slice();
            wasm.__wbindgen_free(arg3, arg4 * 1, 1);
            var v1 = getArrayU8FromWasm0(arg5, arg6).slice();
            wasm.__wbindgen_free(arg5, arg6 * 1, 1);
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2), v0, v1);
            return ret;
        },
        __wbg_call_7cb11d54109a55f1: function(arg0, arg1, arg2) {
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2));
            return ret;
        },
        __wbg_call_7e3f2348814105eb: function(arg0, arg1, arg2) {
            arg0.call(arg1, BigInt.asUintN(64, arg2));
        },
        __wbg_call_813826b4b22fa7f4: function(arg0, arg1, arg2) {
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2));
            return ret;
        },
        __wbg_call_85843a44a12a5529: function(arg0, arg1, arg2, arg3, arg4) {
            var v0 = getArrayU8FromWasm0(arg3, arg4).slice();
            wasm.__wbindgen_free(arg3, arg4 * 1, 1);
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2), v0);
            return ret;
        },
        __wbg_call_85c7ed94987b0ceb: function(arg0, arg1, arg2) {
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2));
            return ret;
        },
        __wbg_call_86fb7f1583ea340b: function(arg0, arg1, arg2) {
            arg0.call(arg1, BigInt.asUintN(64, arg2));
        },
        __wbg_call_89cca0458bf55287: function(arg0, arg1, arg2) {
            arg0.call(arg1, BigInt.asUintN(64, arg2));
        },
        __wbg_call_8a9541ea72c600d6: function(arg0, arg1, arg2, arg3, arg4) {
            var v0 = getArrayU8FromWasm0(arg3, arg4).slice();
            wasm.__wbindgen_free(arg3, arg4 * 1, 1);
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2), v0);
            return ret;
        },
        __wbg_call_8c566b2b7bf7c43f: function(arg0, arg1, arg2) {
            arg0.call(arg1, BigInt.asUintN(64, arg2));
        },
        __wbg_call_8dfe68a1c6b94d2c: function(arg0, arg1, arg2) {
            arg0.call(arg1, BigInt.asUintN(64, arg2));
        },
        __wbg_call_8ebc2836f580c1db: function(arg0, arg1, arg2, arg3, arg4) {
            var v0 = getArrayU8FromWasm0(arg3, arg4).slice();
            wasm.__wbindgen_free(arg3, arg4 * 1, 1);
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2), v0);
            return ret;
        },
        __wbg_call_8fed810e24efab6e: function(arg0, arg1, arg2, arg3, arg4) {
            var v0 = getArrayU8FromWasm0(arg3, arg4).slice();
            wasm.__wbindgen_free(arg3, arg4 * 1, 1);
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2), v0);
            return ret;
        },
        __wbg_call_94c0cfd2267d0578: function(arg0, arg1, arg2) {
            arg0.call(arg1, BigInt.asUintN(64, arg2));
        },
        __wbg_call_967bd4263a127ec7: function(arg0, arg1, arg2, arg3, arg4) {
            var v0 = getArrayU8FromWasm0(arg3, arg4).slice();
            wasm.__wbindgen_free(arg3, arg4 * 1, 1);
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2), v0);
            return ret;
        },
        __wbg_call_976b7047eebec8de: function(arg0, arg1, arg2) {
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2));
            return ret;
        },
        __wbg_call_98b7c3a9ea64d40f: function(arg0, arg1, arg2) {
            arg0.call(arg1, BigInt.asUintN(64, arg2));
        },
        __wbg_call_9a39e6b898a689ed: function(arg0) {
            const ret = arg0.call;
            return ret;
        },
        __wbg_call_9ad24489da744c11: function(arg0, arg1, arg2, arg3, arg4) {
            var v0 = getArrayU8FromWasm0(arg3, arg4).slice();
            wasm.__wbindgen_free(arg3, arg4 * 1, 1);
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2), v0);
            return ret;
        },
        __wbg_call_9adbaab853f363b7: function(arg0, arg1, arg2, arg3, arg4) {
            var v0 = getArrayU8FromWasm0(arg3, arg4).slice();
            wasm.__wbindgen_free(arg3, arg4 * 1, 1);
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2), v0);
            return ret;
        },
        __wbg_call_9c3c2934cc777250: function(arg0, arg1, arg2) {
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2));
            return ret;
        },
        __wbg_call_9c82adf175e231fd: function(arg0, arg1, arg2, arg3, arg4) {
            var v0 = getArrayU8FromWasm0(arg3, arg4).slice();
            wasm.__wbindgen_free(arg3, arg4 * 1, 1);
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2), v0);
            return ret;
        },
        __wbg_call_9ed3b9dc62b44ea9: function(arg0, arg1, arg2) {
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2));
            return ret;
        },
        __wbg_call_9f566fef9c9c4bb0: function(arg0, arg1, arg2) {
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2));
            return ret;
        },
        __wbg_call_9fff973d97c20f92: function(arg0, arg1, arg2, arg3, arg4) {
            var v0 = getArrayU8FromWasm0(arg3, arg4).slice();
            wasm.__wbindgen_free(arg3, arg4 * 1, 1);
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2), v0);
            return ret;
        },
        __wbg_call_a163f583eb7abe50: function(arg0, arg1, arg2) {
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2));
            return ret;
        },
        __wbg_call_a17ec3fa319f2c7f: function(arg0, arg1, arg2) {
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2));
            return ret;
        },
        __wbg_call_a3230dcca106e694: function(arg0, arg1, arg2) {
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2));
            return ret;
        },
        __wbg_call_a404f3b61571b85e: function(arg0, arg1, arg2) {
            arg0.call(arg1, BigInt.asUintN(64, arg2));
        },
        __wbg_call_a492ecd8f05a0756: function(arg0, arg1, arg2) {
            arg0.call(arg1, BigInt.asUintN(64, arg2));
        },
        __wbg_call_a513240dd035572c: function(arg0, arg1, arg2) {
            arg0.call(arg1, BigInt.asUintN(64, arg2));
        },
        __wbg_call_a5fe5d9bc616f6ae: function(arg0, arg1, arg2) {
            arg0.call(arg1, BigInt.asUintN(64, arg2));
        },
        __wbg_call_a91c99c4445f28ca: function(arg0, arg1, arg2) {
            arg0.call(arg1, BigInt.asUintN(64, arg2));
        },
        __wbg_call_a9cc358f5072717c: function(arg0, arg1, arg2, arg3, arg4) {
            var v0 = getArrayU8FromWasm0(arg3, arg4).slice();
            wasm.__wbindgen_free(arg3, arg4 * 1, 1);
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2), v0);
            return ret;
        },
        __wbg_call_a9f3f6df957aa489: function(arg0, arg1, arg2, arg3, arg4, arg5, arg6) {
            var v0 = getArrayU8FromWasm0(arg3, arg4).slice();
            wasm.__wbindgen_free(arg3, arg4 * 1, 1);
            var v1 = getArrayU8FromWasm0(arg5, arg6).slice();
            wasm.__wbindgen_free(arg5, arg6 * 1, 1);
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2), v0, v1);
            return ret;
        },
        __wbg_call_ab9d85fd4ad38a3f: function(arg0, arg1, arg2, arg3, arg4) {
            var v0 = getArrayU8FromWasm0(arg3, arg4).slice();
            wasm.__wbindgen_free(arg3, arg4 * 1, 1);
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2), v0);
            return ret;
        },
        __wbg_call_af226efcb97bfafe: function(arg0, arg1, arg2) {
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2));
            return ret;
        },
        __wbg_call_b072aa04c50cbdfe: function(arg0, arg1, arg2) {
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2));
            return ret;
        },
        __wbg_call_b9b4b1d0619680ef: function(arg0, arg1, arg2) {
            arg0.call(arg1, BigInt.asUintN(64, arg2));
        },
        __wbg_call_bbc6d0aa46dd2381: function(arg0, arg1, arg2, arg3, arg4) {
            var v0 = getArrayU8FromWasm0(arg3, arg4).slice();
            wasm.__wbindgen_free(arg3, arg4 * 1, 1);
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2), v0);
            return ret;
        },
        __wbg_call_bed87b11dd38c86d: function(arg0) {
            const ret = arg0.call;
            return ret;
        },
        __wbg_call_c09e0bf92a3181d4: function(arg0, arg1, arg2, arg3, arg4) {
            var v0 = getArrayU8FromWasm0(arg3, arg4).slice();
            wasm.__wbindgen_free(arg3, arg4 * 1, 1);
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2), v0);
            return ret;
        },
        __wbg_call_c13d61f92a750d48: function(arg0, arg1, arg2, arg3, arg4) {
            var v0 = getArrayU8FromWasm0(arg3, arg4).slice();
            wasm.__wbindgen_free(arg3, arg4 * 1, 1);
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2), v0);
            return ret;
        },
        __wbg_call_c1e6491a658a0544: function(arg0, arg1, arg2) {
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2));
            return ret;
        },
        __wbg_call_c24d6ee3c8c072f6: function(arg0, arg1, arg2) {
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2));
            return ret;
        },
        __wbg_call_c4cbd181b294eb8e: function(arg0, arg1, arg2) {
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2));
            return ret;
        },
        __wbg_call_c5beb0530187e11c: function(arg0, arg1, arg2) {
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2));
            return ret;
        },
        __wbg_call_c63148f4fb4a47af: function(arg0, arg1, arg2) {
            arg0.call(arg1, BigInt.asUintN(64, arg2));
        },
        __wbg_call_c6c8d12aebcd5213: function(arg0) {
            const ret = arg0.call;
            return ret;
        },
        __wbg_call_c821be6f8e9c640d: function(arg0, arg1, arg2) {
            arg0.call(arg1, BigInt.asUintN(64, arg2));
        },
        __wbg_call_c850e9ff84d3f25e: function(arg0, arg1, arg2) {
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2));
            return ret;
        },
        __wbg_call_cc0ddc0c7b9b585f: function(arg0, arg1, arg2) {
            arg0.call(arg1, BigInt.asUintN(64, arg2));
        },
        __wbg_call_d16240d62073371d: function(arg0, arg1, arg2) {
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2));
            return ret;
        },
        __wbg_call_d5ed72d67ff99268: function(arg0, arg1, arg2, arg3, arg4) {
            var v0 = getArrayU8FromWasm0(arg3, arg4).slice();
            wasm.__wbindgen_free(arg3, arg4 * 1, 1);
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2), v0);
            return ret;
        },
        __wbg_call_d6a84f6e72b9c7b5: function(arg0, arg1, arg2) {
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2));
            return ret;
        },
        __wbg_call_d93b7c893bbf370b: function(arg0, arg1, arg2) {
            arg0.call(arg1, BigInt.asUintN(64, arg2));
        },
        __wbg_call_da063ba31e8e1de5: function(arg0, arg1, arg2) {
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2));
            return ret;
        },
        __wbg_call_db6a1e27b65e5783: function(arg0, arg1, arg2) {
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2));
            return ret;
        },
        __wbg_call_e00bf69690ca664d: function(arg0, arg1, arg2) {
            arg0.call(arg1, BigInt.asUintN(64, arg2));
        },
        __wbg_call_e09e74ad6ac5e51a: function(arg0, arg1, arg2) {
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2));
            return ret;
        },
        __wbg_call_e133b57c9155d22c: function() { return handleError(function (arg0, arg1) {
            const ret = arg0.call(arg1);
            return ret;
        }, arguments); },
        __wbg_call_e237d1964852ab32: function(arg0, arg1, arg2, arg3, arg4) {
            var v0 = getArrayU8FromWasm0(arg3, arg4).slice();
            wasm.__wbindgen_free(arg3, arg4 * 1, 1);
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2), v0);
            return ret;
        },
        __wbg_call_e248c242e4f503a6: function(arg0, arg1, arg2) {
            arg0.call(arg1, BigInt.asUintN(64, arg2));
        },
        __wbg_call_e4dd0de1041cc9dc: function(arg0, arg1, arg2) {
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2));
            return ret;
        },
        __wbg_call_e78eaf6fb3323422: function(arg0, arg1, arg2, arg3, arg4) {
            var v0 = getArrayU8FromWasm0(arg3, arg4).slice();
            wasm.__wbindgen_free(arg3, arg4 * 1, 1);
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2), v0);
            return ret;
        },
        __wbg_call_ea4e4896824e25c8: function(arg0, arg1, arg2, arg3, arg4) {
            var v0 = getArrayU8FromWasm0(arg3, arg4).slice();
            wasm.__wbindgen_free(arg3, arg4 * 1, 1);
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2), v0);
            return ret;
        },
        __wbg_call_eb9f07a975b1fa0f: function(arg0, arg1, arg2) {
            arg0.call(arg1, BigInt.asUintN(64, arg2));
        },
        __wbg_call_ed21542a2011179f: function(arg0, arg1, arg2, arg3, arg4) {
            var v0 = getArrayU8FromWasm0(arg3, arg4).slice();
            wasm.__wbindgen_free(arg3, arg4 * 1, 1);
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2), v0);
            return ret;
        },
        __wbg_call_ee6188075db5cf33: function(arg0, arg1, arg2, arg3, arg4) {
            var v0 = getArrayU8FromWasm0(arg3, arg4).slice();
            wasm.__wbindgen_free(arg3, arg4 * 1, 1);
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2), v0);
            return ret;
        },
        __wbg_call_efe8f080d8af8508: function(arg0, arg1, arg2) {
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2));
            return ret;
        },
        __wbg_call_f18737f9b4970868: function(arg0, arg1, arg2) {
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2));
            return ret;
        },
        __wbg_call_f2c920ce89ac0822: function(arg0, arg1, arg2, arg3, arg4) {
            var v0 = getArrayU8FromWasm0(arg3, arg4).slice();
            wasm.__wbindgen_free(arg3, arg4 * 1, 1);
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2), v0);
            return ret;
        },
        __wbg_call_f2dc147298354c9b: function(arg0, arg1, arg2, arg3, arg4) {
            var v0 = getArrayU8FromWasm0(arg3, arg4).slice();
            wasm.__wbindgen_free(arg3, arg4 * 1, 1);
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2), v0);
            return ret;
        },
        __wbg_call_f3343d026df2bbc4: function(arg0, arg1, arg2) {
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2));
            return ret;
        },
        __wbg_call_f3a5e816c5c6f2f1: function(arg0, arg1, arg2) {
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2));
            return ret;
        },
        __wbg_call_f44f49016c828b49: function(arg0, arg1, arg2) {
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2));
            return ret;
        },
        __wbg_call_f4ecbb031da1a44b: function(arg0, arg1, arg2, arg3, arg4) {
            var v0 = getArrayU8FromWasm0(arg3, arg4).slice();
            wasm.__wbindgen_free(arg3, arg4 * 1, 1);
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2), v0);
            return ret;
        },
        __wbg_call_f903f346a6aff677: function(arg0, arg1, arg2, arg3) {
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2), arg3);
            return ret;
        },
        __wbg_call_f9939dbd752b2ac2: function(arg0, arg1, arg2) {
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2));
            return ret;
        },
        __wbg_call_fabc8536747b5fbe: function(arg0, arg1, arg2) {
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2));
            return ret;
        },
        __wbg_call_fb5c8a6f0d7bd7eb: function(arg0) {
            const ret = arg0.call;
            return ret;
        },
        __wbg_call_fd844a67361e41ba: function(arg0, arg1, arg2, arg3, arg4) {
            var v0 = getArrayU8FromWasm0(arg3, arg4).slice();
            wasm.__wbindgen_free(arg3, arg4 * 1, 1);
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2), v0);
            return ret;
        },
        __wbg_call_fd93a7d9e0fdbe56: function(arg0, arg1, arg2) {
            const ret = arg0.call(arg1, BigInt.asUintN(64, arg2));
            return ret;
        },
        __wbg_call_fe74baeb701bfad2: function(arg0, arg1, arg2) {
            arg0.call(arg1, BigInt.asUintN(64, arg2));
        },
        __wbg_clearTimeout_113b1cde814ec762: function(arg0) {
            const ret = clearTimeout(arg0);
            return ret;
        },
        __wbg_clearTimeout_2256f1e7b94ef517: function(arg0) {
            const ret = clearTimeout(arg0);
            return ret;
        },
        __wbg_clear_1885f7bf35006b0c: function() { return handleError(function (arg0) {
            const ret = arg0.clear();
            return ret;
        }, arguments); },
        __wbg_close_cbf870bdad0aad99: function(arg0) {
            arg0.close();
        },
        __wbg_code_bc4dde4d67926010: function(arg0) {
            const ret = arg0.code;
            return ret;
        },
        __wbg_code_c0d85ccf18beb8b1: function(arg0) {
            const ret = arg0.code;
            return ret;
        },
        __wbg_code_d6f504aac527cb57: function(arg0) {
            const ret = arg0.code;
            return ret;
        },
        __wbg_commit_ebd6d9676954e0d2: function() { return handleError(function (arg0) {
            arg0.commit();
        }, arguments); },
        __wbg_continue_44abcf9ba406e87e: function() { return handleError(function (arg0) {
            arg0.continue();
        }, arguments); },
        __wbg_count_788ed31b2dfcb569: function() { return handleError(function (arg0, arg1) {
            const ret = arg0.count(arg1);
            return ret;
        }, arguments); },
        __wbg_count_8e33bb4fa72dbb75: function() { return handleError(function (arg0) {
            const ret = arg0.count();
            return ret;
        }, arguments); },
        __wbg_count_9e4655e0ae60b3fa: function() { return handleError(function (arg0) {
            const ret = arg0.count();
            return ret;
        }, arguments); },
        __wbg_count_c6fb7d5ecbe69368: function() { return handleError(function (arg0, arg1) {
            const ret = arg0.count(arg1);
            return ret;
        }, arguments); },
        __wbg_createIndex_323cb0213cc21d9b: function() { return handleError(function (arg0, arg1, arg2, arg3, arg4) {
            const ret = arg0.createIndex(getStringFromWasm0(arg1, arg2), arg3, arg4);
            return ret;
        }, arguments); },
        __wbg_createIndex_38ef2e77937beaca: function() { return handleError(function (arg0, arg1, arg2, arg3) {
            const ret = arg0.createIndex(getStringFromWasm0(arg1, arg2), arg3);
            return ret;
        }, arguments); },
        __wbg_createObjectStore_4709de9339ffc6c0: function() { return handleError(function (arg0, arg1, arg2, arg3) {
            const ret = arg0.createObjectStore(getStringFromWasm0(arg1, arg2), arg3);
            return ret;
        }, arguments); },
        __wbg_createObjectStore_92a8aebcc6f9d7e3: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = arg0.createObjectStore(getStringFromWasm0(arg1, arg2));
            return ret;
        }, arguments); },
        __wbg_crypto_0a92367f02a93895: function(arg0) {
            const ret = arg0.crypto;
            return ret;
        },
        __wbg_deleteObjectStore_65401ab024ac08c1: function() { return handleError(function (arg0, arg1, arg2) {
            arg0.deleteObjectStore(getStringFromWasm0(arg1, arg2));
        }, arguments); },
        __wbg_delete_40db93c05c546fb9: function() { return handleError(function (arg0, arg1) {
            const ret = arg0.delete(arg1);
            return ret;
        }, arguments); },
        __wbg_delete_6bc762d51ba2711d: function() { return handleError(function (arg0) {
            const ret = arg0.delete();
            return ret;
        }, arguments); },
        __wbg_did_accept_verification_request_c4934d1eeb37a30c: function(arg0) {
            const ret = arg0.did_accept_verification_request;
            return ret;
        },
        __wbg_did_cancel_f98421c0b9737f80: function(arg0) {
            const ret = arg0.did_cancel;
            return ret;
        },
        __wbg_did_fail_7ccc3276a591fc97: function(arg0) {
            const ret = arg0.did_fail;
            return ret;
        },
        __wbg_did_finish_27d818bb976e207a: function(arg0) {
            const ret = arg0.did_finish;
            return ret;
        },
        __wbg_did_receive_auth_error_b93d61ac48cc7a06: function(arg0) {
            const ret = arg0.did_receive_auth_error;
            return ret;
        },
        __wbg_did_receive_verification_data_a6ecb981be9a2caa: function(arg0) {
            const ret = arg0.did_receive_verification_data;
            return ret;
        },
        __wbg_did_receive_verification_request_1a4e2afd8ead20dc: function(arg0) {
            const ret = arg0.did_receive_verification_request;
            return ret;
        },
        __wbg_did_start_sas_verification_324eb4f8af61eabf: function(arg0) {
            const ret = arg0.did_start_sas_verification;
            return ret;
        },
        __wbg_done_08ce71ee07e3bd17: function(arg0) {
            const ret = arg0.done;
            return ret;
        },
        __wbg_entries_5b8fe91cea59610e: function(arg0) {
            const ret = arg0.entries();
            return ret;
        },
        __wbg_entries_e8a20ff8c9757101: function(arg0) {
            const ret = Object.entries(arg0);
            return ret;
        },
        __wbg_error_74898554122344a8: function() { return handleError(function (arg0) {
            const ret = arg0.error;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        }, arguments); },
        __wbg_error_a6fa202b58aa1cd3: function(arg0, arg1) {
            let deferred0_0;
            let deferred0_1;
            try {
                deferred0_0 = arg0;
                deferred0_1 = arg1;
                console.error(getStringFromWasm0(arg0, arg1));
            } finally {
                wasm.__wbindgen_free(deferred0_0, deferred0_1, 1);
            }
        },
        __wbg_error_buf_6dff5db755165595: function(arg0, arg1) {
            const ret = arg1.errorBuf;
            var ptr1 = isLikeNone(ret) ? 0 : passArray8ToWasm0(ret, wasm.__wbindgen_malloc);
            var len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg_error_buf_891d0c95c5836d53: function(arg0, arg1) {
            const ret = arg1.errorBuf;
            var ptr1 = isLikeNone(ret) ? 0 : passArray8ToWasm0(ret, wasm.__wbindgen_malloc);
            var len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg_fetch_43b2f110608a59ff: function(arg0) {
            const ret = fetch(arg0);
            return ret;
        },
        __wbg_fetch_5550a88cf343aaa9: function(arg0, arg1) {
            const ret = arg0.fetch(arg1);
            return ret;
        },
        __wbg_getAllKeys_51b926ff4a4de3b2: function() { return handleError(function (arg0, arg1) {
            const ret = arg0.getAllKeys(arg1);
            return ret;
        }, arguments); },
        __wbg_getAllKeys_578e442e4cc4c2b4: function() { return handleError(function (arg0) {
            const ret = arg0.getAllKeys();
            return ret;
        }, arguments); },
        __wbg_getAll_5ed401da69904dee: function() { return handleError(function (arg0) {
            const ret = arg0.getAll();
            return ret;
        }, arguments); },
        __wbg_getAll_690f659b57ae2d51: function() { return handleError(function (arg0) {
            const ret = arg0.getAll();
            return ret;
        }, arguments); },
        __wbg_getAll_a959860fbb7a424a: function() { return handleError(function (arg0, arg1) {
            const ret = arg0.getAll(arg1);
            return ret;
        }, arguments); },
        __wbg_getAll_abff748aa6f1c273: function() { return handleError(function (arg0, arg1) {
            const ret = arg0.getAll(arg1);
            return ret;
        }, arguments); },
        __wbg_getAll_b4181cf52224a271: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = arg0.getAll(arg1, arg2 >>> 0);
            return ret;
        }, arguments); },
        __wbg_getRandomValues_49053454921dcaf8: function() { return handleError(function (arg0, arg1) {
            globalThis.crypto.getRandomValues(getArrayU8FromWasm0(arg0, arg1));
        }, arguments); },
        __wbg_getRandomValues_76dfc69825c9c552: function() { return handleError(function (arg0, arg1) {
            globalThis.crypto.getRandomValues(getArrayU8FromWasm0(arg0, arg1));
        }, arguments); },
        __wbg_getRandomValues_d3f1739dc62f980a: function() { return handleError(function (arg0, arg1) {
            arg0.getRandomValues(arg1);
        }, arguments); },
        __wbg_getTime_1dad7b5386ddd2d9: function(arg0) {
            const ret = arg0.getTime();
            return ret;
        },
        __wbg_getTimezoneOffset_639bcf2dde21158b: function(arg0) {
            const ret = arg0.getTimezoneOffset();
            return ret;
        },
        __wbg_get_326e41e095fb2575: function() { return handleError(function (arg0, arg1) {
            const ret = Reflect.get(arg0, arg1);
            return ret;
        }, arguments); },
        __wbg_get_3ef1eba1850ade27: function() { return handleError(function (arg0, arg1) {
            const ret = Reflect.get(arg0, arg1);
            return ret;
        }, arguments); },
        __wbg_get_6ac8c8119f577720: function() { return handleError(function (arg0, arg1) {
            const ret = arg0.get(arg1);
            return ret;
        }, arguments); },
        __wbg_get_a8ee5c45dabc1b3b: function(arg0, arg1) {
            const ret = arg0[arg1 >>> 0];
            return ret;
        },
        __wbg_get_ddeb0483be6ef0ef: function() { return handleError(function (arg0, arg1) {
            const ret = arg0.get(arg1);
            return ret;
        }, arguments); },
        __wbg_get_unchecked_329cfe50afab7352: function(arg0, arg1) {
            const ret = arg0[arg1 >>> 0];
            return ret;
        },
        __wbg_get_with_ref_key_6412cf3094599694: function(arg0, arg1) {
            const ret = arg0[arg1];
            return ret;
        },
        __wbg_global_94a489d2e6a0c5fd: function(arg0) {
            const ret = arg0.global;
            return ret;
        },
        __wbg_has_926ef2ff40b308cf: function() { return handleError(function (arg0, arg1) {
            const ret = Reflect.has(arg0, arg1);
            return ret;
        }, arguments); },
        __wbg_headers_eb2234545f9ff993: function(arg0) {
            const ret = arg0.headers;
            return ret;
        },
        __wbg_index_f1b3b30c5d5af6fb: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = arg0.index(getStringFromWasm0(arg1, arg2));
            return ret;
        }, arguments); },
        __wbg_indexedDB_2ae2128d487c6ebc: function() { return handleError(function (arg0) {
            const ret = arg0.indexedDB;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        }, arguments); },
        __wbg_indexedDB_47c354eb27472a00: function() { return handleError(function (arg0) {
            const ret = arg0.indexedDB;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        }, arguments); },
        __wbg_indexedDB_c83feb7151bbde52: function() { return handleError(function (arg0) {
            const ret = arg0.indexedDB;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        }, arguments); },
        __wbg_instanceof_ArrayBuffer_101e2bf31071a9f6: function(arg0) {
            let result;
            try {
                result = arg0 instanceof ArrayBuffer;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_instanceof_CursorSys_383984afc1fa1bbc: function(arg0) {
            let result;
            try {
                result = arg0 instanceof IDBCursorWithValue;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_instanceof_DomException_2bdcf7791a2d7d09: function(arg0) {
            let result;
            try {
                result = arg0 instanceof DOMException;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_instanceof_Error_4691a5b466e32a80: function(arg0) {
            let result;
            try {
                result = arg0 instanceof Error;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_instanceof_IdbCursor_cbe52b3829ab983b: function(arg0) {
            let result;
            try {
                result = arg0 instanceof IDBCursor;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_instanceof_IdbDatabase_5f436cc89cc07f14: function(arg0) {
            let result;
            try {
                result = arg0 instanceof IDBDatabase;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_instanceof_IdbOpenDbRequest_10c2576001eb6613: function(arg0) {
            let result;
            try {
                result = arg0 instanceof IDBOpenDBRequest;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_instanceof_IdbRequest_6a0e24572d4f1d46: function(arg0) {
            let result;
            try {
                result = arg0 instanceof IDBRequest;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_instanceof_Map_f194b366846aca0c: function(arg0) {
            let result;
            try {
                result = arg0 instanceof Map;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_instanceof_Response_9b4d9fd451e051b1: function(arg0) {
            let result;
            try {
                result = arg0 instanceof Response;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_instanceof_Uint8Array_740438561a5b956d: function(arg0) {
            let result;
            try {
                result = arg0 instanceof Uint8Array;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_isArray_33b91feb269ff46e: function(arg0) {
            const ret = Array.isArray(arg0);
            return ret;
        },
        __wbg_isArray_42f3245bcac28e65: function(arg0) {
            const ret = Array.isArray(arg0);
            return ret;
        },
        __wbg_isSafeInteger_ecd6a7f9c3e053cd: function(arg0) {
            const ret = Number.isSafeInteger(arg0);
            return ret;
        },
        __wbg_item_f0d01dd089cc05ba: function(arg0, arg1, arg2) {
            const ret = arg1.item(arg2 >>> 0);
            var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            var len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg_iterator_d8f549ec8fb061b1: function() {
            const ret = Symbol.iterator;
            return ret;
        },
        __wbg_key_581f2698de7f8240: function() { return handleError(function (arg0) {
            const ret = arg0.key;
            return ret;
        }, arguments); },
        __wbg_length_b3416cf66a5452c8: function(arg0) {
            const ret = arg0.length;
            return ret;
        },
        __wbg_length_ea16607d7b61445b: function(arg0) {
            const ret = arg0.length;
            return ret;
        },
        __wbg_lowerBound_7dd256f30bc73b4e: function() { return handleError(function (arg0, arg1) {
            const ret = IDBKeyRange.lowerBound(arg0, arg1 !== 0);
            return ret;
        }, arguments); },
        __wbg_message_00d63f20c41713dd: function(arg0) {
            const ret = arg0.message;
            return ret;
        },
        __wbg_message_e959edc81e4b6cb7: function(arg0, arg1) {
            const ret = arg1.message;
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg_msCrypto_bcce18ddb1ca6c2d: function(arg0) {
            const ret = arg0.msCrypto;
            return ret;
        },
        __wbg_name_3393c0574942cc57: function(arg0, arg1) {
            const ret = arg1.name;
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg_name_7a3bbd030d0afa16: function(arg0, arg1) {
            const ret = arg1.name;
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg_new_0837727332ac86ba: function() { return handleError(function () {
            const ret = new Headers();
            return ret;
        }, arguments); },
        __wbg_new_0_1dcafdf5e786e876: function() {
            const ret = new Date();
            return ret;
        },
        __wbg_new_227d7c05414eb861: function() {
            const ret = new Error();
            return ret;
        },
        __wbg_new_5f486cdf45a04d78: function(arg0) {
            const ret = new Uint8Array(arg0);
            return ret;
        },
        __wbg_new_a70fbab9066b301f: function() {
            const ret = new Array();
            return ret;
        },
        __wbg_new_ab79df5bd7c26067: function() {
            const ret = new Object();
            return ret;
        },
        __wbg_new_c518c60af666645b: function() { return handleError(function () {
            const ret = new AbortController();
            return ret;
        }, arguments); },
        __wbg_new_d15cb560a6a0e5f0: function(arg0, arg1) {
            const ret = new Error(getStringFromWasm0(arg0, arg1));
            return ret;
        },
        __wbg_new_fd94ca5c9639abd2: function(arg0) {
            const ret = new Date(arg0);
            return ret;
        },
        __wbg_new_from_slice_22da9388ac046e50: function(arg0, arg1) {
            const ret = new Uint8Array(getArrayU8FromWasm0(arg0, arg1));
            return ret;
        },
        __wbg_new_typed_bccac67128ed885a: function() {
            const ret = new Array();
            return ret;
        },
        __wbg_new_with_length_825018a1616e9e55: function(arg0) {
            const ret = new Uint8Array(arg0 >>> 0);
            return ret;
        },
        __wbg_new_with_message_and_name_9ecedc0e6daf421c: function() { return handleError(function (arg0, arg1, arg2, arg3) {
            const ret = new DOMException(getStringFromWasm0(arg0, arg1), getStringFromWasm0(arg2, arg3));
            return ret;
        }, arguments); },
        __wbg_new_with_str_and_init_b4b54d1a819bc724: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = new Request(getStringFromWasm0(arg0, arg1), arg2);
            return ret;
        }, arguments); },
        __wbg_next_11b99ee6237339e3: function() { return handleError(function (arg0) {
            const ret = arg0.next();
            return ret;
        }, arguments); },
        __wbg_next_e01a967809d1aa68: function(arg0) {
            const ret = arg0.next;
            return ret;
        },
        __wbg_node_8ae12470cbc10fa7: function(arg0) {
            const ret = arg0.node;
            return ret;
        },
        __wbg_now_16f0c993d5dd6c27: function() {
            const ret = Date.now();
            return ret;
        },
        __wbg_now_e7c6795a7f81e10f: function(arg0) {
            const ret = arg0.now();
            return ret;
        },
        __wbg_objectStoreNames_564985d2e9ae7523: function(arg0) {
            const ret = arg0.objectStoreNames;
            return ret;
        },
        __wbg_objectStore_f314ab152a5c7bd0: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = arg0.objectStore(getStringFromWasm0(arg1, arg2));
            return ret;
        }, arguments); },
        __wbg_oldVersion_c28aefdefa84030a: function(arg0) {
            const ret = arg0.oldVersion;
            return ret;
        },
        __wbg_on_background_task_error_report_8d2744ebddbf9316: function(arg0) {
            const ret = arg0.on_background_task_error_report;
            return ret;
        },
        __wbg_on_change_27feeeb130410f48: function(arg0) {
            const ret = arg0.on_change;
            return ret;
        },
        __wbg_on_change_eb4abd440b39e392: function(arg0) {
            const ret = arg0.on_change;
            return ret;
        },
        __wbg_on_change_ee31b38b4fa3e9c1: function(arg0) {
            const ret = arg0.on_change;
            return ret;
        },
        __wbg_on_duplicate_key_upload_error_0f93db382d5f4c38: function(arg0) {
            const ret = arg0.on_duplicate_key_upload_error;
            return ret;
        },
        __wbg_on_error_19c35721897ce340: function(arg0) {
            const ret = arg0.on_error;
            return ret;
        },
        __wbg_on_notification_104f3cff01c2ba29: function(arg0) {
            const ret = arg0.on_notification;
            return ret;
        },
        __wbg_on_update_02a799f41a37bbf1: function(arg0) {
            const ret = arg0.on_update;
            return ret;
        },
        __wbg_on_update_0316a23baaab2ea7: function(arg0) {
            const ret = arg0.on_update;
            return ret;
        },
        __wbg_on_update_0764074b03924462: function(arg0) {
            const ret = arg0.on_update;
            return ret;
        },
        __wbg_on_update_21f01e5556b354fb: function(arg0) {
            const ret = arg0.on_update;
            return ret;
        },
        __wbg_on_update_373b9f16a33c981a: function(arg0) {
            const ret = arg0.on_update;
            return ret;
        },
        __wbg_on_update_4413d72b27dab22b: function(arg0) {
            const ret = arg0.on_update;
            return ret;
        },
        __wbg_on_update_4861c3fcd65e13fe: function(arg0) {
            const ret = arg0.on_update;
            return ret;
        },
        __wbg_on_update_4b4f08966cfed35d: function(arg0) {
            const ret = arg0.on_update;
            return ret;
        },
        __wbg_on_update_4c53f0fd0be93ef1: function(arg0) {
            const ret = arg0.on_update;
            return ret;
        },
        __wbg_on_update_531c3bc27a4f67c2: function(arg0) {
            const ret = arg0.on_update;
            return ret;
        },
        __wbg_on_update_5a536a772729bc57: function(arg0) {
            const ret = arg0.on_update;
            return ret;
        },
        __wbg_on_update_5daecc7e126abdc0: function(arg0) {
            const ret = arg0.on_update;
            return ret;
        },
        __wbg_on_update_60c3f41839cd3eb6: function(arg0) {
            const ret = arg0.on_update;
            return ret;
        },
        __wbg_on_update_642664ed2234bd3a: function(arg0) {
            const ret = arg0.on_update;
            return ret;
        },
        __wbg_on_update_7bc1dae3722be0f1: function(arg0) {
            const ret = arg0.on_update;
            return ret;
        },
        __wbg_on_update_83fcf2b768668f59: function(arg0) {
            const ret = arg0.on_update;
            return ret;
        },
        __wbg_on_update_8579483389316f3f: function(arg0) {
            const ret = arg0.on_update;
            return ret;
        },
        __wbg_on_update_8733a407dc437b29: function(arg0) {
            const ret = arg0.on_update;
            return ret;
        },
        __wbg_on_update_95d8e8e73013e4be: function(arg0) {
            const ret = arg0.on_update;
            return ret;
        },
        __wbg_on_update_ab00ec2a3fcc4a2e: function(arg0) {
            const ret = arg0.on_update;
            return ret;
        },
        __wbg_on_update_b3abc97b0ccb55bb: function(arg0) {
            const ret = arg0.on_update;
            return ret;
        },
        __wbg_on_update_b635110b93d9dfbc: function(arg0) {
            const ret = arg0.on_update;
            return ret;
        },
        __wbg_on_update_b6f834bfe2141088: function(arg0) {
            const ret = arg0.on_update;
            return ret;
        },
        __wbg_on_update_b9a5b050de6bbfaf: function(arg0) {
            const ret = arg0.on_update;
            return ret;
        },
        __wbg_on_update_bb3167ebd3623cd0: function(arg0) {
            const ret = arg0.on_update;
            return ret;
        },
        __wbg_on_update_c663b05e87b2525e: function(arg0) {
            const ret = arg0.on_update;
            return ret;
        },
        __wbg_on_update_c83a7ceecb50c982: function(arg0) {
            const ret = arg0.on_update;
            return ret;
        },
        __wbg_on_update_ecaf2ca191a0e793: function(arg0) {
            const ret = arg0.on_update;
            return ret;
        },
        __wbg_on_update_f6685742a991e4dc: function(arg0) {
            const ret = arg0.on_update;
            return ret;
        },
        __wbg_on_utd_a56a8fc362a45745: function(arg0) {
            const ret = arg0.on_utd;
            return ret;
        },
        __wbg_openCursor_7f0cc3f660850dc1: function() { return handleError(function (arg0) {
            const ret = arg0.openCursor();
            return ret;
        }, arguments); },
        __wbg_openCursor_d2c404b7a149da6b: function() { return handleError(function (arg0, arg1) {
            const ret = arg0.openCursor(arg1);
            return ret;
        }, arguments); },
        __wbg_openCursor_e845b9a1bdca92b8: function() { return handleError(function (arg0) {
            const ret = arg0.openCursor();
            return ret;
        }, arguments); },
        __wbg_openCursor_e8f8c35163e2eca2: function() { return handleError(function (arg0, arg1) {
            const ret = arg0.openCursor(arg1);
            return ret;
        }, arguments); },
        __wbg_openKeyCursor_9248799cbfbe894d: function() { return handleError(function (arg0, arg1) {
            const ret = arg0.openKeyCursor(arg1);
            return ret;
        }, arguments); },
        __wbg_openKeyCursor_9f6910fe6a903666: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = arg0.openKeyCursor(arg1, __wbindgen_enum_IdbCursorDirection[arg2]);
            return ret;
        }, arguments); },
        __wbg_openKeyCursor_a1b14bb2a91eb6e9: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = arg0.openKeyCursor(arg1, __wbindgen_enum_IdbCursorDirection[arg2]);
            return ret;
        }, arguments); },
        __wbg_open_768d1078e6f07723: function() { return handleError(function (arg0, arg1, arg2, arg3) {
            const ret = arg0.open(getStringFromWasm0(arg1, arg2), arg3);
            return ret;
        }, arguments); },
        __wbg_open_e7a9d3d6344572f6: function() { return handleError(function (arg0, arg1, arg2, arg3) {
            const ret = arg0.open(getStringFromWasm0(arg1, arg2), arg3 >>> 0);
            return ret;
        }, arguments); },
        __wbg_open_f3dc09caa3990bc4: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = arg0.open(getStringFromWasm0(arg1, arg2));
            return ret;
        }, arguments); },
        __wbg_parse_e9eddd2a82c706eb: function() { return handleError(function (arg0, arg1) {
            const ret = JSON.parse(getStringFromWasm0(arg0, arg1));
            return ret;
        }, arguments); },
        __wbg_performance_3fcf6e32a7e1ed0a: function(arg0) {
            const ret = arg0.performance;
            return ret;
        },
        __wbg_pointee_a821ce78e51e9bd6: function(arg0, arg1) {
            const ret = arg1.pointee;
            var ptr1 = isLikeNone(ret) ? 0 : passArray8ToWasm0(ret, wasm.__wbindgen_malloc);
            var len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg_process_c9cfbc1e2919260e: function(arg0) {
            const ret = arg0.process;
            return ret;
        },
        __wbg_prototypesetcall_d62e5099504357e6: function(arg0, arg1, arg2) {
            Uint8Array.prototype.set.call(getArrayU8FromWasm0(arg0, arg1), arg2);
        },
        __wbg_push_e87b0e732085a946: function(arg0, arg1) {
            const ret = arg0.push(arg1);
            return ret;
        },
        __wbg_put_ae369598c083f1f5: function() { return handleError(function (arg0, arg1) {
            const ret = arg0.put(arg1);
            return ret;
        }, arguments); },
        __wbg_put_f1673d719f93ce22: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = arg0.put(arg1, arg2);
            return ret;
        }, arguments); },
        __wbg_queueMicrotask_0c399741342fb10f: function(arg0) {
            const ret = arg0.queueMicrotask;
            return ret;
        },
        __wbg_queueMicrotask_a082d78ce798393e: function(arg0) {
            queueMicrotask(arg0);
        },
        __wbg_randomFillSync_143a36904a882f2a: function() { return handleError(function (arg0, arg1) {
            arg0.randomFillSync(arg1);
        }, arguments); },
        __wbg_readyState_57fa0866477cc0c4: function(arg0) {
            const ret = arg0.readyState;
            return (__wbindgen_enum_IdbRequestReadyState.indexOf(ret) + 1 || 3) - 1;
        },
        __wbg_request_64abeba15a72c084: function(arg0) {
            const ret = arg0.request;
            return ret;
        },
        __wbg_request_72a78988f2edecad: function(arg0) {
            const ret = arg0.request;
            return ret;
        },
        __wbg_require_def5a4782aa802ec: function() { return handleError(function () {
            const ret = module.require;
            return ret;
        }, arguments); },
        __wbg_resolve_ae8d83246e5bcc12: function(arg0) {
            const ret = Promise.resolve(arg0);
            return ret;
        },
        __wbg_result_c5baa2d3d690a01a: function() { return handleError(function (arg0) {
            const ret = arg0.result;
            return ret;
        }, arguments); },
        __wbg_retrieve_session_from_keychain_8ac62a6d46ad20d2: function(arg0) {
            const ret = arg0.retrieve_session_from_keychain;
            return ret;
        },
        __wbg_save_session_in_keychain_cbd098a61765558c: function(arg0) {
            const ret = arg0.save_session_in_keychain;
            return ret;
        },
        __wbg_setTimeout_b188b3bcc8977c7d: function(arg0, arg1) {
            const ret = setTimeout(arg0, arg1);
            return ret;
        },
        __wbg_setTimeout_ef24d2fc3ad97385: function() { return handleError(function (arg0, arg1) {
            const ret = setTimeout(arg0, arg1);
            return ret;
        }, arguments); },
        __wbg_set_282384002438957f: function(arg0, arg1, arg2) {
            arg0[arg1 >>> 0] = arg2;
        },
        __wbg_set_6be42768c690e380: function(arg0, arg1, arg2) {
            arg0[arg1] = arg2;
        },
        __wbg_set_body_a3d856b097dfda04: function(arg0, arg1) {
            arg0.body = arg1;
        },
        __wbg_set_cache_ec7e430c6056ebda: function(arg0, arg1) {
            arg0.cache = __wbindgen_enum_RequestCache[arg1];
        },
        __wbg_set_credentials_ed63183445882c65: function(arg0, arg1) {
            arg0.credentials = __wbindgen_enum_RequestCredentials[arg1];
        },
        __wbg_set_headers_3c8fecc693b75327: function(arg0, arg1) {
            arg0.headers = arg1;
        },
        __wbg_set_key_path_3c45a8ff0b89e678: function(arg0, arg1) {
            arg0.keyPath = arg1;
        },
        __wbg_set_method_8c015e8bcafd7be1: function(arg0, arg1, arg2) {
            arg0.method = getStringFromWasm0(arg1, arg2);
        },
        __wbg_set_mode_5a87f2c809cf37c2: function(arg0, arg1) {
            arg0.mode = __wbindgen_enum_RequestMode[arg1];
        },
        __wbg_set_onabort_63885d8d7841a8d5: function(arg0, arg1) {
            arg0.onabort = arg1;
        },
        __wbg_set_oncomplete_f31e6dc6d16c1ff8: function(arg0, arg1) {
            arg0.oncomplete = arg1;
        },
        __wbg_set_onerror_8a268cb237177bba: function(arg0, arg1) {
            arg0.onerror = arg1;
        },
        __wbg_set_onerror_c1ecd6233c533c08: function(arg0, arg1) {
            arg0.onerror = arg1;
        },
        __wbg_set_onsuccess_fca94ded107b64af: function(arg0, arg1) {
            arg0.onsuccess = arg1;
        },
        __wbg_set_onupgradeneeded_860ce42184f987e7: function(arg0, arg1) {
            arg0.onupgradeneeded = arg1;
        },
        __wbg_set_signal_0cebecb698f25d21: function(arg0, arg1) {
            arg0.signal = arg1;
        },
        __wbg_set_unique_a39d85db47f8e025: function(arg0, arg1) {
            arg0.unique = arg1 !== 0;
        },
        __wbg_settings_did_change_1ccc5235085801c8: function(arg0) {
            const ret = arg0.settings_did_change;
            return ret;
        },
        __wbg_signal_166e1da31adcac18: function(arg0) {
            const ret = arg0.signal;
            return ret;
        },
        __wbg_stack_3b0d974bbf31e44f: function(arg0, arg1) {
            const ret = arg1.stack;
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg_static_accessor_GLOBAL_8adb955bd33fac2f: function() {
            const ret = typeof global === 'undefined' ? null : global;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_static_accessor_GLOBAL_THIS_ad356e0db91c7913: function() {
            const ret = typeof globalThis === 'undefined' ? null : globalThis;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_static_accessor_SELF_f207c857566db248: function() {
            const ret = typeof self === 'undefined' ? null : self;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_static_accessor_WINDOW_bb9f1ba69d61b386: function() {
            const ret = typeof window === 'undefined' ? null : window;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_status_318629ab93a22955: function(arg0) {
            const ret = arg0.status;
            return ret;
        },
        __wbg_stringify_5ae93966a84901ac: function() { return handleError(function (arg0) {
            const ret = JSON.stringify(arg0);
            return ret;
        }, arguments); },
        __wbg_subarray_a068d24e39478a8a: function(arg0, arg1, arg2) {
            const ret = arg0.subarray(arg1 >>> 0, arg2 >>> 0);
            return ret;
        },
        __wbg_target_7bc90f314634b37b: function(arg0) {
            const ret = arg0.target;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_text_372f5b91442c50f9: function() { return handleError(function (arg0) {
            const ret = arg0.text();
            return ret;
        }, arguments); },
        __wbg_then_098abe61755d12f6: function(arg0, arg1) {
            const ret = arg0.then(arg1);
            return ret;
        },
        __wbg_then_9e335f6dd892bc11: function(arg0, arg1, arg2) {
            const ret = arg0.then(arg1, arg2);
            return ret;
        },
        __wbg_toString_3272fa0dfd05dd87: function(arg0) {
            const ret = arg0.toString();
            return ret;
        },
        __wbg_transaction_1309b463c399d2b3: function() { return handleError(function (arg0, arg1, arg2, arg3) {
            const ret = arg0.transaction(getStringFromWasm0(arg1, arg2), __wbindgen_enum_IdbTransactionMode[arg3]);
            return ret;
        }, arguments); },
        __wbg_transaction_3223f7c8d0f40129: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = arg0.transaction(arg1, __wbindgen_enum_IdbTransactionMode[arg2]);
            return ret;
        }, arguments); },
        __wbg_transaction_5eb9f1f16e8c769b: function(arg0) {
            const ret = arg0.transaction;
            return ret;
        },
        __wbg_transaction_fda57653957fee06: function(arg0) {
            const ret = arg0.transaction;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_transmission_progress_2b2ddc65cc1ce945: function(arg0) {
            const ret = arg0.transmission_progress;
            return ret;
        },
        __wbg_uniffi_clone_05a4d22e9fa60aa7: function(arg0) {
            const ret = arg0.uniffi_clone;
            return ret;
        },
        __wbg_uniffi_clone_0986bf33b7544dc8: function(arg0) {
            const ret = arg0.uniffi_clone;
            return ret;
        },
        __wbg_uniffi_clone_098f78a9a6f8f9e6: function(arg0) {
            const ret = arg0.uniffi_clone;
            return ret;
        },
        __wbg_uniffi_clone_0d09f800208182b3: function(arg0) {
            const ret = arg0.uniffi_clone;
            return ret;
        },
        __wbg_uniffi_clone_123deefa1e45607d: function(arg0) {
            const ret = arg0.uniffi_clone;
            return ret;
        },
        __wbg_uniffi_clone_19fefef44b9a321b: function(arg0) {
            const ret = arg0.uniffi_clone;
            return ret;
        },
        __wbg_uniffi_clone_24a0efa97a6685ea: function(arg0) {
            const ret = arg0.uniffi_clone;
            return ret;
        },
        __wbg_uniffi_clone_2b9bfa93c23374b4: function(arg0) {
            const ret = arg0.uniffi_clone;
            return ret;
        },
        __wbg_uniffi_clone_2cba23d194c552b6: function(arg0) {
            const ret = arg0.uniffi_clone;
            return ret;
        },
        __wbg_uniffi_clone_37f487e93923a96e: function(arg0) {
            const ret = arg0.uniffi_clone;
            return ret;
        },
        __wbg_uniffi_clone_3cf1db37f05cdede: function(arg0) {
            const ret = arg0.uniffi_clone;
            return ret;
        },
        __wbg_uniffi_clone_3f4276583a22c060: function(arg0) {
            const ret = arg0.uniffi_clone;
            return ret;
        },
        __wbg_uniffi_clone_473c30c97d2d982b: function(arg0) {
            const ret = arg0.uniffi_clone;
            return ret;
        },
        __wbg_uniffi_clone_4a44539900f9f585: function(arg0) {
            const ret = arg0.uniffi_clone;
            return ret;
        },
        __wbg_uniffi_clone_4ca65f4f43884f65: function(arg0) {
            const ret = arg0.uniffi_clone;
            return ret;
        },
        __wbg_uniffi_clone_550f34d27aedfe83: function(arg0) {
            const ret = arg0.uniffi_clone;
            return ret;
        },
        __wbg_uniffi_clone_61509fec77d03f92: function(arg0) {
            const ret = arg0.uniffi_clone;
            return ret;
        },
        __wbg_uniffi_clone_665b96c7eedfe39e: function(arg0) {
            const ret = arg0.uniffi_clone;
            return ret;
        },
        __wbg_uniffi_clone_66c7afc4270fa03c: function(arg0) {
            const ret = arg0.uniffi_clone;
            return ret;
        },
        __wbg_uniffi_clone_675bc10553f253e8: function(arg0) {
            const ret = arg0.uniffi_clone;
            return ret;
        },
        __wbg_uniffi_clone_6d38101017dcfd45: function(arg0) {
            const ret = arg0.uniffi_clone;
            return ret;
        },
        __wbg_uniffi_clone_70d6d2fff57642c6: function(arg0) {
            const ret = arg0.uniffi_clone;
            return ret;
        },
        __wbg_uniffi_clone_7849dfe7678543b1: function(arg0) {
            const ret = arg0.uniffi_clone;
            return ret;
        },
        __wbg_uniffi_clone_7ed5c4503758b107: function(arg0) {
            const ret = arg0.uniffi_clone;
            return ret;
        },
        __wbg_uniffi_clone_806b2d50bd142885: function(arg0) {
            const ret = arg0.uniffi_clone;
            return ret;
        },
        __wbg_uniffi_clone_84fefa5c7d2f2857: function(arg0) {
            const ret = arg0.uniffi_clone;
            return ret;
        },
        __wbg_uniffi_clone_8579ebd2339a0770: function(arg0) {
            const ret = arg0.uniffi_clone;
            return ret;
        },
        __wbg_uniffi_clone_88f9c2c2f9777275: function(arg0) {
            const ret = arg0.uniffi_clone;
            return ret;
        },
        __wbg_uniffi_clone_98280bf8f627e451: function(arg0) {
            const ret = arg0.uniffi_clone;
            return ret;
        },
        __wbg_uniffi_clone_9ac5f3ab31d3c18f: function(arg0) {
            const ret = arg0.uniffi_clone;
            return ret;
        },
        __wbg_uniffi_clone_9e3f1f957c82f285: function(arg0) {
            const ret = arg0.uniffi_clone;
            return ret;
        },
        __wbg_uniffi_clone_a3f471d5710f4759: function(arg0) {
            const ret = arg0.uniffi_clone;
            return ret;
        },
        __wbg_uniffi_clone_b05875b1cfdde0d1: function(arg0) {
            const ret = arg0.uniffi_clone;
            return ret;
        },
        __wbg_uniffi_clone_b539afdba51c28f1: function(arg0) {
            const ret = arg0.uniffi_clone;
            return ret;
        },
        __wbg_uniffi_clone_c28d51c3ce0df8fd: function(arg0) {
            const ret = arg0.uniffi_clone;
            return ret;
        },
        __wbg_uniffi_clone_c52baf4db6f53ce0: function(arg0) {
            const ret = arg0.uniffi_clone;
            return ret;
        },
        __wbg_uniffi_clone_ccbf23fd631c829b: function(arg0) {
            const ret = arg0.uniffi_clone;
            return ret;
        },
        __wbg_uniffi_clone_d15b2c9cbb55a3d1: function(arg0) {
            const ret = arg0.uniffi_clone;
            return ret;
        },
        __wbg_uniffi_clone_d4a75e016353a28f: function(arg0) {
            const ret = arg0.uniffi_clone;
            return ret;
        },
        __wbg_uniffi_clone_d9057dfb2afa474a: function(arg0) {
            const ret = arg0.uniffi_clone;
            return ret;
        },
        __wbg_uniffi_clone_e885b897111da6ac: function(arg0) {
            const ret = arg0.uniffi_clone;
            return ret;
        },
        __wbg_uniffi_clone_eb4fff9b1dc35617: function(arg0) {
            const ret = arg0.uniffi_clone;
            return ret;
        },
        __wbg_uniffi_clone_f2e42e7e1e38f97c: function(arg0) {
            const ret = arg0.uniffi_clone;
            return ret;
        },
        __wbg_uniffi_clone_f4dfb5348f2b5ad7: function(arg0) {
            const ret = arg0.uniffi_clone;
            return ret;
        },
        __wbg_uniffi_clone_f5fbff1e89d827a6: function(arg0) {
            const ret = arg0.uniffi_clone;
            return ret;
        },
        __wbg_uniffi_clone_f895d3196b2fa7d3: function(arg0) {
            const ret = arg0.uniffi_clone;
            return ret;
        },
        __wbg_uniffi_clone_f90867b1733cbd59: function(arg0) {
            const ret = arg0.uniffi_clone;
            return ret;
        },
        __wbg_uniffi_clone_ffb949b18683386d: function(arg0) {
            const ret = arg0.uniffi_clone;
            return ret;
        },
        __wbg_uniffi_free_0043ee432b03337b: function(arg0) {
            const ret = arg0.uniffi_free;
            return ret;
        },
        __wbg_uniffi_free_0419d4b9d8d6a5b8: function(arg0) {
            const ret = arg0.uniffi_free;
            return ret;
        },
        __wbg_uniffi_free_050f58d39e6a582f: function(arg0) {
            const ret = arg0.uniffi_free;
            return ret;
        },
        __wbg_uniffi_free_13ba4581334466f5: function(arg0) {
            const ret = arg0.uniffi_free;
            return ret;
        },
        __wbg_uniffi_free_16c7a6daaded7567: function(arg0) {
            const ret = arg0.uniffi_free;
            return ret;
        },
        __wbg_uniffi_free_1cc7d7827d9e77e7: function(arg0) {
            const ret = arg0.uniffi_free;
            return ret;
        },
        __wbg_uniffi_free_1d4c6b69f3dbc3fa: function(arg0) {
            const ret = arg0.uniffi_free;
            return ret;
        },
        __wbg_uniffi_free_1da00b7de76bbd20: function(arg0) {
            const ret = arg0.uniffi_free;
            return ret;
        },
        __wbg_uniffi_free_20990700d57651be: function(arg0) {
            const ret = arg0.uniffi_free;
            return ret;
        },
        __wbg_uniffi_free_212cd240eaa57732: function(arg0) {
            const ret = arg0.uniffi_free;
            return ret;
        },
        __wbg_uniffi_free_2a1127655bc285e1: function(arg0) {
            const ret = arg0.uniffi_free;
            return ret;
        },
        __wbg_uniffi_free_2ab728a39f371a94: function(arg0) {
            const ret = arg0.uniffi_free;
            return ret;
        },
        __wbg_uniffi_free_3d32438d37c125d9: function(arg0) {
            const ret = arg0.uniffi_free;
            return ret;
        },
        __wbg_uniffi_free_3df9154c365a8dbc: function(arg0) {
            const ret = arg0.uniffi_free;
            return ret;
        },
        __wbg_uniffi_free_45ff68a9a90fc738: function(arg0) {
            const ret = arg0.uniffi_free;
            return ret;
        },
        __wbg_uniffi_free_48ee2be25f4e7038: function(arg0) {
            const ret = arg0.uniffi_free;
            return ret;
        },
        __wbg_uniffi_free_5b7a8bf5fcff1b0a: function(arg0) {
            const ret = arg0.uniffi_free;
            return ret;
        },
        __wbg_uniffi_free_5f73f9824655fc48: function(arg0) {
            const ret = arg0.uniffi_free;
            return ret;
        },
        __wbg_uniffi_free_5fc3a61a9be59c7e: function(arg0) {
            const ret = arg0.uniffi_free;
            return ret;
        },
        __wbg_uniffi_free_62e42f4b130c49cc: function(arg0) {
            const ret = arg0.uniffi_free;
            return ret;
        },
        __wbg_uniffi_free_6c1d8f94e71dc9f8: function(arg0) {
            const ret = arg0.uniffi_free;
            return ret;
        },
        __wbg_uniffi_free_6e445a55df359f8f: function(arg0) {
            const ret = arg0.uniffi_free;
            return ret;
        },
        __wbg_uniffi_free_702e532eda6401a0: function(arg0) {
            const ret = arg0.uniffi_free;
            return ret;
        },
        __wbg_uniffi_free_71262c9cd6169f2b: function(arg0) {
            const ret = arg0.uniffi_free;
            return ret;
        },
        __wbg_uniffi_free_716c7a4a575b69a7: function(arg0) {
            const ret = arg0.uniffi_free;
            return ret;
        },
        __wbg_uniffi_free_73b3a49ac02e501f: function(arg0) {
            const ret = arg0.uniffi_free;
            return ret;
        },
        __wbg_uniffi_free_84d327069f16fc2a: function(arg0) {
            const ret = arg0.uniffi_free;
            return ret;
        },
        __wbg_uniffi_free_95e5312e5741d21f: function(arg0) {
            const ret = arg0.uniffi_free;
            return ret;
        },
        __wbg_uniffi_free_a3a7528c31b3c577: function(arg0) {
            const ret = arg0.uniffi_free;
            return ret;
        },
        __wbg_uniffi_free_ab4f43686c108df6: function(arg0) {
            const ret = arg0.uniffi_free;
            return ret;
        },
        __wbg_uniffi_free_ac56a6e76db42c38: function(arg0) {
            const ret = arg0.uniffi_free;
            return ret;
        },
        __wbg_uniffi_free_b2948d1fd46db641: function(arg0) {
            const ret = arg0.uniffi_free;
            return ret;
        },
        __wbg_uniffi_free_c01d0667ce7dd84b: function(arg0) {
            const ret = arg0.uniffi_free;
            return ret;
        },
        __wbg_uniffi_free_c16c6136951de27e: function(arg0) {
            const ret = arg0.uniffi_free;
            return ret;
        },
        __wbg_uniffi_free_c43df317c62c6a87: function(arg0) {
            const ret = arg0.uniffi_free;
            return ret;
        },
        __wbg_uniffi_free_cd98f6ded9227a0c: function(arg0) {
            const ret = arg0.uniffi_free;
            return ret;
        },
        __wbg_uniffi_free_d8416cef30a33971: function(arg0) {
            const ret = arg0.uniffi_free;
            return ret;
        },
        __wbg_uniffi_free_d9382736cbc4d9c8: function(arg0) {
            const ret = arg0.uniffi_free;
            return ret;
        },
        __wbg_uniffi_free_e00d0aaced8c1229: function(arg0) {
            const ret = arg0.uniffi_free;
            return ret;
        },
        __wbg_uniffi_free_e7efdffcc488bab3: function(arg0) {
            const ret = arg0.uniffi_free;
            return ret;
        },
        __wbg_uniffi_free_e7f017fdcb8e47d8: function(arg0) {
            const ret = arg0.uniffi_free;
            return ret;
        },
        __wbg_uniffi_free_ec7489f74a2de6a7: function(arg0) {
            const ret = arg0.uniffi_free;
            return ret;
        },
        __wbg_uniffi_free_ed79793fed1126c0: function(arg0) {
            const ret = arg0.uniffi_free;
            return ret;
        },
        __wbg_uniffi_free_f673d9351aed410e: function(arg0) {
            const ret = arg0.uniffi_free;
            return ret;
        },
        __wbg_uniffi_free_f682400e608ac6c0: function(arg0) {
            const ret = arg0.uniffi_free;
            return ret;
        },
        __wbg_uniffi_free_fb344b3cfb440f8c: function(arg0) {
            const ret = arg0.uniffi_free;
            return ret;
        },
        __wbg_uniffi_free_fd3546f3e58d80e2: function(arg0) {
            const ret = arg0.uniffi_free;
            return ret;
        },
        __wbg_uniffi_free_ff795c3cf7a12ab8: function(arg0) {
            const ret = arg0.uniffi_free;
            return ret;
        },
        __wbg_update_1d0ab25d290bbcc1: function() { return handleError(function (arg0, arg1) {
            const ret = arg0.update(arg1);
            return ret;
        }, arguments); },
        __wbg_upperBound_482c10cb5e387300: function() { return handleError(function (arg0, arg1) {
            const ret = IDBKeyRange.upperBound(arg0, arg1 !== 0);
            return ret;
        }, arguments); },
        __wbg_url_7fefc1820fba4e0c: function(arg0, arg1) {
            const ret = arg1.url;
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg_value_21fc78aab0322612: function(arg0) {
            const ret = arg0.value;
            return ret;
        },
        __wbg_value_79629bd10d556879: function() { return handleError(function (arg0) {
            const ret = arg0.value;
            return ret;
        }, arguments); },
        __wbg_version_6cdf210fcf448365: function(arg0) {
            const ret = arg0.version;
            return ret;
        },
        __wbg_versions_a8a74c7ca68bfe73: function(arg0) {
            const ret = arg0.versions;
            return ret;
        },
        __wbindgen_cast_0000000000000001: function(arg0, arg1) {
            // Cast intrinsic for `Closure(Closure { dtor_idx: 10332, function: Function { arguments: [NamedExternref("IDBVersionChangeEvent")], shim_idx: 10333, ret: Result(Unit), inner_ret: Some(Result(Unit)) }, mutable: true }) -> Externref`.
            const ret = makeMutClosure(arg0, arg1, wasm.wasm_bindgen__closure__destroy__haf6239c07b84a9fa, wasm_bindgen__convert__closures_____invoke__hcb493a516477ce57);
            return ret;
        },
        __wbindgen_cast_0000000000000002: function(arg0, arg1) {
            // Cast intrinsic for `Closure(Closure { dtor_idx: 10574, function: Function { arguments: [NamedExternref("Event")], shim_idx: 10575, ret: Unit, inner_ret: Some(Unit) }, mutable: true }) -> Externref`.
            const ret = makeMutClosure(arg0, arg1, wasm.wasm_bindgen__closure__destroy__h2b747a4dd5c91410, wasm_bindgen__convert__closures_____invoke__h9c3eec70fb3917a9);
            return ret;
        },
        __wbindgen_cast_0000000000000003: function(arg0, arg1) {
            // Cast intrinsic for `Closure(Closure { dtor_idx: 10574, function: Function { arguments: [], shim_idx: 10577, ret: Unit, inner_ret: Some(Unit) }, mutable: true }) -> Externref`.
            const ret = makeMutClosure(arg0, arg1, wasm.wasm_bindgen__closure__destroy__h2b747a4dd5c91410, wasm_bindgen__convert__closures_____invoke__hf6fe411d574c1fab);
            return ret;
        },
        __wbindgen_cast_0000000000000004: function(arg0, arg1) {
            // Cast intrinsic for `Closure(Closure { dtor_idx: 10688, function: Function { arguments: [], shim_idx: 10689, ret: Unit, inner_ret: Some(Unit) }, mutable: true }) -> Externref`.
            const ret = makeMutClosure(arg0, arg1, wasm.wasm_bindgen__closure__destroy__h737787e4775c4dc6, wasm_bindgen__convert__closures_____invoke__h174c8a160acdc94b);
            return ret;
        },
        __wbindgen_cast_0000000000000005: function(arg0, arg1) {
            // Cast intrinsic for `Closure(Closure { dtor_idx: 14073, function: Function { arguments: [Externref], shim_idx: 14074, ret: Result(Unit), inner_ret: Some(Result(Unit)) }, mutable: true }) -> Externref`.
            const ret = makeMutClosure(arg0, arg1, wasm.wasm_bindgen__closure__destroy__h0b6ed7399c747e22, wasm_bindgen__convert__closures_____invoke__h4487d535182f3314);
            return ret;
        },
        __wbindgen_cast_0000000000000006: function(arg0, arg1) {
            // Cast intrinsic for `Closure(Closure { dtor_idx: 14127, function: Function { arguments: [], shim_idx: 14128, ret: Unit, inner_ret: Some(Unit) }, mutable: true }) -> Externref`.
            const ret = makeMutClosure(arg0, arg1, wasm.wasm_bindgen__closure__destroy__hb8bd56dcabaeb78e, wasm_bindgen__convert__closures_____invoke__ha8af0ee9b9be55b2);
            return ret;
        },
        __wbindgen_cast_0000000000000007: function(arg0) {
            // Cast intrinsic for `F64 -> Externref`.
            const ret = arg0;
            return ret;
        },
        __wbindgen_cast_0000000000000008: function(arg0) {
            // Cast intrinsic for `I64 -> Externref`.
            const ret = arg0;
            return ret;
        },
        __wbindgen_cast_0000000000000009: function(arg0, arg1) {
            // Cast intrinsic for `Ref(Slice(U8)) -> NamedExternref("Uint8Array")`.
            const ret = getArrayU8FromWasm0(arg0, arg1);
            return ret;
        },
        __wbindgen_cast_000000000000000a: function(arg0, arg1) {
            // Cast intrinsic for `Ref(String) -> Externref`.
            const ret = getStringFromWasm0(arg0, arg1);
            return ret;
        },
        __wbindgen_cast_000000000000000b: function(arg0) {
            // Cast intrinsic for `U64 -> Externref`.
            const ret = BigInt.asUintN(64, arg0);
            return ret;
        },
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            const offset = table.grow(4);
            table.set(0, undefined);
            table.set(offset + 0, undefined);
            table.set(offset + 1, null);
            table.set(offset + 2, true);
            table.set(offset + 3, false);
        },
    };
    return {
        __proto__: null,
        "./index_bg.js": import0,
    };
}

function wasm_bindgen__convert__closures_____invoke__hf6fe411d574c1fab(arg0, arg1) {
    wasm.wasm_bindgen__convert__closures_____invoke__hf6fe411d574c1fab(arg0, arg1);
}

function wasm_bindgen__convert__closures_____invoke__h174c8a160acdc94b(arg0, arg1) {
    wasm.wasm_bindgen__convert__closures_____invoke__h174c8a160acdc94b(arg0, arg1);
}

function wasm_bindgen__convert__closures_____invoke__ha8af0ee9b9be55b2(arg0, arg1) {
    wasm.wasm_bindgen__convert__closures_____invoke__ha8af0ee9b9be55b2(arg0, arg1);
}

function wasm_bindgen__convert__closures_____invoke__h9c3eec70fb3917a9(arg0, arg1, arg2) {
    wasm.wasm_bindgen__convert__closures_____invoke__h9c3eec70fb3917a9(arg0, arg1, arg2);
}

function wasm_bindgen__convert__closures_____invoke__hcb493a516477ce57(arg0, arg1, arg2) {
    const ret = wasm.wasm_bindgen__convert__closures_____invoke__hcb493a516477ce57(arg0, arg1, arg2);
    if (ret[1]) {
        throw takeFromExternrefTable0(ret[0]);
    }
}

function wasm_bindgen__convert__closures_____invoke__h4487d535182f3314(arg0, arg1, arg2) {
    const ret = wasm.wasm_bindgen__convert__closures_____invoke__h4487d535182f3314(arg0, arg1, arg2);
    if (ret[1]) {
        throw takeFromExternrefTable0(ret[0]);
    }
}


const __wbindgen_enum_IdbCursorDirection = ["next", "nextunique", "prev", "prevunique"];


const __wbindgen_enum_IdbRequestReadyState = ["pending", "done"];


const __wbindgen_enum_IdbTransactionMode = ["readonly", "readwrite", "versionchange", "readwriteflush", "cleanup"];


const __wbindgen_enum_RequestCache = ["default", "no-store", "reload", "no-cache", "force-cache", "only-if-cached"];


const __wbindgen_enum_RequestCredentials = ["omit", "same-origin", "include"];


const __wbindgen_enum_RequestMode = ["same-origin", "no-cors", "cors", "navigate"];
const RustCallStatusFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_rustcallstatus_free(ptr >>> 0, 1));

function addToExternrefTable0(obj) {
    const idx = wasm.__externref_table_alloc();
    wasm.__wbindgen_externrefs.set(idx, obj);
    return idx;
}

function _assertClass(instance, klass) {
    if (!(instance instanceof klass)) {
        throw new Error(`expected instance of ${klass.name}`);
    }
}

const CLOSURE_DTORS = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(state => state.dtor(state.a, state.b));

function debugString(val) {
    // primitive types
    const type = typeof val;
    if (type == 'number' || type == 'boolean' || val == null) {
        return  `${val}`;
    }
    if (type == 'string') {
        return `"${val}"`;
    }
    if (type == 'symbol') {
        const description = val.description;
        if (description == null) {
            return 'Symbol';
        } else {
            return `Symbol(${description})`;
        }
    }
    if (type == 'function') {
        const name = val.name;
        if (typeof name == 'string' && name.length > 0) {
            return `Function(${name})`;
        } else {
            return 'Function';
        }
    }
    // objects
    if (Array.isArray(val)) {
        const length = val.length;
        let debug = '[';
        if (length > 0) {
            debug += debugString(val[0]);
        }
        for(let i = 1; i < length; i++) {
            debug += ', ' + debugString(val[i]);
        }
        debug += ']';
        return debug;
    }
    // Test for built-in
    const builtInMatches = /\[object ([^\]]+)\]/.exec(toString.call(val));
    let className;
    if (builtInMatches && builtInMatches.length > 1) {
        className = builtInMatches[1];
    } else {
        // Failed to match the standard '[object ClassName]'
        return toString.call(val);
    }
    if (className == 'Object') {
        // we're a user defined class or Object
        // JSON.stringify avoids problems with cycles, and is generally much
        // easier than looping through ownProperties of `val`.
        try {
            return 'Object(' + JSON.stringify(val) + ')';
        } catch (_) {
            return 'Object';
        }
    }
    // errors
    if (val instanceof Error) {
        return `${val.name}: ${val.message}\n${val.stack}`;
    }
    // TODO we could test for more things here, like `Set`s and `Map`s.
    return className;
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let cachedDataViewMemory0 = null;
function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return decodeText(ptr, len);
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function handleError(f, args) {
    try {
        return f.apply(this, args);
    } catch (e) {
        const idx = addToExternrefTable0(e);
        wasm.__wbindgen_exn_store(idx);
    }
}

function isLikeNone(x) {
    return x === undefined || x === null;
}

function makeMutClosure(arg0, arg1, dtor, f) {
    const state = { a: arg0, b: arg1, cnt: 1, dtor };
    const real = (...args) => {

        // First up with a closure we increment the internal reference
        // count. This ensures that the Rust closure environment won't
        // be deallocated while we're invoking it.
        state.cnt++;
        const a = state.a;
        state.a = 0;
        try {
            return f(a, state.b, ...args);
        } finally {
            state.a = a;
            real._wbg_cb_unref();
        }
    };
    real._wbg_cb_unref = () => {
        if (--state.cnt === 0) {
            state.dtor(state.a, state.b);
            state.a = 0;
            CLOSURE_DTORS.unregister(state);
        }
    };
    CLOSURE_DTORS.register(real, state, state);
    return real;
}

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_externrefs.get(idx);
    wasm.__externref_table_dealloc(idx);
    return value;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    };
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasm;
function __wbg_finalize_init(instance, module) {
    wasm = instance.exports;
    wasmModule = module;
    cachedDataViewMemory0 = null;
    cachedUint8ArrayMemory0 = null;
    wasm.__wbindgen_start();
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = module.ok && expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }


    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
